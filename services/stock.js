import { Op, fn, col } from "sequelize";
import { OrderItem, Order } from "../models/index.js";

// An order holds a stock RESERVATION once its advance is confirmed and until it
// is delivered (or cancelled). Reservations are derived from order status — we
// do NOT decrement physical stock at confirmation. Physical stock
// (Product/Variant.available_quantity) is the on-hand count the admin manages,
// and the quantity shown to customers is `on_hand − reserved`.
export const RESERVING_STATUSES = ["confirmed", "in_production", "ready_for_pickup"];

const keyFor = (product_id, variant_id) => `${product_id}:${variant_id || 0}`;

// Build a Map of `${product_id}:${variant_id|0}` -> total reserved quantity
// across all confirmed-but-undelivered orders. Optionally scope to product ids.
export async function getReservedMap(productIds = null, transaction = null) {
    const itemWhere = {};
    if (productIds && productIds.length) itemWhere.product_id = { [Op.in]: productIds };

    const rows = await OrderItem.findAll({
        attributes: ["product_id", "variant_id", [fn("SUM", col("quantity")), "reserved"]],
        where: itemWhere,
        include: [{
            model: Order, as: "order", attributes: [], required: true,
            where: { advance_confirmed: true, order_status: { [Op.in]: RESERVING_STATUSES } },
        }],
        group: ["product_id", "variant_id"],
        raw: true,
        transaction,
    });

    const map = new Map();
    for (const r of rows) map.set(keyFor(r.product_id, r.variant_id), parseInt(r.reserved, 10) || 0);
    return map;
}

export const reservedFor = (map, product_id, variant_id) => map.get(keyFor(product_id, variant_id)) || 0;

// Quantity free for new customers to order.
export const shownAvailable = (onHand, reserved) =>
    Math.max(0, (parseInt(onHand, 10) || 0) - (reserved || 0));
