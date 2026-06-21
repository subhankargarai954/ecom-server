import { sequelize, Cart, Order, OrderItem, Payment, Product, ProductVariant, ProductImage } from "../models/index.js";
import { createGatewayOrder, verifyPaymentSignature } from "../services/razorpayService.js";
import { commitStock, releaseStock, notifyAdmin, slipNo } from "../services/orderHelpers.js";

// Statuses for which a balance/final payment is valid (advance already confirmed,
// order not cancelled). Used to gate the online final-payment endpoints.
const FINAL_PAYABLE_STATUSES = ["confirmed", "in_production", "ready_for_pickup", "delivered"];
import { dispatchOrderEvent } from "../services/notify.js";
import { getReservedMap, reservedFor, shownAvailable } from "../services/stock.js";

const MIN_ADVANCE_PCT = 0.20;

// ---- helper: build order totals + item rows from the user's cart ----
async function buildFromCart(user_id, t) {
    const cartItems = await Cart.findAll({
        where: { user_id },
        include: [{ model: Product, as: "product" }, { model: ProductVariant, as: "variant" }],
        transaction: t,
    });
    if (!cartItems.length) return null;

    // Availability is on-hand minus what other confirmed orders already reserve.
    const productIds = [...new Set(cartItems.map((c) => c.product.id))];
    const reservedMap = await getReservedMap(productIds, t);

    let total_amount = 0;
    let all_items_available = true;
    const itemsData = [];

    for (const item of cartItems) {
        const product = item.product;
        const variant = item.variant;
        let unit_price = parseFloat(product.base_price);
        if (variant && variant.price_override != null) unit_price = parseFloat(variant.price_override);
        const discount = parseFloat(product.discount_percent) || 0;
        const effective = unit_price * (1 - discount / 100);

        const onHand = variant ? variant.available_quantity : product.available_quantity;
        const reserved = reservedFor(reservedMap, product.id, variant ? variant.id : null);
        const freeToOrder = shownAvailable(onHand, reserved);
        const wasAvailable = freeToOrder >= item.quantity;
        if (!wasAvailable) all_items_available = false;

        total_amount += effective * item.quantity;
        itemsData.push({
            product_id: product.id,
            variant_id: variant ? variant.id : null,
            quantity: item.quantity,
            unit_price: parseFloat(effective.toFixed(2)),
            discount_percent: discount,
            was_available_at_order: wasAvailable,
        });
    }
    return { total_amount: parseFloat(total_amount.toFixed(2)), all_items_available, itemsData };
}

