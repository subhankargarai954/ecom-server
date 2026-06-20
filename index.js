import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import { sequelize } from "./models/index.js";

// Customer routes
import authRouter from "./routes/authRoutes.js";
import productRouter from "./routes/productRoutes.js";
import cartRouter from "./routes/cartRoutes.js";
import orderRouter from "./routes/orderRoutes.js";

// Admin routes
import adminAuthRouter from "./admin/routes/adminAuthRouter.js";
import adminProductRouter from "./admin/routes/adminProductRouter.js";
import adminCategoryRouter from "./admin/routes/adminCategoryRouter.js";
import adminOrderRouter from "./admin/routes/adminOrderRouter.js";
import adminUserRouter from "./admin/routes/adminUserRouter.js";
import adminNotificationRouter from "./admin/routes/adminNotificationRouter.js";

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Customer API
app.use("/api/auth", authRouter);
app.use("/api/products", productRouter);
app.use("/api/cart", cartRouter);
app.use("/api/orders", orderRouter);

// Admin API
app.use("/admin/api/auth", adminAuthRouter);
app.use("/admin/api/products", adminProductRouter);
app.use("/admin/api/categories", adminCategoryRouter);
app.use("/admin/api/orders", adminOrderRouter);
app.use("/admin/api/users", adminUserRouter);
app.use("/admin/api/notifications", adminNotificationRouter);

app.get("/", (req, res) => res.json({ message: "E-Commerce API running." }));

sequelize
    .authenticate()
    .then(() => console.log("Database connected."))
    .catch((err) => console.error("DB connection error:", err.message));

app.listen(port, () => console.log(`Server running on port ${port}`));
