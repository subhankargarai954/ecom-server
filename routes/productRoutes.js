import express from "express";
import { getProducts, getProductById, getCategories } from "../controllers/productController.js";

const router = express.Router();

router.get("/", getProducts);
router.get("/categories", getCategories);
router.get("/:id", getProductById);

export default router;
