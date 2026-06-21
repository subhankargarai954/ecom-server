import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();
import { User } from "../../models/index.js";

const adminLogin = async (req, res) => {
    const { phone, password } = req.body;
    try {
        const user = await User.findOne({ where: { phone, role: "admin" } });
        if (!user) return res.status(401).json({ error: "Invalid admin credentials." });

        const match = await bcrypt.compare(password, user.hashed_password);
        if (!match) return res.status(401).json({ error: "Invalid admin credentials." });

        const token = jwt.sign(
            { id: user.id, name: user.name, role: "admin" },
            process.env.JWT_SECRET,
            { expiresIn: "12h" }
        );
        return res.json({ token, admin: { id: user.id, name: user.name } });
    } catch (err) {
        return res.status(500).json({ error: "Login failed." });
    }
};

// One-time setup: create admin from ADMIN_SETUP_KEY in env
const setupAdmin = async (req, res) => {
    const { name, phone, password, setup_key } = req.body;
    if (setup_key !== process.env.ADMIN_SETUP_KEY)
        return res.status(403).json({ error: "Invalid setup key." });

    try {
        const exists = await User.findOne({ where: { role: "admin" } });
        if (exists) return res.status(400).json({ error: "Admin already exists." });

        const hashed_password = await bcrypt.hash(password, 10);
        const admin = await User.create({ name, phone, hashed_password, role: "admin" });
        return res.json({ message: "Admin created.", id: admin.id });
    } catch (err) {
        return res.status(500).json({ error: "Setup failed." });
    }
};

export { adminLogin, setupAdmin };
