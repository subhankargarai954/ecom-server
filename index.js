// index.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import productRouter from "./routes/productRoutes.js";
import authRouter from "./routes/authRoutes.js";
import cartRouter from "./routes/cartRoutes.js";

import adminProductRouter from "./admin/routes/adminProductRouter.js";

// Base setup
const app = express();
dotenv.config();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/products", productRouter);
app.use("/api/auth", authRouter);
app.use("/api/cart", cartRouter);

// Admin Routes
app.use("/admin/api/products", adminProductRouter);

// Server
app.listen(port, () => console.log(`Server running on port ${port}`));
