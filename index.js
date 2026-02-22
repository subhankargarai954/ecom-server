// index.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import productRouter from "./routes/productRoutes.js";
import authRouter from "./routes/authRoutes.js";
import cartRouter from "./routes/cartRoutes.js";
import adminProductRouter from "./admin/routes/adminProductRouter.js";

import { sequelize } from "./models/index.js";

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

// Server welcome message
// app.use("/", (req, res) => {
//     res.send("Welcome to the server home page");
// });

// ORM DB connection
sequelize
    .authenticate()
    .then(() => console.log("Database connected (Sequelize)"))
    .catch((err) => console.log(`Database connection error: ${err}`));

// Server
app.listen(port, () => console.log(`Server running on port ${port}`));
