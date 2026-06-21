import { sequelize, Order, OrderItem, Payment, Product, ProductVariant, ProductImage, User, MessageLog } from "../../models/index.js";
import { confirmAdvanceAndProgress } from "../../controllers/orderController.js";
import { releaseStock, consumeStock, notifyAdmin, notifyCustomer, slipNo, genInvoiceNo } from "../../services/orderHelpers.js";
import { dispatchOrderEvent, dispatchOrderEventSync } from "../../services/notify.js";
import { isLive } from "../../services/messagingService.js";

const ORDER_INCLUDE = [
    { model: User, as: "user", attributes: ["id", "name", "phone", "email", "address"] },
    {
        model: OrderItem, as: "items",
        include: [
            { model: Product, as: "product", include: [{ model: ProductImage, as: "images", where: { is_cover: true }, required: false }] },
            { model: ProductVariant, as: "variant" },
        ],
    },
    { model: Payment, as: "payments" },
];

const getAllOrders = async (req, res) => {
    const { status, payment_status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.order_status = status;
    if (payment_status) where.payment_status = payment_status;
    try {
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const { count, rows } = await Order.findAndCountAll({
            where, include: ORDER_INCLUDE,
            order: [["created_at", "DESC"]], limit: parseInt(limit), offset,
            distinct: true,
        });
        return res.json({ orders: rows, total: count, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        console.error("getAllOrders error:", err.message);
        return res.status(500).json({ error: "Failed to fetch orders." });
    }
};

const getOrderById = async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id, { include: ORDER_INCLUDE });
        if (!order) return res.status(404).json({ error: "Order not found." });
        return res.json({ order });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch order." });
    }
};

// Admin confirms a CASH advance was received → order is officially placed.
const confirmAdvance = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const order = await Order.findByPk(req.params.id, {
            include: [{ model: OrderItem, as: "items" }], transaction: t,
        });
        if (!order) { await t.rollback(); return res.status(404).json({ error: "Order not found." }); }
        if (order.advance_confirmed || !["pending"].includes(order.order_status)) {
            await t.rollback(); return res.status(400).json({ error: "Advance already confirmed or order not pending." });
        }

        const payment = await Payment.findOne({
            where: { order_id: order.id, payment_type: "advance", status: "pending" }, transaction: t,
        });
        if (!payment) {
            await t.rollback();
            return res.status(400).json({ error: "No pending advance payment found for this order." });
        }
        const advance = parseFloat(payment.amount);
        await payment.update({
            status: "confirmed", method: "cash", gateway: "cash",
            confirmed_by_admin: true, confirmed_at: new Date(),
        }, { transaction: t });

        await confirmAdvanceAndProgress(order, advance, "cash", t);
        await notifyCustomer(order.user_id, "advance_confirmed", "Order confirmed",
            `Your advance of ₹${advance} was confirmed. Your order is now being processed.`, order.id, t);
        await t.commit();
        dispatchOrderEvent("advance_confirmed", order.id);
        return res.json({ message: "Advance confirmed. Order placed.", order_id: order.id });
    } catch (err) {
        await t.rollback();
        console.error("confirmAdvance error:", err.message);
        return res.status(500).json({ error: "Failed to confirm advance." });
    }
};

// Move a made-to-order order into production and set the tentative ready date.
const startProduction = async (req, res) => {
    const { tentative_delivery_date, admin_notes } = req.body;
    try {
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ error: "Order not found." });
        if (!["confirmed", "in_production"].includes(order.order_status))
            return res.status(400).json({ error: "Order must be confirmed first." });
        await order.update({
            order_status: "in_production",
            tentative_delivery_date: tentative_delivery_date || order.tentative_delivery_date,
            admin_notes: admin_notes ?? order.admin_notes,
            updated_at: new Date(),
        });
        await notifyCustomer(order.user_id, "in_production", "Order in production",
            `Your order #${order.id} is now in production.`, order.id);
        return res.json({ message: "Marked in production.", order });
    } catch (err) {
        return res.status(500).json({ error: "Failed to update production status." });
    }
};

