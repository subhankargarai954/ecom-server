import express from "express";
import {
    getAllOrders, getOrderById,
    confirmOrder, setFinalDeliveryDate, markDelivered,
    adminCancelOrder, markRefundIssued,
    getPendingDues, collectDue,
} from "../controllers/adminOrderController.js";
import { adminMiddleware } from "../../middleware/adminMiddleware.js";

const router = express.Router();
router.use(adminMiddleware);

router.get("/", getAllOrders);
router.get("/pending-dues", getPendingDues);
router.get("/:id", getOrderById);
router.put("/:id/confirm", confirmOrder);
router.put("/:id/delivery-date", setFinalDeliveryDate);
router.put("/:id/deliver", markDelivered);
router.put("/:id/cancel", adminCancelOrder);
router.put("/:id/refund", markRefundIssued);
router.put("/:id/collect-due", collectDue);

export default router;
