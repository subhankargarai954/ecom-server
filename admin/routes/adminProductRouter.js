import express from "express";
import {
    getAllProducts, getProductById, createProduct, updateProduct, deleteProduct,
    addVariant, updateVariant, deleteVariant,
    uploadImages, setCoverImage, deleteImage,
} from "../controllers/adminProductController.js";
import { adminMiddleware } from "../../middleware/adminMiddleware.js";
import { upload } from "../../middleware/upload.js";

const router = express.Router();
router.use(adminMiddleware);

router.get("/", getAllProducts);
router.get("/:id", getProductById);
router.post("/", createProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

// Variant routes
router.post("/:id/variants", addVariant);
router.put("/:id/variants/:variant_id", updateVariant);
router.delete("/:id/variants/:variant_id", deleteVariant);

// Image routes
router.post("/:id/images", upload.array("images", 10), uploadImages);
router.put("/:id/images/cover", setCoverImage);
router.delete("/:id/images/:image_id", deleteImage);

export default router;