// =====================================================================
// POST /api/orders/checkout
// body: { advance_paid, payment_method: "cash"|"online" }
// cash  -> order 'pending' (admin must confirm advance)
// online-> order 'awaiting_payment' + gateway order returned to client
// =====================================================================
const checkout = async (req, res) => {
    const user_id = req.user.id;
    const { advance_paid, payment_method = "cash" } = req.body;
    if (!["cash", "online"].includes(payment_method))
        return res.status(400).json({ error: "Invalid payment method." });

    const t = await sequelize.transaction();
    try {
        const built = await buildFromCart(user_id, t);
        if (!built) { await t.rollback(); return res.status(400).json({ error: "Cart is empty." }); }
        const { total_amount, all_items_available, itemsData } = built;

        const minAdvance = parseFloat((total_amount * MIN_ADVANCE_PCT).toFixed(2));
        const advance = parseFloat(advance_paid);
        if (isNaN(advance) || advance < minAdvance) {
            await t.rollback();
            return res.status(400).json({
                error: `Minimum advance is 20% (₹${minAdvance}). Order total: ₹${total_amount}.`,
            });
        }
        if (advance > total_amount + 0.01) {
            await t.rollback();
            return res.status(400).json({ error: "Advance cannot exceed the total." });
        }

        const order = await Order.create({
            user_id,
            total_amount,
            advance_paid: 0,                 // becomes non-zero only once confirmed
            advance_payment_mode: payment_method,
            payment_status: "unpaid",
            all_items_available,
            is_made_to_order: !all_items_available,
            order_status: payment_method === "online" ? "awaiting_payment" : "pending",
            stock_committed: false,
            advance_confirmed: false,
        }, { transaction: t });

        for (const item of itemsData) {
            await OrderItem.create({ order_id: order.id, ...item }, { transaction: t });
        }

        // advance payment record (pending until confirmed)
        const payment = await Payment.create({
            order_id: order.id,
            payment_type: "advance",
            method: payment_method,
            amount: advance,
            status: "pending",
            gateway: payment_method === "cash" ? "cash" : null,
        }, { transaction: t });
        await payment.update({ slip_no: slipNo(order.id, "advance", payment.id) }, { transaction: t });

        // clear cart (order is now placed/awaiting payment)
        await Cart.destroy({ where: { user_id }, transaction: t });

        if (payment_method === "cash") {
            await notifyAdmin("advance_pending",
                `New cash order #${order.id}`,
                `Advance ₹${advance} to be confirmed for order #${order.id}.`,
                order.id, t);
            await t.commit();
            dispatchOrderEvent("order_placed", order.id, { advance });
            return res.status(201).json({
                mode: "cash",
                order_id: order.id,
                message: "Order placed. Awaiting admin confirmation of your advance payment.",
            });
        }

        // online: create gateway order
        const gw = await createGatewayOrder({
            amount: advance,
            receipt: `adv_${order.id}`,
            notes: { order_id: order.id, type: "advance" },
        });
        await payment.update({ gateway: gw.gateway, gateway_order_id: gw.gateway_order_id }, { transaction: t });

        await t.commit();
        return res.status(201).json({
            mode: "online",
            order_id: order.id,
            payment_id: payment.id,
            gateway: gw.gateway,
            key_id: gw.key_id,
            gateway_order_id: gw.gateway_order_id,
            amount: gw.amount,           // in paise
            simulated: gw.simulated,
        });
    } catch (err) {
        await t.rollback();
        console.error("checkout error:", err.message);
        return res.status(500).json({ error: "Failed to place order." });
    }
};

// =====================================================================
// POST /api/orders/:id/verify-payment   (advance, online)
// body: { payment_id, gateway_payment_id, signature }
// =====================================================================
const verifyAdvancePayment = async (req, res) => {
    const { payment_id, gateway_payment_id, signature } = req.body;
    const t = await sequelize.transaction();
    try {
        const order = await Order.findOne({
            where: { id: req.params.id, user_id: req.user.id },
            include: [{ model: OrderItem, as: "items" }],
            transaction: t,
        });
        if (!order) { await t.rollback(); return res.status(404).json({ error: "Order not found." }); }

        const payment = await Payment.findOne({
            where: { id: payment_id, order_id: order.id, payment_type: "advance" }, transaction: t,
        });
        if (!payment) { await t.rollback(); return res.status(404).json({ error: "Payment not found." }); }

        // Idempotent: a replayed/duplicate verify must not re-progress the order.
        if (payment.status === "confirmed") {
            await t.commit();
            return res.json({ message: "Payment already confirmed.", order_id: order.id });
        }
        // Online advance only applies while the order is awaiting its advance.
        if (order.order_status !== "awaiting_payment") {
            await t.rollback();
            return res.status(400).json({ error: "Order is not awaiting payment." });
        }

        const ok = verifyPaymentSignature({
            gateway_order_id: payment.gateway_order_id, gateway_payment_id, signature,
        });
        if (!ok) {
            await payment.update({ status: "failed" }, { transaction: t });
            await t.commit();
            return res.status(400).json({ error: "Payment verification failed." });
        }

        await payment.update({
            status: "confirmed", gateway_payment_id, gateway_signature: signature, confirmed_at: new Date(),
        }, { transaction: t });

        await confirmAdvanceAndProgress(order, parseFloat(payment.amount), "online", t);

        await t.commit();
        dispatchOrderEvent("advance_confirmed", order.id);
        return res.json({ message: "Payment successful. Order confirmed.", order_id: order.id });
    } catch (err) {
        await t.rollback();
        console.error("verifyAdvancePayment error:", err.message);
        return res.status(500).json({ error: "Failed to verify payment." });
    }
};

