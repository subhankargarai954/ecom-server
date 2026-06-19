import { sequelize, Order, OrderItem, Product, ProductVariant, ProductImage, User } from "../../models/index.js";

const getAllOrders = async (req, res) => {
    const { status, payment_status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.order_status = status;
    if (payment_status) where.payment_status = payment_status;

    try {
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const { count, rows } = await Order.findAndCountAll({
            where,
            include: [
                { model: User, as: "user", attributes: ["id", "name", "phone", "email"] },
                {
                    model: OrderItem, as: "items",
                    include: [
                        {
                            model: Product, as: "product",
                            include: [{ model: ProductImage, as: "images", where: { is_cover: true }, required: false }],
                        },
                        { model: ProductVariant, as: "variant" },
                    ],
                },
            ],
            order: [["created_at", "DESC"]],
            limit: parseInt(limit),
            offset,
        });
        return res.json({ orders: rows, total: count, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        console.error("getAllOrders error:", err.message);
        return res.status(500).json({ error: "Failed to fetch orders." });
    }
};

const getOrderById = async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id, {
            include: [
                { model: User, as: "user", attributes: ["id", "name", "phone", "email", "address"] },
                {
                    model: OrderItem, as: "items",
                    include: [
                        { model: Product, as: "product", include: [{ model: ProductImage, as: "images" }] },
                        { model: ProductVariant, as: "variant" },
                    ],
                },
            ],
        });
        if (!order) return res.status(404).json({ error: "Order not found." });
        return res.json({ order });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch order." });
    }
};

// Admin confirms pre-order and sets tentative delivery date
const confirmOrder = async (req, res) => {
    const { tentative_delivery_date, admin_notes } = req.body;
    try {
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ error: "Order not found." });
        if (order.order_status !== "pending")
            return res.status(400).json({ error: "Only pending orders can be confirmed." });

        await order.update({
            order_status: "confirmed",
            tentative_delivery_date,
            admin_notes,
            updated_at: new Date(),
        });
        return res.json({ message: "Order confirmed.", order });
    } catch (err) {
        return res.status(500).json({ error: "Failed to confirm order." });
    }
};

// Admin sets the final delivery date (when stock is available)
const setFinalDeliveryDate = async (req, res) => {
    const { final_delivery_date } = req.body;
    if (!final_delivery_date) return res.status(400).json({ error: "final_delivery_date is required." });

    try {
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ error: "Order not found." });
        if (!["confirmed", "pending"].includes(order.order_status))
            return res.status(400).json({ error: "Order must be in pending or confirmed state." });

        await order.update({
            final_delivery_date,
            order_status: "ready_for_pickup",
            updated_at: new Date(),
        });
        return res.json({ message: "Final delivery date set. Order is ready for pickup.", order });
    } catch (err) {
        return res.status(500).json({ error: "Failed to set delivery date." });
    }
};

// Admin marks order as delivered (customer picked up) and records remaining payment
const markDelivered = async (req, res) => {
    const { final_paid, final_payment_mode = "cash" } = req.body;

    const t = await sequelize.transaction();
    try {
        const order = await Order.findByPk(req.params.id, { transaction: t });
        if (!order) {
            await t.rollback();
            return res.status(404).json({ error: "Order not found." });
        }
        if (order.order_status !== "ready_for_pickup") {
            await t.rollback();
            return res.status(400).json({ error: "Order must be ready_for_pickup to mark as delivered." });
        }

        const paid = parseFloat(final_paid) || 0;
        const total_collected = parseFloat(order.advance_paid) + paid;
        const pending_amount = parseFloat(order.total_amount) - total_collected;

        let payment_status = "fully_paid";
        if (pending_amount > 0.01) payment_status = "pending_after_delivery";
        else if (pending_amount <= 0) payment_status = "fully_paid";

        await order.update({
            final_paid: paid,
            final_payment_mode,
            payment_status,
            order_status: "delivered",
            actual_delivery_date: new Date(),
            updated_at: new Date(),
        }, { transaction: t });

        await t.commit();
        return res.json({
            message: "Delivery recorded.",
            total_amount: order.total_amount,
            total_collected,
            pending_amount: Math.max(0, pending_amount),
            payment_status,
        });
    } catch (err) {
        await t.rollback();
        console.error("markDelivered error:", err.message);
        return res.status(500).json({ error: "Failed to mark delivery." });
    }
};

