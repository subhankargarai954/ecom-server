import { Order, OrderItem, Payment, Product, ProductVariant, User } from "../models/index.js";
import { streamInvoicePdf } from "../services/invoicePdf.js";

const FULL_INCLUDE = [
    { model: User, as: "user", attributes: ["id", "name", "phone", "email", "address"] },
    { model: OrderItem, as: "items", include: [
        { model: Product, as: "product" }, { model: ProductVariant, as: "variant" },
    ] },
    { model: Payment, as: "payments" },
];

async function loadOrder(id, userId) {
    const where = { id };
    if (userId) where.user_id = userId;           // customers can only see their own
    return Order.findOne({ where, include: FULL_INCLUDE });
}

// Structured invoice data (the bilingual page is rendered on the frontend).
export const getInvoiceData = (forAdmin) => async (req, res) => {
    try {
        const order = await loadOrder(req.params.id, forAdmin ? null : req.user.id);
        if (!order) return res.status(404).json({ error: "Order not found." });
        return res.json({ order });
    } catch (err) {
        return res.status(500).json({ error: "Failed to load invoice." });
    }
};

// One-click PDF download (English).
export const downloadInvoicePdf = (forAdmin) => async (req, res) => {
    try {
        const order = await loadOrder(req.params.id, forAdmin ? null : req.user.id);
        if (!order) return res.status(404).json({ error: "Order not found." });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="invoice-${order.invoice_no || order.id}.pdf"`);
        streamInvoicePdf(order, res);
    } catch (err) {
        console.error("downloadInvoicePdf error:", err.message);
        if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF." });
    }
};
