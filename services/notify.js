import dotenv from "dotenv";
import { Order, OrderItem, Payment, Product, ProductImage, User, MessageLog } from "../models/index.js";
import { sendSMS, sendWhatsApp, isLive } from "./messagingService.js";
import { hostInvoicePdf, coverImageUrls } from "./mediaStore.js";
dotenv.config();

const STORE = process.env.STORE_NAME || "MyStore";
const CLIENT_BASE = (process.env.CLIENT_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const inr = (n) => "₹" + Number(n || 0).toFixed(2);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");
const productLink = (id) => `${CLIENT_BASE}/products/${id}`;

const ORDER_INCLUDE = [
    { model: User, as: "user", attributes: ["id", "name", "phone", "email", "address"] },
    {
        model: OrderItem, as: "items",
        include: [
            { model: Product, as: "product", include: [{ model: ProductImage, as: "images" }] },
        ],
    },
    { model: Payment, as: "payments" },
];

// Bilingual (English + বাংলা) item list with portal links for WhatsApp.
function itemLines(order) {
    return (order.items || [])
        .map((it) => {
            const name = it.product?.name || "Product";
            const link = it.product?.id ? `\n   🔗 ${productLink(it.product.id)}` : "";
            return `• ${name} × ${it.quantity} — ${inr(parseFloat(it.unit_price) * it.quantity)}${link}`;
        })
        .join("\n");
}

function statusLineBilingual(order) {
    if (order.order_status === "in_production")
        return ["In production — we'll update you when ready.", "তৈরি হচ্ছে — প্রস্তুত হলে জানানো হবে।"];
    if (order.order_status === "ready_for_pickup")
        return ["Ready for pickup.", "পিকআপের জন্য প্রস্তুত।"];
    return ["", ""];
}

// Build { text, media } for an event. `text` is shared by SMS (plain) and
// WhatsApp; `media` (URLs) is WhatsApp-only.
async function buildMessages(event, order, extra) {
    const id = order.id;
    const total = parseFloat(order.total_amount);
    const advance = parseFloat(order.advance_paid);
    const final = parseFloat(order.final_paid);
    const paid = advance + final;
    const balance = Math.max(0, total - paid);

    switch (event) {
        case "order_placed": {
            const text =
                `${STORE}: Order #${id} received! Total ${inr(total)}, advance ${inr(extra.advance ?? advance)} (cash). ` +
                `We'll confirm your advance and start your order shortly.\n\n` +
                `অর্ডার #${id} গৃহীত হয়েছে! মোট ${inr(total)}, অগ্রিম ${inr(extra.advance ?? advance)} (নগদ)। ` +
                `অগ্রিম নিশ্চিত করে শীঘ্রই কাজ শুরু করা হবে।\n\n${itemLines(order)}`;
            return { text, media: coverImageUrls(order) };
        }
        case "advance_confirmed": {
            const [enS, bnS] = statusLineBilingual(order);
            const dateEN = order.tentative_delivery_date ? ` Tentative ready: ${fmtDate(order.tentative_delivery_date)}.` : "";
            const dateBN = order.tentative_delivery_date ? ` সম্ভাব্য প্রস্তুতির তারিখ: ${fmtDate(order.tentative_delivery_date)}।` : "";
            const balLine = balance > 0.01 ? ` Balance ${inr(balance)} due at pickup.` : ` Fully paid.`;
            const balLineBN = balance > 0.01 ? ` পিকআপে বাকি ${inr(balance)}।` : ` সম্পূর্ণ পরিশোধিত।`;
            const text =
                `${STORE}: Order #${id} CONFIRMED ✅ Advance ${inr(advance)} received. ${enS}${dateEN}${balLine}\n\n` +
                `অর্ডার #${id} নিশ্চিত হয়েছে ✅ অগ্রিম ${inr(advance)} পাওয়া গেছে। ${bnS}${dateBN}${balLineBN}`;
            return { text, media: coverImageUrls(order) };
        }
        case "order_ready": {
            const balLine = balance > 0.01 ? ` Please bring balance ${inr(balance)} at pickup.` : ` Already fully paid.`;
            const balLineBN = balance > 0.01 ? ` পিকআপে বাকি ${inr(balance)} আনবেন।` : ` সম্পূর্ণ পরিশোধিত।`;
            const text =
                `${STORE}: Good news! Order #${id} is READY for pickup 📦.${balLine}\n\n` +
                `সুখবর! অর্ডার #${id} পিকআপের জন্য প্রস্তুত 📦।${balLineBN}`;
            return { text, media: [] };
        }
        case "payment_received": {
            // advance top-up, final balance, or due collection
            const amt = extra.amount != null ? parseFloat(extra.amount) : 0;
            const text =
                `${STORE}: Payment of ${inr(amt)} received for Order #${id}. ` +
                `Paid ${inr(paid)} of ${inr(total)}, balance ${inr(balance)}.\n\n` +
                `অর্ডার #${id}-এর জন্য ${inr(amt)} পেমেন্ট পাওয়া গেছে। ` +
                `${inr(total)}-এর মধ্যে ${inr(paid)} পরিশোধিত, বাকি ${inr(balance)}।`;
            return { text, media: [] };
        }
        case "order_completed": {
            const pdfUrl = await hostInvoicePdf(order);
            const inv = order.invoice_no || "INV-" + id;
            const payEN = balance > 0.01 ? `Paid ${inr(paid)} of ${inr(total)}, balance ${inr(balance)}.` : `Total ${inr(total)}, fully paid.`;
            const payBN = balance > 0.01 ? `${inr(total)}-এর মধ্যে ${inr(paid)} পরিশোধিত, বাকি ${inr(balance)}।` : `মোট ${inr(total)}, সম্পূর্ণ পরিশোধিত।`;
            const text =
                `${STORE}: Order #${id} completed 🎉 Thank you! ${payEN} Invoice ${inv} attached.\n\n` +
                `অর্ডার #${id} সম্পন্ন হয়েছে 🎉 ধন্যবাদ! ${payBN} চালান ${inv} সংযুক্ত।`;
            return { text, media: [pdfUrl, ...coverImageUrls(order, 2)] };
        }
        default:
            return null;
    }
}

async function logAndSend(order, user, channel, event, text, media) {
    const result =
        channel === "sms"
            ? await sendSMS(user.phone, text)
            : await sendWhatsApp(user.phone, text, media);
    try {
        await MessageLog.create({
            order_id: order.id,
            user_id: user.id,
            channel,
            event,
            to_phone: user.phone,
            body: text,
            media: media && media.length ? JSON.stringify(media.filter(Boolean)) : null,
            status: result.status,
            provider: isLive() ? "twilio" : "simulation",
            provider_sid: result.sid || null,
            error: result.error || null,
        });
    } catch (e) {
        console.error("MessageLog write error:", e.message);
    }
    return result;
}

// Fire SMS + WhatsApp for an order event. Safe to call WITHOUT awaiting
// (fire-and-forget): it never throws and never blocks the request. Call only
// AFTER the DB transaction has committed.
export function dispatchOrderEvent(event, orderId, extra = {}) {
    (async () => {
        try {
            const order = await Order.findByPk(orderId, { include: ORDER_INCLUDE });
            if (!order || !order.user) return;
            if (!order.user.phone) return;

            const built = await buildMessages(event, order, extra);
            if (!built) return;

            // SMS: text only. WhatsApp: text + media.
            await logAndSend(order, order.user, "sms", event, built.text, []);
            await logAndSend(order, order.user, "whatsapp", event, built.text, built.media || []);
        } catch (e) {
            console.error(`dispatchOrderEvent(${event}) error:`, e.message);
        }
    })();
}

// Used by the admin "resend" endpoint — awaits and returns a summary.
export async function dispatchOrderEventSync(event, orderId, extra = {}) {
    const order = await Order.findByPk(orderId, { include: ORDER_INCLUDE });
    if (!order || !order.user?.phone) return { ok: false, error: "No customer phone on file." };
    const built = await buildMessages(event, order, extra);
    if (!built) return { ok: false, error: "Unknown event." };
    const sms = await logAndSend(order, order.user, "sms", event, built.text, []);
    const wa = await logAndSend(order, order.user, "whatsapp", event, built.text, built.media || []);
    return { ok: true, sms: sms.status, whatsapp: wa.status };
}
