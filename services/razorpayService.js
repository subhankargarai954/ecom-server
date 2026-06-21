import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

// Razorpay is OPTIONAL: if keys aren't configured the service runs in
// "simulation" mode so the whole online-payment flow is testable today.
// Add RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET to .env to go live (UPI, QR,
// cards, netbanking all supported by Razorpay Checkout).

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const LIVE = Boolean(KEY_ID && KEY_SECRET);

let razorpay = null;
if (LIVE) {
    const Razorpay = (await import("razorpay")).default;
    razorpay = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
}

export const isLive = () => LIVE;
export const publicKey = () => KEY_ID || "SIMULATION";

// Create a gateway order. Returns { gateway, gateway_order_id, key_id, amount }
export const createGatewayOrder = async ({ amount, receipt, notes }) => {
    const amountPaise = Math.round(parseFloat(amount) * 100);

    if (!LIVE) {
        // Simulation: fabricate an order id; the client "pays" instantly.
        return {
            gateway: "simulated",
            gateway_order_id: `sim_order_${Date.now()}`,
            key_id: "SIMULATION",
            amount: amountPaise,
            simulated: true,
        };
    }

    const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: receipt?.slice(0, 40),
        notes,
    });
    return {
        gateway: "razorpay",
        gateway_order_id: order.id,
        key_id: KEY_ID,
        amount: amountPaise,
        simulated: false,
    };
};

// Verify the signature returned by Razorpay Checkout after a successful pay.
// In simulation mode this always succeeds.
export const verifyPaymentSignature = ({ gateway_order_id, gateway_payment_id, signature }) => {
    if (!LIVE) return true; // simulated payments are auto-verified

    const expected = crypto
        .createHmac("sha256", KEY_SECRET)
        .update(`${gateway_order_id}|${gateway_payment_id}`)
        .digest("hex");
    return expected === signature;
};
