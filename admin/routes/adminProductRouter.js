import express from "express";

import {
    getAllProducts,
    getCategoryName,
    getProductImages,
    getAllCategoryName,
    storeProduct,
    storeProductImages,
    deleteProduct,
} from "../controllers/adminProductController.js";

const adminProductRouter = express.Router();

adminProductRouter.get("/", getAllProducts);
adminProductRouter.get("/category", getAllCategoryName);
adminProductRouter.get("/category/:id", getCategoryName);
adminProductRouter.get("/productimage/:id", getProductImages);
adminProductRouter.post("/", storeProduct);
adminProductRouter.post("/otherimages", storeProductImages);

adminProductRouter.delete("/:id", deleteProduct);

export default adminProductRouter;