// Shared: once an advance is confirmed (cash-approved or online), progress the order.
export async function confirmAdvanceAndProgress(order, advanceAmount, mode, t) {
    await commitStock(order, order.items, t);

    const today = new Date();
    let order_status, tentative_delivery_date = null, final_delivery_date = null;
    if (order.all_items_available) {
        order_status = "ready_for_pickup";
        final_delivery_date = today.toISOString().split("T")[0];
        tentative_delivery_date = final_delivery_date;
    } else {
        order_status = "in_production";
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        tentative_delivery_date = tomorrow.toISOString().split("T")[0];
    }

    const newAdvance = parseFloat(advanceAmount);
    const fullyPaid = newAdvance >= parseFloat(order.total_amount) - 0.01;

    await order.update({
        advance_paid: newAdvance,
        advance_payment_mode: mode,
        advance_confirmed: true,
        advance_confirmed_at: new Date(),
        payment_status: fullyPaid ? "fully_paid" : "advance_paid",
        order_status,
        tentative_delivery_date,
        final_delivery_date,
        updated_at: new Date(),
    }, { transaction: t });

    await notifyAdmin("order_confirmed",
        `Order #${order.id} confirmed`,
        `Advance ₹${newAdvance} confirmed (${mode}).`,
        order.id, t);
}

// =====================================================================
// POST /api/orders/:id/pay-advance/online  (retry advance for awaiting_payment)
// =====================================================================
const payAdvanceOnline = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const order = await Order.findOne({ where: { id: req.params.id, user_id: req.user.id }, transaction: t });
        if (!order || order.order_status !== "awaiting_payment") {
            await t.rollback(); return res.status(400).json({ error: "Order is not awaiting payment." });
        }
        let payment = await Payment.findOne({
            where: { order_id: order.id, payment_type: "advance", status: "pending" }, transaction: t,
        });
        const amount = payment ? parseFloat(payment.amount) : parseFloat((order.total_amount * MIN_ADVANCE_PCT).toFixed(2));
        const gw = await createGatewayOrder({ amount, receipt: `adv_${order.id}`, notes: { order_id: order.id } });
        if (!payment) {
            payment = await Payment.create({
                order_id: order.id, payment_type: "advance", method: "online", amount,
                status: "pending", gateway: gw.gateway, gateway_order_id: gw.gateway_order_id,
            }, { transaction: t });
            await payment.update({ slip_no: slipNo(order.id, "advance", payment.id) }, { transaction: t });
        } else {
            await payment.update({ gateway: gw.gateway, gateway_order_id: gw.gateway_order_id, method: "online" }, { transaction: t });
        }
        await t.commit();
        return res.json({
            order_id: order.id, payment_id: payment.id, gateway: gw.gateway,
            key_id: gw.key_id, gateway_order_id: gw.gateway_order_id, amount: gw.amount, simulated: gw.simulated,
        });
    } catch (err) {
        await t.rollback();
        return res.status(500).json({ error: "Failed to initiate payment." });
    }
};

// =====================================================================
// POST /api/orders/:id/pay-final/online  (customer pays balance online)
// =====================================================================
const payFinalOnline = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const order = await Order.findOne({ where: { id: req.params.id, user_id: req.user.id }, transaction: t });
        if (!order) { await t.rollback(); return res.status(404).json({ error: "Order not found." }); }
        // Only a placed (advance-confirmed), non-cancelled order can take a balance payment.
        if (!FINAL_PAYABLE_STATUSES.includes(order.order_status)) {
            await t.rollback(); return res.status(400).json({ error: "This order is not awaiting a balance payment." });
        }
        const balance = parseFloat(order.total_amount) - parseFloat(order.advance_paid) - parseFloat(order.final_paid);
        if (balance <= 0.01) { await t.rollback(); return res.status(400).json({ error: "Nothing left to pay." }); }
        // Razorpay (and most gateways) require a minimum of ₹1. Tiny residual
        // balances can only be settled in cash at the store.
        if (balance < 1) {
            await t.rollback();
            return res.status(400).json({ error: `This balance (₹${balance.toFixed(2)}) is too small to pay online. Please pay it in cash at the store.` });
        }

        const gw = await createGatewayOrder({ amount: balance, receipt: `fin_${order.id}`, notes: { order_id: order.id, type: "final" } });
        // Reuse an open pending final payment instead of creating duplicates.
        let payment = await Payment.findOne({
            where: { order_id: order.id, payment_type: "final", status: "pending" }, transaction: t,
        });
        if (!payment) {
            payment = await Payment.create({
                order_id: order.id, payment_type: "final", method: "online", amount: balance,
                status: "pending", gateway: gw.gateway, gateway_order_id: gw.gateway_order_id,
            }, { transaction: t });
            await payment.update({ slip_no: slipNo(order.id, "final", payment.id) }, { transaction: t });
        } else {
            await payment.update({
                amount: balance, method: "online", gateway: gw.gateway, gateway_order_id: gw.gateway_order_id,
            }, { transaction: t });
        }
        await t.commit();
        return res.json({
            order_id: order.id, payment_id: payment.id, gateway: gw.gateway,
            key_id: gw.key_id, gateway_order_id: gw.gateway_order_id, amount: gw.amount, simulated: gw.simulated,
        });
    } catch (err) {
        await t.rollback();
        return res.status(500).json({ error: "Failed to initiate final payment." });
    }
};

