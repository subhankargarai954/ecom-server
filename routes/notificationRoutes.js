import express from "express";
import { getNotifications, getUnreadCount, markRead, markAllRead } from "../controllers/notificationController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.put("/:id/read", markRead);
router.put("/read-all", markAllRead);

export default router;
