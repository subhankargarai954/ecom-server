import express from "express";
import {
    getAllOrders, getOrderById,
    confirmAdvance, startProduction, markReady, markDelivered,
    adminCancelOrder, markRefundIssued,
    getPendingDues, collectDue,
    getOrderMessages, resendMessage,
} from "../controllers/adminOrderController.js";
import { getInvoiceData, downloadInvoicePdf } from "../../controllers/invoiceController.js";
import { adminMiddleware } from "../../middleware/adminMiddleware.js";

const router = express.Router();
router.use(adminMiddleware);

router.get("/", getAllOrders);
router.get("/pending-dues", getPendingDues);
router.get("/:id", getOrderById);
router.get("/:id/invoice", getInvoiceData(true));
router.get("/:id/invoice.pdf", downloadInvoicePdf(true));
router.get("/:id/messages", getOrderMessages);
router.post("/:id/resend", resendMessage);
router.put("/:id/confirm-advance", confirmAdvance);
router.put("/:id/production", startProduction);
router.put("/:id/ready", markReady);
router.put("/:id/deliver", markDelivered);
router.put("/:id/cancel", adminCancelOrder);
router.put("/:id/refund", markRefundIssued);
router.put("/:id/collect-due", collectDue);

export default router;
