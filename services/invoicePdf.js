import PDFDocument from "pdfkit";

// Renders the invoice body onto a PDFDocument. Shared by the streaming
// (HTTP download) and buffer (WhatsApp attachment) variants below.
function renderInvoice(doc, order) {
    const inr = (n) => "Rs. " + Number(n).toFixed(2);
    const items = order.items || [];
    const total = parseFloat(order.total_amount);
    const advance = parseFloat(order.advance_paid);
    const final = parseFloat(order.final_paid);
    const paid = advance + final;
    const balance = Math.max(0, total - paid);

    // Header
    doc.fontSize(20).fillColor("#0a74d1").text("MyStore", { align: "left" });
    doc.fontSize(9).fillColor("#666").text("Cement Products — Pillars · PAT · DABBA & more");
    doc.moveDown(0.5);
    doc.fontSize(16).fillColor("#16202c").text("TAX INVOICE", { align: "right" });
    doc.fontSize(9).fillColor("#666")
        .text(`Invoice No: ${order.invoice_no || "INV-" + order.id}`, { align: "right" })
        .text(`Order #: ${order.id}`, { align: "right" })
        .text(`Date: ${new Date(order.actual_delivery_date || order.created_at).toLocaleDateString("en-IN")}`, { align: "right" });

    doc.moveDown();
    doc.strokeColor("#dddddd").moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);

    // Customer
    doc.fontSize(10).fillColor("#16202c").text("Bill To:", { continued: false });
    doc.fontSize(10).fillColor("#444")
        .text(order.user?.name || "")
        .text("Phone: " + (order.user?.phone || ""))
        .text(order.user?.address || "");
    doc.moveDown();

    // Table header
    const top = doc.y;
    doc.fontSize(9).fillColor("#16202c");
    doc.text("Product", 50, top, { width: 230 });
    doc.text("Unit", 285, top, { width: 70, align: "right" });
    doc.text("Qty", 360, top, { width: 50, align: "right" });
    doc.text("Amount", 430, top, { width: 115, align: "right" });
    doc.moveDown(0.3);
    doc.strokeColor("#dddddd").moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);

    items.forEach((it) => {
        const y = doc.y;
        const name = (it.product?.name || "Product") + (it.variant ? ` (${it.variant.variant_name})` : "");
        const unit = parseFloat(it.unit_price);
        const sub = unit * it.quantity;
        doc.fontSize(9).fillColor("#333");
        doc.text(name, 50, y, { width: 230 });
        doc.text(inr(unit), 285, y, { width: 70, align: "right" });
        doc.text(String(it.quantity), 360, y, { width: 50, align: "right" });
        doc.text(inr(sub), 430, y, { width: 115, align: "right" });
        doc.moveDown(0.5);
    });

    doc.moveDown(0.3);
    doc.strokeColor("#dddddd").moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);

    // Totals
    const totalsX = 360, valX = 430, w = 115;
    const row = (label, val, bold) => {
        const y = doc.y;
        doc.fontSize(bold ? 11 : 9).fillColor(bold ? "#16202c" : "#444");
        doc.text(label, totalsX, y, { width: 70, align: "right" });
        doc.text(val, valX, y, { width: w, align: "right" });
        doc.moveDown(0.4);
    };
    row("Total", inr(total), true);
    row("Advance Paid", inr(advance));
    if (final > 0) row("Paid at Delivery", inr(final));
    row("Balance Due", inr(balance), true);

    doc.moveDown(1.5);
    doc.fontSize(8).fillColor("#999")
        .text("This is a computer-generated invoice. Thank you for your business.", 50, doc.y, { align: "center", width: 495 });
}

// Builds the invoice PDF (English) and streams it to `res`.
// The fully bilingual (EN + বাংলা) bill is rendered by the printable web page;
// this server PDF is the reliable, storable one-click download.
export function streamInvoicePdf(order, res) {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);
    renderInvoice(doc, order);
    doc.end();
}

// Builds the same invoice PDF and resolves with a Buffer. Used to upload the
// bill to Cloudinary so it can be attached to a WhatsApp message.
export function invoicePdfBuffer(order) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 50 });
        const chunks = [];
        doc.on("data", (c) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
        renderInvoice(doc, order);
        doc.end();
    });
}
