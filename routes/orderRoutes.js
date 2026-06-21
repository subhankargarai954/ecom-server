import express from "express";
import {
    checkout, verifyAdvancePayment, payAdvanceOnline,
    payFinalOnline, requestCashDue, verifyFinalPayment,
    getMyOrders, getOrderById, cancelOrder,
} from "../controllers/orderController.js";
import { getInvoiceData, downloadInvoicePdf } from "../controllers/invoiceController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { publicKey, isLive } from "../services/razorpayService.js";

const router = express.Router();

// Public: expose the gateway public key + mode so the client can open checkout
router.get("/payment-config", (req, res) => res.json({ key_id: publicKey(), live: isLive() }));

router.use(authMiddleware);
router.post("/checkout", checkout);
router.get("/", getMyOrders);
router.get("/:id", getOrderById);
router.get("/:id/invoice", getInvoiceData(false));
router.get("/:id/invoice.pdf", downloadInvoicePdf(false));
router.post("/:id/verify-payment", verifyAdvancePayment);
router.post("/:id/pay-advance/online", payAdvanceOnline);
router.post("/:id/pay-final/online", payFinalOnline);
router.post("/:id/pay-final/cash", requestCashDue);
router.post("/:id/verify-final-payment", verifyFinalPayment);
router.put("/:id/cancel", cancelOrder);

export default router;
