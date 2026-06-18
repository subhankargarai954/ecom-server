// authMiddleware.js

import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const authMiddleware = (req, res, next) => {
    const TOKEN = req.header("Authorization");
    if (!TOKEN) return res.status(401).json({ error: "Access denied" });

    try {
        const decoded = jwt.verify(TOKEN, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        req.user = undefined;
        return res.status(403).json({ error: "Invalid token" });
    }
};

export { authMiddleware };
