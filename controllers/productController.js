// productController.js

import { Category, CategoryImg, Product, ProductImg } from "../models/index.js";

const getAllCategory = async (req, res) => {
    try {
        let response = await Category.findAll({
            include: [
                {
                    model: CategoryImg,
                    as: "category_images",
                    attributes: ["image_url"],
                },
            ],
            order: [["id", "ASC"]],
        });

        response = response.map((category) => {
            const categoryJson = category.toJSON();
            categoryJson.images = (categoryJson.category_images || []).map(
                (row) => row.image_url
            );
            delete categoryJson.category_images;
            return categoryJson;
        });

        return res.json(response);
    } catch (error) {
        console.error(`getAllCategory error: ${error.message}`);
        return res.status(500).json({ error: "Failed to fetch categories" });
    }
};

const getAllByCategoryId = async (req, res) => {
    const { id } = req.params;
    try {
        const response = await Product.findAll({ where: { category_id: id } });
        return res.json(response);
    } catch (error) {
        console.error(`getAllByCategoryId error: ${error.message}`);
        return res.status(500).json({ error: "Failed to fetch products" });
    }
};

const getProductDetails = async (req, res) => {
    const { id } = req.params;
    try {
        const response = await Product.findByPk(id);
        if (!response) return res.status(404).json({ error: "Product not found" });
        return res.json(response);
    } catch (error) {
        console.error(`getProductDetails error: ${error.message}`);
        return res.status(500).json({ error: "Failed to fetch product" });
    }
};

const getProductImages = async (req, res) => {
    const { id } = req.params;
    try {
        const response = await ProductImg.findAll({
            where: { id },
            attributes: ["image_url"],
        });
        return res.json(response);
    } catch (error) {
        console.error(`getProductImages error: ${error.message}`);
        return res.status(500).json({ error: "Failed to fetch product images" });
    }
};

const getCategoryName = async (req, res) => {
    const { id } = req.params;
    try {
        const response = await Category.findByPk(id, { attributes: ["name"] });
        if (!response) return res.json([]);
        return res.json([{ name: response.name }]);
    } catch (error) {
        console.error(`getCategoryName error: ${error.message}`);
        return res.status(500).json({ error: "Failed to fetch category name" });
    }
};

export {
    getAllByCategoryId,
    getAllCategory,
    getProductDetails,
    getProductImages,
    getCategoryName,
};
