import { Product, ProductVariant, Notification, Payment } from "../models/index.js";

// Decrement stock for the available items of an order (only once).
export const commitStock = async (order, items, t) => {
    if (order.stock_committed) return;
    for (const item of items) {
        if (item.was_available_at_order) {
            if (item.variant_id) {
                await ProductVariant.decrement("available_quantity", {
                    by: item.quantity, where: { id: item.variant_id }, transaction: t,
                });
            } else {
                await Product.decrement("available_quantity", {
                    by: item.quantity, where: { id: item.product_id }, transaction: t,
                });
            }
        }
    }
    await order.update({ stock_committed: true }, { transaction: t });
};

// Restore stock if a committed order is cancelled.
export const releaseStock = async (order, items, t) => {
    if (!order.stock_committed) return;
    for (const item of items) {
        if (item.was_available_at_order) {
            if (item.variant_id) {
                await ProductVariant.increment("available_quantity", {
                    by: item.quantity, where: { id: item.variant_id }, transaction: t,
                });
            } else {
                await Product.increment("available_quantity", {
                    by: item.quantity, where: { id: item.product_id }, transaction: t,
                });
            }
        }
    }
    await order.update({ stock_committed: false }, { transaction: t });
};

export const notifyAdmin = async (type, title, message, order_id, t) => {
    try {
        await Notification.create({ type, title, message, order_id }, { transaction: t });
    } catch (e) { console.error("notifyAdmin error:", e.message); }
};

export const genSlipNo = async (order_id, payment_type, t) => {
    const count = await Payment.count({ where: { order_id, payment_type }, transaction: t });
    const prefix = payment_type === "advance" ? "ADV" : "FIN";
    return `${prefix}-${order_id}-${count + 1}`;
};

export const genInvoiceNo = (order) => {
    const year = new Date(order.created_at || Date.now()).getFullYear();
    return `INV-${year}-${String(order.id).padStart(5, "0")}`;
};

// Derive payment_status from amounts.
export const derivePaymentStatus = (order) => {
    const total = parseFloat(order.total_amount);
    const paid = parseFloat(order.advance_paid) + parseFloat(order.final_paid);
    if (order.order_status === "cancelled") return order.payment_status; // keep refunded/etc
    if (paid <= 0) return "unpaid";
    if (paid >= total - 0.01) return "fully_paid";
    if (order.order_status === "delivered") return "pending_after_delivery";
    return "advance_paid";
};