// Admin confirms the product is ready → Ready for Pickup, with the ready date.
// Gated on stock: every item must have enough physical on-hand to fulfill it.
const markReady = async (req, res) => {
    const { final_delivery_date } = req.body;
    try {
        const order = await Order.findByPk(req.params.id, {
            include: [{
                model: OrderItem, as: "items",
                include: [
                    { model: Product, as: "product", attributes: ["id", "name", "available_quantity"] },
                    { model: ProductVariant, as: "variant", attributes: ["id", "variant_name", "available_quantity"] },
                ],
            }],
        });
        if (!order) return res.status(404).json({ error: "Order not found." });
        if (!["confirmed", "in_production"].includes(order.order_status))
            return res.status(400).json({ error: "Order must be confirmed or in production." });

        const shortages = [];
        for (const it of order.items) {
            const onHand = it.variant ? it.variant.available_quantity : it.product?.available_quantity;
            if ((onHand || 0) < it.quantity) {
                const label = (it.product?.name || "Product") + (it.variant ? ` (${it.variant.variant_name})` : "");
                shortages.push({ name: label, need: it.quantity - (onHand || 0) });
            }
        }
        if (shortages.length) {
            return res.status(400).json({ error: "Not enough stock to mark this order ready.", shortages });
        }

        const readyDate = final_delivery_date || new Date().toISOString().split("T")[0];
        await order.update({
            order_status: "ready_for_pickup",
            final_delivery_date: readyDate,
            updated_at: new Date(),
        });
        await notifyAdmin("ready", `Order #${order.id} ready`, `Order #${order.id} is ready for pickup.`, order.id);
        await notifyCustomer(order.user_id, "ready", "Ready for pickup",
            `Your order #${order.id} is ready for pickup${readyDate ? ` from ${readyDate}` : ""}.`, order.id);
        dispatchOrderEvent("order_ready", order.id);
        return res.json({ message: "Order marked ready for pickup.", order });
    } catch (err) {
        return res.status(500).json({ error: "Failed to mark ready." });
    }
};

// Customer collected. Records the actual delivery date + any final CASH payment,
// then generates the invoice number. (Online final payments are auto-confirmed
// by the customer flow; here admin confirms cash or marks a fully-paid handover.)
const markDelivered = async (req, res) => {
    const { final_paid = 0, final_payment_mode = "cash" } = req.body;
    const t = await sequelize.transaction();
    try {
        const order = await Order.findByPk(req.params.id, {
            include: [{ model: OrderItem, as: "items" }], transaction: t,
        });
        if (!order) { await t.rollback(); return res.status(404).json({ error: "Order not found." }); }
        if (order.order_status !== "ready_for_pickup") {
            await t.rollback(); return res.status(400).json({ error: "Order must be ready for pickup." });
        }

        const paidNow = parseFloat(final_paid) || 0;
        const balanceDue = parseFloat(order.total_amount) - parseFloat(order.advance_paid) - parseFloat(order.final_paid);
        if (paidNow > balanceDue + 0.01) {
            await t.rollback();
            return res.status(400).json({ error: `Final payment cannot exceed the balance due (₹${balanceDue.toFixed(2)}).` });
        }
        if (paidNow > 0) {
            const finalPayment = await Payment.create({
                order_id: order.id, payment_type: "final", method: final_payment_mode,
                amount: paidNow, status: "confirmed", gateway: final_payment_mode,
                confirmed_by_admin: final_payment_mode === "cash", confirmed_at: new Date(),
            }, { transaction: t });
            await finalPayment.update({ slip_no: slipNo(order.id, "final", finalPayment.id) }, { transaction: t });
        }

        const newFinal = parseFloat(order.final_paid) + paidNow;
        const totalCollected = parseFloat(order.advance_paid) + newFinal;
        const pending = parseFloat(order.total_amount) - totalCollected;
        const payment_status = pending > 0.01 ? "pending_after_delivery" : "fully_paid";

        await order.update({
            final_paid: newFinal,
            final_payment_mode: paidNow > 0 ? final_payment_mode : order.final_payment_mode,
            final_confirmed: pending <= 0.01,
            final_confirmed_at: pending <= 0.01 ? new Date() : order.final_confirmed_at,
            payment_status,
            order_status: "delivered",
            actual_delivery_date: new Date(),
            invoice_no: order.invoice_no || genInvoiceNo(order),
            updated_at: new Date(),
        }, { transaction: t });

        // Goods have left the premises → reduce physical on-hand stock.
        await consumeStock(order, order.items, t);

        await notifyCustomer(order.user_id, "delivered", "Order delivered",
            pending > 0.01
                ? `Order #${order.id} delivered. Balance due ₹${pending.toFixed(2)}.`
                : `Order #${order.id} delivered and fully paid. Thank you!`,
            order.id, t);

        await t.commit();
        dispatchOrderEvent("order_completed", order.id);
        return res.json({
            message: "Delivery recorded.",
            pending_amount: Math.max(0, pending).toFixed(2),
            payment_status,
        });
    } catch (err) {
        await t.rollback();
        console.error("markDelivered error:", err.message);
        return res.status(500).json({ error: "Failed to mark delivery." });
    }
};

