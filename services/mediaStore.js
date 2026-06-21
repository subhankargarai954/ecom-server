import { cloudinary } from "../middleware/upload.js";
import { invoicePdfBuffer } from "./invoicePdf.js";

// WhatsApp can only attach media from a PUBLIC URL. We render the invoice PDF
// to a buffer and upload it to Cloudinary as a `raw` resource, which gives us a
// public secure_url. This doubles as permanent storage of every bill.
export async function hostInvoicePdf(order) {
    if (!process.env.CLOUDINARY_CLOUD_NAME) return null; // Cloudinary not configured
    try {
        const buffer = await invoicePdfBuffer(order);
        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    resource_type: "raw",
                    folder: "ecom-invoices",
                    public_id: `invoice-${order.invoice_no || order.id}.pdf`,
                    overwrite: true,
                },
                (err, res) => (err ? reject(err) : resolve(res))
            );
            stream.end(buffer);
        });
        return result.secure_url;
    } catch (e) {
        console.error("hostInvoicePdf error:", e.message);
        return null;
    }
}

// Collect public cover-image URLs for the products in an order (de-duplicated,
// capped) so they can be attached to WhatsApp as "product details".
export function coverImageUrls(order, max = 4) {
    const urls = [];
    for (const it of order.items || []) {
        const imgs = it.product?.images || [];
        const cover = imgs.find((i) => i.is_cover) || imgs[0];
        const url = cover?.image_url;
        if (url && !urls.includes(url)) urls.push(url);
        if (urls.length >= max) break;
    }
    return urls;
}
