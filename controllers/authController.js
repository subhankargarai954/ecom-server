import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

import { User } from "../models/index.js";

const signup = async (req, res) => {
    const { name, phone, password, address, email } = req.body;
    if (!name || !phone || !password)
        return res.status(400).json({ error: "Name, phone, and password are required." });

    try {
        const exists = await User.findOne({ where: { phone } });
        if (exists)
            return res.status(400).json({ error: "Phone number already registered. Please log in." });

        const hashed_password = await bcrypt.hash(password, 10);
        const user = await User.create({ name, phone, email, hashed_password, address, role: "customer" });

        const token = jwt.sign(
            { id: user.id, name: user.name, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );
        return res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role } });
    } catch (err) {
        console.error("signup error:", err.message);
        return res.status(500).json({ error: "Registration failed." });
    }
};

const login = async (req, res) => {
    const { phone, password } = req.body;
    if (!phone || !password)
        return res.status(400).json({ error: "Phone and password are required." });

    try {
        const user = await User.findOne({ where: { phone } });
        if (!user)
            return res.status(401).json({ error: "Phone number not registered." });

        const match = await bcrypt.compare(password, user.hashed_password);
        if (!match)
            return res.status(401).json({ error: "Incorrect password." });

        const token = jwt.sign(
            { id: user.id, name: user.name, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );
        return res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role } });
    } catch (err) {
        console.error("login error:", err.message);
        return res.status(500).json({ error: "Login failed." });
    }
};

const getProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: ["id", "name", "phone", "email", "address", "role", "created_at"],
        });
        if (!user) return res.status(404).json({ error: "User not found." });
        return res.json({ user });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch profile." });
    }
};

const updateProfile = async (req, res) => {
    const { name, email, address } = req.body;
    try {
        await User.update({ name, email, address }, { where: { id: req.user.id } });
        return res.json({ message: "Profile updated." });
    } catch (err) {
        return res.status(500).json({ error: "Failed to update profile." });
    }
};

export { signup, login, getProfile, updateProfile };
