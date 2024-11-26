// cartRoutes.js

import express from "express";

import {
    getCart,
    addToCart,
    removeFromCart,
    increaseCartItem,
    decreaseCartItem,
} from "../controllers/cartController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const cartRouter = express.Router();

cartRouter.get("/", authMiddleware, getCart);
cartRouter.post("/addToCart", authMiddleware, addToCart);
cartRouter.post("/removeFromCart", authMiddleware, removeFromCart);
cartRouter.post("/increaseCartItem", authMiddleware, increaseCartItem);
cartRouter.post("/decreaseCartItem", authMiddleware, decreaseCartItem);

export default cartRouter;
