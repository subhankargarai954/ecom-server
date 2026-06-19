import express from "express";
import { getAllCategories, createCategory, updateCategory, deleteCategory } from "../controllers/adminCategoryController.js";
import { adminMiddleware } from "../../middleware/adminMiddleware.js";

const router = express.Router();
router.use(adminMiddleware);
router.get("/", getAllCategories);
router.post("/", createCategory);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);
export default router;