// =====================================================================
// POST /api/orders/:id/pay-final/cash  (customer requests to pay balance in cash)
// Creates/updates a PENDING final payment and notifies the admin to confirm on
// collection — mirrors the cash-advance "request + admin approval" flow.
// =====================================================================
const requestCashDue = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const order = await Order.findOne({ where: { id: req.params.id, user_id: req.user.id }, transaction: t });
        if (!order) { await t.rollback(); return res.status(404).json({ error: "Order not found." }); }
        if (!FINAL_PAYABLE_STATUSES.includes(order.order_status)) {
            await t.rollback(); return res.status(400).json({ error: "This order is not awaiting a balance payment." });
        }
        const balance = parseFloat(order.total_amount) - parseFloat(order.advance_paid) - parseFloat(order.final_paid);
        if (balance <= 0.01) { await t.rollback(); return res.status(400).json({ error: "Nothing left to pay." }); }

        // Reuse the open pending final payment (if any) so cash/online stay one row.
        let payment = await Payment.findOne({
            where: { order_id: order.id, payment_type: "final", status: "pending" }, transaction: t,
        });
        if (!payment) {
            payment = await Payment.create({
                order_id: order.id, payment_type: "final", method: "cash", amount: balance,
                status: "pending", gateway: "cash",
            }, { transaction: t });
            await payment.update({ slip_no: slipNo(order.id, "final", payment.id) }, { transaction: t });
        } else {
            await payment.update({ method: "cash", gateway: "cash", amount: balance, gateway_order_id: null }, { transaction: t });
        }

        await notifyAdmin("due_cash_requested", `Cash due requested — order #${order.id}`,
            `Customer wants to pay the ₹${balance.toFixed(2)} balance in cash. Confirm once received.`, order.id, t);

        await t.commit();
        return res.json({ message: "Cash payment requested. The store will confirm once received.", order_id: order.id });
    } catch (err) {
        await t.rollback();
        console.error("requestCashDue error:", err.message);
        return res.status(500).json({ error: "Failed to request cash payment." });
    }
};

