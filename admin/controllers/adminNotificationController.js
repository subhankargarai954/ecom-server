import { Notification } from "../../models/index.js";

const ADMIN = { audience: "admin" };

const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.findAll({
            where: ADMIN, order: [["created_at", "DESC"]], limit: 50,
        });
        const unread = await Notification.count({ where: { ...ADMIN, is_read: false } });
        return res.json({ notifications, unread });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch notifications." });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const unread = await Notification.count({ where: { ...ADMIN, is_read: false } });
        return res.json({ unread });
    } catch (err) {
        return res.status(500).json({ error: "Failed." });
    }
};

const markRead = async (req, res) => {
    try {
        await Notification.update({ is_read: true }, { where: { id: req.params.id, ...ADMIN } });
        return res.json({ message: "Marked read." });
    } catch (err) {
        return res.status(500).json({ error: "Failed." });
    }
};

const markAllRead = async (req, res) => {
    try {
        await Notification.update({ is_read: true }, { where: { ...ADMIN, is_read: false } });
        return res.json({ message: "All marked read." });
    } catch (err) {
        return res.status(500).json({ error: "Failed." });
    }
};

export { getNotifications, getUnreadCount, markRead, markAllRead };
