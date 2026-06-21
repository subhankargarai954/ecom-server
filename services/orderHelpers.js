import { literal } from "sequelize";
import { Product, ProductVariant, Notification, Payment } from "../models/index.js";

// A confirmed order RESERVES stock dynamically (see services/stock.js) rather
// than decrementing physical on-hand. This just records that the order now holds
// a reservation; the reserved quantity is computed from order status.
export const commitStock = async (order, items, t) => {
    if (order.stock_committed) return;
    await order.update({ stock_committed: true }, { transaction: t });
};

// Cancelling a confirmed order drops its reservation. Because reservations are
// derived from order status, no quantity needs to be returned — just clear the
// flag (the order is being moved to "cancelled" by the caller).
export const releaseStock = async (order, items, t) => {
    if (!order.stock_committed) return;
    await order.update({ stock_committed: false }, { transaction: t });
};

// On delivery the goods physically leave, so decrement on-hand stock. Floored at
// 0 with GREATEST so it can never go negative even if stock changed since
// mark-ready.
export const consumeStock = async (order, items, t) => {
    for (const item of items) {
        const Model = item.variant_id ? ProductVariant : Product;
        const id = item.variant_id || item.product_id;
        const qty = parseInt(item.quantity, 10) || 0;
        if (!qty) continue;
        await Model.update(
            { available_quantity: literal(`GREATEST(0, available_quantity - ${qty})`) },
            { where: { id }, transaction: t }
        );
    }
};

export const notifyAdmin = async (type, title, message, order_id, t) => {
    try {
        await Notification.create({ type, title, message, order_id, audience: "admin" }, { transaction: t });
    } catch (e) { console.error("notifyAdmin error:", e.message); }
};

// In-app notification for a specific customer (their order bell).
export const notifyCustomer = async (user_id, type, title, message, order_id, t) => {
    try {
        await Notification.create({ type, title, message, order_id, audience: "customer", user_id }, { transaction: t });
    } catch (e) { console.error("notifyCustomer error:", e.message); }
};

// Slip number derived from the payment's own auto-increment id — globally unique
// and race-free (the old count()+1 scheme could collide under concurrency).
export const slipNo = (order_id, payment_type, payment_id) =>
    `${payment_type === "advance" ? "ADV" : "FIN"}-${order_id}-${payment_id}`;

export const genInvoiceNo = (order) => {
    const year = new Date(order.created_at || Date.now()).getFullYear();
    return `INV-${year}-${String(order.id).padStart(5, "0")}`;
};