// POST /api/orders/:id/verify-final-payment
const verifyFinalPayment = async (req, res) => {
    const { payment_id, gateway_payment_id, signature } = req.body;
    const t = await sequelize.transaction();
    try {
        const order = await Order.findOne({ where: { id: req.params.id, user_id: req.user.id }, transaction: t });
        if (!order) { await t.rollback(); return res.status(404).json({ error: "Order not found." }); }
        const payment = await Payment.findOne({
            where: { id: payment_id, order_id: order.id, payment_type: "final" }, transaction: t,
        });
        if (!payment) { await t.rollback(); return res.status(404).json({ error: "Payment not found." }); }

        // Idempotent: a replayed/duplicate verify must not add the amount twice.
        if (payment.status === "confirmed") {
            await t.commit();
            return res.json({ message: "Payment already confirmed.", order_id: order.id });
        }
        if (!FINAL_PAYABLE_STATUSES.includes(order.order_status)) {
            await t.rollback(); return res.status(400).json({ error: "This order is not awaiting a balance payment." });
        }

        const ok = verifyPaymentSignature({ gateway_order_id: payment.gateway_order_id, gateway_payment_id, signature });
        if (!ok) {
            await payment.update({ status: "failed" }, { transaction: t });
            await t.commit();
            return res.status(400).json({ error: "Payment verification failed." });
        }
        await payment.update({ status: "confirmed", gateway_payment_id, gateway_signature: signature, confirmed_at: new Date() }, { transaction: t });

        // Cap so advance + final can never exceed the order total.
        const maxFinal = parseFloat(order.total_amount) - parseFloat(order.advance_paid);
        const newFinal = Math.min(parseFloat(order.final_paid) + parseFloat(payment.amount), maxFinal);
        const fullyPaid = parseFloat(order.advance_paid) + newFinal >= parseFloat(order.total_amount) - 0.01;
        await order.update({
            final_paid: newFinal,
            final_payment_mode: "online",
            final_confirmed: fullyPaid,
            final_confirmed_at: fullyPaid ? new Date() : order.final_confirmed_at,
            payment_status: fullyPaid ? "fully_paid" : (order.order_status === "delivered" ? "pending_after_delivery" : "advance_paid"),
            updated_at: new Date(),
        }, { transaction: t });

        await notifyAdmin("final_paid", `Order #${order.id} balance paid online`,
            `Customer paid balance ₹${payment.amount} online. Ready for handover.`, order.id, t);

        await t.commit();
        dispatchOrderEvent("payment_received", order.id, { amount: payment.amount });
        return res.json({ message: "Balance paid. Thank you!", order_id: order.id });
    } catch (err) {
        await t.rollback();
        return res.status(500).json({ error: "Failed to verify final payment." });
    }
};

const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.findAll({
            where: { user_id: req.user.id },
            include: [
                {
                    model: OrderItem, as: "items",
                    include: [
                        { model: Product, as: "product", include: [{ model: ProductImage, as: "images", where: { is_cover: true }, required: false }] },
                        { model: ProductVariant, as: "variant" },
                    ],
                },
                { model: Payment, as: "payments" },
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
                { model: OrderItem, as: "items", include: [{ model: Product, as: "product", include: [{ model: ProductImage, as: "images" }] }, { model: ProductVariant, as: "variant" }] },
                { model: Payment, as: "payments" },
            ],
        });
        if (!order) return res.status(404).json({ error: "Order not found." });
        return res.json({ order });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch order." });
    }
};

// Cancellation keeps the record (orders are never deleted).
const cancelOrder = async (req, res) => {
    const { cancellation_reason } = req.body;
    const t = await sequelize.transaction();
    try {
        const order = await Order.findOne({
            where: { id: req.params.id, user_id: req.user.id },
            include: [{ model: OrderItem, as: "items" }],
            transaction: t,
        });
        if (!order) { await t.rollback(); return res.status(404).json({ error: "Order not found." }); }
        if (!["awaiting_payment", "pending", "confirmed"].includes(order.order_status)) {
            await t.rollback();
            return res.status(400).json({ error: "This order can no longer be cancelled online. Please contact us." });
        }

        await releaseStock(order, order.items, t);
        await order.update({
            order_status: "cancelled",
            payment_status: parseFloat(order.advance_paid) > 0 ? "refunded" : order.payment_status,
            cancellation_reason: cancellation_reason || "Cancelled by customer",
            updated_at: new Date(),
        }, { transaction: t });

        await notifyAdmin("order_cancelled", `Order #${order.id} cancelled`,
            `Customer cancelled order #${order.id}.`, order.id, t);

        await t.commit();
        return res.json({ message: "Order cancelled. Any advance paid will be refunded by admin." });
    } catch (err) {
        await t.rollback();
        console.error("cancelOrder error:", err.message);
        return res.status(500).json({ error: "Failed to cancel order." });
    }
};

export {
    checkout, verifyAdvancePayment, payAdvanceOnline,
    payFinalOnline, requestCashDue, verifyFinalPayment,
    getMyOrders, getOrderById, cancelOrder,
};
