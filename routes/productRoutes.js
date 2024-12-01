// productRouter.js

import express from "express";

import {
    getAllCategory,
    getAllByCategoryId,
    getProductDetails,
    getProductImages,
    getCategoryName,
} from "../controllers/productController.js";

const productRouter = express.Router();

// Defining category routes
productRouter.get("/categories", getAllCategory);
productRouter.get("/categories/:id", getAllByCategoryId);
productRouter.get("/product/:id", getProductDetails);
productRouter.get("/product/images/:id", getProductImages);
productRouter.get("/categoryname/:id", getCategoryName);

export default productRouter;
