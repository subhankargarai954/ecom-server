import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const adminMiddleware = (req, res, next) => {
    const token = req.header("Authorization");
    if (!token) return res.status(401).json({ error: "Access denied. No token." });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== "admin") {
            return res.status(403).json({ error: "Admin access required." });
        }
        req.user = decoded;
        next();
    } catch {
        return res.status(403).json({ error: "Invalid or expired token." });
    }
};

export { adminMiddleware };
