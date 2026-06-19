import express from "express";
import { placeOrder, getMyOrders, getOrderById, cancelOrder } from "../controllers/orderController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);
router.post("/", placeOrder);
router.get("/", getMyOrders);
router.get("/:id", getOrderById);
router.put("/:id/cancel", cancelOrder);

export default router;
