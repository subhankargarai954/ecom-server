import { User, Order } from "../../models/index.js";

const getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll({
            where: { role: "customer" },
            attributes: ["id", "name", "phone", "email", "address", "created_at"],
            order: [["created_at", "DESC"]],
        });
        return res.json({ users });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch users." });
    }
};

const getUserById = async (req, res) => {
    try {
        const user = await User.findOne({
            where: { id: req.params.id, role: "customer" },
            attributes: ["id", "name", "phone", "email", "address", "created_at"],
            include: [{ model: Order, as: "orders" }],
        });
        if (!user) return res.status(404).json({ error: "User not found." });
        return res.json({ user });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch user." });
    }
};

export { getAllUsers, getUserById };