// Admin cancels order (e.g. item permanently unavailable)
const adminCancelOrder = async (req, res) => {
    const { cancellation_reason } = req.body;
    const t = await sequelize.transaction();
    try {
        const order = await Order.findByPk(req.params.id, {
            include: [{ model: OrderItem, as: "items" }],
            transaction: t,
        });
        if (!order) {
            await t.rollback();
            return res.status(404).json({ error: "Order not found." });
        }
        if (["delivered", "cancelled"].includes(order.order_status)) {
            await t.rollback();
            return res.status(400).json({ error: "This order cannot be cancelled." });
        }

        // Restore stock for available items
        for (const item of order.items) {
            if (item.was_available_at_order) {
                if (item.variant_id) {
                    await ProductVariant.increment("available_quantity", { by: item.quantity, where: { id: item.variant_id }, transaction: t });
                } else {
                    await Product.increment("available_quantity", { by: item.quantity, where: { id: item.product_id }, transaction: t });
                }
            }
        }

        await order.update({
            order_status: "cancelled",
            payment_status: "refunded",
            cancellation_reason: cancellation_reason || "Cancelled by admin",
            updated_at: new Date(),
        }, { transaction: t });

        await t.commit();
        return res.json({ message: "Order cancelled. Advance refund should be processed." });
    } catch (err) {
        await t.rollback();
        return res.status(500).json({ error: "Failed to cancel order." });
    }
};

// Mark refund as issued for a cancelled order
const markRefundIssued = async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ error: "Order not found." });
        if (order.order_status !== "cancelled")
            return res.status(400).json({ error: "Only cancelled orders can have refunds marked." });

        await order.update({ payment_status: "refunded", updated_at: new Date() });
        return res.json({ message: "Refund marked as issued." });
    } catch (err) {
        return res.status(500).json({ error: "Failed to mark refund." });
    }
};

// Get pending dues — delivered orders where payment is still pending
const getPendingDues = async (req, res) => {
    try {
        const orders = await Order.findAll({
            where: { order_status: "delivered", payment_status: "pending_after_delivery" },
            include: [
                { model: User, as: "user", attributes: ["id", "name", "phone", "email", "address"] },
                {
                    model: OrderItem, as: "items",
                    include: [
                        { model: Product, as: "product", attributes: ["id", "name"] },
                        { model: ProductVariant, as: "variant", attributes: ["id", "variant_name"] },
                    ],
                },
            ],
            order: [["actual_delivery_date", "DESC"]],
        });

        const dues = orders.map((o) => ({
            order_id: o.id,
            customer: o.user,
            total_amount: o.total_amount,
            advance_paid: o.advance_paid,
            final_paid: o.final_paid,
            pending_amount: (parseFloat(o.total_amount) - parseFloat(o.advance_paid) - parseFloat(o.final_paid)).toFixed(2),
            delivered_on: o.actual_delivery_date,
            items: o.items,
        }));

        return res.json({ dues });
    } catch (err) {
        console.error("getPendingDues error:", err.message);
        return res.status(500).json({ error: "Failed to fetch pending dues." });
    }
};

// Collect outstanding due after delivery
const collectDue = async (req, res) => {
    const { amount_collected, payment_mode = "cash" } = req.body;
    try {
        const order = await Order.findByPk(req.params.id);
        if (!order || order.payment_status !== "pending_after_delivery")
            return res.status(404).json({ error: "No pending due found for this order." });

        const new_final_paid = parseFloat(order.final_paid) + parseFloat(amount_collected);
        const total_paid = parseFloat(order.advance_paid) + new_final_paid;
        const still_pending = parseFloat(order.total_amount) - total_paid;

        await order.update({
            final_paid: new_final_paid,
            payment_status: still_pending <= 0.01 ? "fully_paid" : "pending_after_delivery",
            updated_at: new Date(),
        });

        return res.json({
            message: still_pending <= 0.01 ? "Payment fully collected." : `Partial collection. Still pending: ₹${still_pending.toFixed(2)}`,
            still_pending: Math.max(0, still_pending).toFixed(2),
        });
    } catch (err) {
        return res.status(500).json({ error: "Failed to record collection." });
    }
};

export {
    getAllOrders, getOrderById,
    confirmOrder, setFinalDeliveryDate, markDelivered,
    adminCancelOrder, markRefundIssued,
    getPendingDues, collectDue,
};