const adminCancelOrder = async (req, res) => {
    const { cancellation_reason } = req.body;
    const t = await sequelize.transaction();
    try {
        const order = await Order.findByPk(req.params.id, { include: [{ model: OrderItem, as: "items" }], transaction: t });
        if (!order) { await t.rollback(); return res.status(404).json({ error: "Order not found." }); }
        if (["delivered", "cancelled"].includes(order.order_status)) {
            await t.rollback(); return res.status(400).json({ error: "This order cannot be cancelled." });
        }
        await releaseStock(order, order.items, t);
        await order.update({
            order_status: "cancelled",
            payment_status: parseFloat(order.advance_paid) > 0 ? "refunded" : order.payment_status,
            cancellation_reason: cancellation_reason || "Cancelled by admin",
            updated_at: new Date(),
        }, { transaction: t });
        await notifyCustomer(order.user_id, "cancelled", "Order cancelled",
            `Your order #${order.id} was cancelled${cancellation_reason ? `: ${cancellation_reason}` : ""}.`, order.id, t);
        await t.commit();
        return res.json({ message: "Order cancelled." });
    } catch (err) {
        await t.rollback();
        return res.status(500).json({ error: "Failed to cancel order." });
    }
};

const markRefundIssued = async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ error: "Order not found." });
        if (order.order_status !== "cancelled")
            return res.status(400).json({ error: "Only cancelled orders can have refunds marked." });
        await order.update({ payment_status: "refunded", updated_at: new Date() });
        await notifyCustomer(order.user_id, "refunded", "Refund issued",
            `Your refund for order #${order.id} has been issued.`, order.id);
        return res.json({ message: "Refund marked as issued." });
    } catch (err) {
        return res.status(500).json({ error: "Failed to mark refund." });
    }
};

