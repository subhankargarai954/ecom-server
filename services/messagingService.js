import dotenv from "dotenv";
dotenv.config();

// Twilio SMS + WhatsApp is OPTIONAL. With no credentials the service runs in
// "simulation" mode: every message is logged to the console (and recorded in
// message_logs) so the whole notification flow is testable today. Add the
// TWILIO_* keys to .env to start delivering real messages.
//
// SMS  -> plain text only.
// WhatsApp -> text + media (bill PDF, product cover images) via public URLs.

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const SMS_FROM = process.env.TWILIO_SMS_FROM;            // e.g. +15017122661
const WA_FROM = process.env.TWILIO_WHATSAPP_FROM;        // e.g. whatsapp:+14155238886
const COUNTRY_CODE = process.env.SMS_COUNTRY_CODE || "+91";

const LIVE = Boolean(SID && TOKEN);

let client = null;
if (LIVE) {
    const twilio = (await import("twilio")).default;
    client = twilio(SID, TOKEN);
}

export const isLive = () => LIVE;

// Normalise a stored 10-digit number to E.164 (e.g. 9876543210 -> +919876543210).
export function toE164(phone) {
    if (!phone) return null;
    const digits = String(phone).replace(/\D/g, "");
    if (String(phone).trim().startsWith("+")) return "+" + digits;
    if (digits.length === 10) return `${COUNTRY_CODE}${digits}`;
    if (digits.length > 10) return `+${digits}`;
    return null;
}

const waAddr = (from) => (from?.startsWith("whatsapp:") ? from : `whatsapp:${from}`);

// Returns { status: "sent"|"failed"|"simulated", sid, error }
export async function sendSMS(toPhone, body) {
    const to = toE164(toPhone);
    if (!to) return { status: "failed", error: "Invalid phone number." };

    if (!LIVE || !SMS_FROM) {
        console.log(`\n[SIM SMS] -> ${to}\n${body}\n`);
        return { status: "simulated", sid: `sim_sms_${Date.now()}` };
    }
    try {
        const msg = await client.messages.create({ from: SMS_FROM, to, body });
        return { status: "sent", sid: msg.sid };
    } catch (e) {
        console.error("sendSMS error:", e.message);
        return { status: "failed", error: e.message };
    }
}

export async function sendWhatsApp(toPhone, body, mediaUrls = []) {
    const to = toE164(toPhone);
    if (!to) return { status: "failed", error: "Invalid phone number." };
    const media = (mediaUrls || []).filter(Boolean).slice(0, 10);

    if (!LIVE || !WA_FROM) {
        console.log(`\n[SIM WhatsApp] -> ${to}\n${body}${media.length ? "\n[media] " + media.join(", ") : ""}\n`);
        return { status: "simulated", sid: `sim_wa_${Date.now()}` };
    }
    try {
        const payload = { from: waAddr(WA_FROM), to: waAddr(to), body };
        if (media.length) payload.mediaUrl = media;
        const msg = await client.messages.create(payload);
        return { status: "sent", sid: msg.sid };
    } catch (e) {
        console.error("sendWhatsApp error:", e.message);
        return { status: "failed", error: e.message };
    }
}
