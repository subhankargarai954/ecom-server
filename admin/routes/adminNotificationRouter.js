import express from "express";
import { getNotifications, getUnreadCount, markRead, markAllRead } from "../controllers/adminNotificationController.js";
import { adminMiddleware } from "../../middleware/adminMiddleware.js";

const router = express.Router();
router.use(adminMiddleware);
router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.put("/:id/read", markRead);
router.put("/read-all", markAllRead);
export default router;