const getPendingDues = async (req, res) => {
    try {
        const orders = await Order.findAll({
            where: { order_status: "delivered", payment_status: "pending_after_delivery" },
            include: ORDER_INCLUDE,
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

const collectDue = async (req, res) => {
    const { amount_collected, payment_mode = "cash" } = req.body;
    const t = await sequelize.transaction();
    try {
        const order = await Order.findByPk(req.params.id, { transaction: t });
        if (!order || order.payment_status !== "pending_after_delivery") {
            await t.rollback(); return res.status(404).json({ error: "No pending due found for this order." });
        }
        const collected = parseFloat(amount_collected) || 0;
        const outstanding = parseFloat(order.total_amount) - parseFloat(order.advance_paid) - parseFloat(order.final_paid);
        if (collected > outstanding + 0.01) {
            await t.rollback();
            return res.status(400).json({ error: `Amount cannot exceed the outstanding due (₹${outstanding.toFixed(2)}).` });
        }
        const duePayment = await Payment.create({
            order_id: order.id, payment_type: "final", method: payment_mode, amount: collected,
            status: "confirmed", gateway: payment_mode, confirmed_by_admin: payment_mode === "cash",
            confirmed_at: new Date(),
        }, { transaction: t });
        await duePayment.update({ slip_no: slipNo(order.id, "final", duePayment.id) }, { transaction: t });

        const newFinal = parseFloat(order.final_paid) + collected;
        const stillPending = parseFloat(order.total_amount) - parseFloat(order.advance_paid) - newFinal;
        await order.update({
            final_paid: newFinal,
            payment_status: stillPending <= 0.01 ? "fully_paid" : "pending_after_delivery",
            final_confirmed: stillPending <= 0.01,
            updated_at: new Date(),
        }, { transaction: t });
        await notifyCustomer(order.user_id, "payment_received", "Payment received",
            `We received your payment of ₹${collected.toFixed(2)} for order #${order.id}.`, order.id, t);
        await t.commit();
        dispatchOrderEvent("payment_received", order.id, { amount: collected });
        return res.json({
            message: stillPending <= 0.01 ? "Payment fully collected." : `Partial. Still pending: ₹${stillPending.toFixed(2)}`,
            still_pending: Math.max(0, stillPending).toFixed(2),
        });
    } catch (err) {
        await t.rollback();
        return res.status(500).json({ error: "Failed to record collection." });
    }
};

// Confirm a customer's CASH due request → records it as a confirmed final
// payment and clears the due (mirrors confirmAdvance for the balance).
const confirmCashDue = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const order = await Order.findByPk(req.params.id, { transaction: t });
        if (!order) { await t.rollback(); return res.status(404).json({ error: "Order not found." }); }

        const payment = await Payment.findOne({
            where: { order_id: order.id, payment_type: "final", status: "pending" }, transaction: t,
        });
        if (!payment) { await t.rollback(); return res.status(400).json({ error: "No pending cash due request to confirm." }); }

        const outstanding = parseFloat(order.total_amount) - parseFloat(order.advance_paid) - parseFloat(order.final_paid);
        const applied = Math.min(parseFloat(payment.amount), outstanding);

        await payment.update({
            method: "cash", gateway: "cash", amount: applied, status: "confirmed",
            confirmed_by_admin: true, confirmed_at: new Date(),
        }, { transaction: t });

        const newFinal = parseFloat(order.final_paid) + applied;
        const stillPending = parseFloat(order.total_amount) - parseFloat(order.advance_paid) - newFinal;
        const fully = stillPending <= 0.01;
        await order.update({
            final_paid: newFinal,
            final_payment_mode: "cash",
            final_confirmed: fully,
            final_confirmed_at: fully ? new Date() : order.final_confirmed_at,
            payment_status: fully ? "fully_paid" : "pending_after_delivery",
            updated_at: new Date(),
        }, { transaction: t });

        await notifyCustomer(order.user_id, "payment_received", "Payment received",
            `We received your cash payment of ₹${applied.toFixed(2)} for order #${order.id}.`, order.id, t);

        await t.commit();
        dispatchOrderEvent("payment_received", order.id, { amount: applied });
        return res.json({
            message: fully ? "Cash due confirmed. Fully paid." : `Confirmed. Still pending ₹${stillPending.toFixed(2)}.`,
            still_pending: Math.max(0, stillPending).toFixed(2),
        });
    } catch (err) {
        await t.rollback();
        console.error("confirmCashDue error:", err.message);
        return res.status(500).json({ error: "Failed to confirm cash due." });
    }
};

// Reject a customer's cash due request → the pending payment is marked failed
// (kept for history) so the customer can choose a payment option again.
const rejectCashDue = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const order = await Order.findByPk(req.params.id, { transaction: t });
        if (!order) { await t.rollback(); return res.status(404).json({ error: "Order not found." }); }
        const payment = await Payment.findOne({
            where: { order_id: order.id, payment_type: "final", status: "pending", method: "cash" }, transaction: t,
        });
        if (!payment) { await t.rollback(); return res.status(400).json({ error: "No pending cash request to reject." }); }

        await payment.update({ status: "failed", confirmed_by_admin: false }, { transaction: t });
        await notifyCustomer(order.user_id, "due_rejected", "Cash request declined",
            `Your cash payment request for order #${order.id} was declined. Please choose a payment option again.`, order.id, t);

        await t.commit();
        return res.json({ message: "Cash request rejected." });
    } catch (err) {
        await t.rollback();
        console.error("rejectCashDue error:", err.message);
        return res.status(500).json({ error: "Failed to reject cash request." });
    }
};

// SMS / WhatsApp notification history for an order.
const getOrderMessages = async (req, res) => {
    try {
        const messages = await MessageLog.findAll({
            where: { order_id: req.params.id },
            order: [["created_at", "DESC"]],
        });
        return res.json({ messages, live: isLive() });
    } catch (err) {
        return res.status(500).json({ error: "Failed to load messages." });
    }
};

// Re-send a notification for an order (e.g. resend the bill on WhatsApp).
const resendMessage = async (req, res) => {
    const { event = "order_completed" } = req.body;
    const allowed = ["order_placed", "advance_confirmed", "order_ready", "order_completed"];
    if (!allowed.includes(event)) return res.status(400).json({ error: "Invalid event." });
    try {
        const result = await dispatchOrderEventSync(event, req.params.id);
        if (!result.ok) return res.status(400).json({ error: result.error });
        return res.json({ message: "Notification re-sent.", ...result });
    } catch (err) {
        return res.status(500).json({ error: "Failed to resend notification." });
    }
};

export {
    getAllOrders, getOrderById,
    confirmAdvance, startProduction, markReady, markDelivered,
    adminCancelOrder, markRefundIssued,
    getPendingDues, collectDue, confirmCashDue, rejectCashDue,
    getOrderMessages, resendMessage,
};
