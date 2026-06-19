import { sequelize, Cart, Order, OrderItem, Product, ProductVariant, ProductImage, User } from "../models/index.js";

const placeOrder = async (req, res) => {
    const { advance_paid, advance_payment_mode = "cash" } = req.body;
    const user_id = req.user.id;

    const t = await sequelize.transaction();
    try {
        // Fetch cart items
        const cartItems = await Cart.findAll({
            where: { user_id },
            include: [
                { model: Product, as: "product" },
                { model: ProductVariant, as: "variant" },
            ],
            transaction: t,
        });

        if (!cartItems.length) {
            await t.rollback();
            return res.status(400).json({ error: "Cart is empty." });
        }

        // Calculate totals and check availability
        let total_amount = 0;
        let all_items_available = true;
        const orderItemsData = [];

        for (const item of cartItems) {
            const product = item.product;
            const variant = item.variant;

            // Determine price
            let unit_price = parseFloat(product.base_price);
            if (variant && variant.price_override != null) unit_price = parseFloat(variant.price_override);
            const discount = parseFloat(product.discount_percent) || 0;
            const effective_price = unit_price * (1 - discount / 100);

            // Determine availability
            let qty_available = 0;
            if (variant) {
                qty_available = variant.available_quantity;
            } else {
                qty_available = product.available_quantity;
            }
            const was_available = qty_available >= item.quantity;
            if (!was_available) all_items_available = false;

            total_amount += effective_price * item.quantity;
            orderItemsData.push({
                product_id: product.id,
                variant_id: variant ? variant.id : null,
                quantity: item.quantity,
                unit_price: parseFloat(effective_price.toFixed(2)),
                discount_percent: discount,
                was_available_at_order: was_available,
            });
        }

        total_amount = parseFloat(total_amount.toFixed(2));

        // Validate advance payment (min 20%)
        const min_advance = parseFloat((total_amount * 0.2).toFixed(2));
        const advance = parseFloat(advance_paid);
        if (isNaN(advance) || advance < min_advance) {
            await t.rollback();
            return res.status(400).json({
                error: `Minimum advance payment is 20% of total (₹${min_advance}). Total order value: ₹${total_amount}.`,
            });
        }

        // Determine delivery dates
        const today = new Date();
        let tentative_delivery_date = null;
        let final_delivery_date = null;
        let order_status = "pending";

        if (all_items_available) {
            // All items in stock → ready today
            const todayStr = today.toISOString().split("T")[0];
            final_delivery_date = todayStr;
            order_status = "ready_for_pickup";
        } else {
            // Pre-order → tentative date = tomorrow
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tentative_delivery_date = tomorrow.toISOString().split("T")[0];
            order_status = "pending";
        }

        // Create order
        const order = await Order.create({
            user_id,
            total_amount,
            advance_paid: advance,
            advance_payment_mode,
            payment_status: advance >= total_amount ? "fully_paid" : "advance_paid",
            all_items_available,
            tentative_delivery_date,
            final_delivery_date,
            order_status,
        }, { transaction: t });

        // Create order items
        for (const item of orderItemsData) {
            await OrderItem.create({ order_id: order.id, ...item }, { transaction: t });
        }

        // Deduct stock only for available items
        for (const item of orderItemsData) {
            if (item.was_available_at_order) {
                if (item.variant_id) {
                    await ProductVariant.decrement("available_quantity", {
                        by: item.quantity,
                        where: { id: item.variant_id },
                        transaction: t,
                    });
                } else {
                    await Product.decrement("available_quantity", {
                        by: item.quantity,
                        where: { id: item.product_id },
                        transaction: t,
                    });
                }
            }
        }

        // Clear cart
        await Cart.destroy({ where: { user_id }, transaction: t });

        await t.commit();
        return res.status(201).json({
            message: "Order placed successfully.",
            order_id: order.id,
            total_amount,
            advance_paid: advance,
            all_items_available,
            delivery_date: final_delivery_date || tentative_delivery_date,
            order_status,
        });
    } catch (err) {
        await t.rollback();
        console.error("placeOrder error:", err.message);
        return res.status(500).json({ error: "Failed to place order." });
    }
};

const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.findAll({
            where: { user_id: req.user.id },
            include: [
                {
                    model: OrderItem,
                    as: "items",
                    include: [
                        {
                            model: Product,
                            as: "product",
                            include: [{ model: ProductImage, as: "images", where: { is_cover: true }, required: false }],
                        },
                        { model: ProductVariant, as: "variant" },
                    ],
                },
            ],
            order: [["created_at", "DESC"]],
        });
        return res.json({ orders });
    } catch (err) {
        console.error("getMyOrders error:", err.message);
        return res.status(500).json({ error: "Failed to fetch orders." });
    }
};

const getOrderById = async (req, res) => {
    try {
        const order = await Order.findOne({
            where: { id: req.params.id, user_id: req.user.id },
            include: [
                {
                    model: OrderItem,
                    as: "items",
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

const cancelOrder = async (req, res) => {
    const { cancellation_reason } = req.body;
    const t = await sequelize.transaction();
    try {
        const order = await Order.findOne({
            where: { id: req.params.id, user_id: req.user.id },
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
                    await ProductVariant.increment("available_quantity", {
                        by: item.quantity,
                        where: { id: item.variant_id },
                        transaction: t,
                    });
                } else {
                    await Product.increment("available_quantity", {
                        by: item.quantity,
                        where: { id: item.product_id },
                        transaction: t,
                    });
                }
            }
        }

        await order.update({
            order_status: "cancelled",
            payment_status: "refunded",
            cancellation_reason: cancellation_reason || "Cancelled by customer",
            updated_at: new Date(),
        }, { transaction: t });

        await t.commit();
        return res.json({ message: "Order cancelled. Advance refund will be processed by admin." });
    } catch (err) {
        await t.rollback();
        console.error("cancelOrder error:", err.message);
        return res.status(500).json({ error: "Failed to cancel order." });
    }
};

export { placeOrder, getMyOrders, getOrderById, cancelOrder };
