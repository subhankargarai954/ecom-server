import { Op } from "sequelize";
import { Product, ProductVariant, ProductImage, Category } from "../models/index.js";

const getProducts = async (req, res) => {
    const { category_id, search, page = 1, limit = 20 } = req.query;
    const where = { is_active: true };
    if (category_id) where.category_id = category_id;
    if (search) where.name = { [Op.iLike]: `%${search}%` };

    try {
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const { count, rows } = await Product.findAndCountAll({
            where,
            include: [
                { model: ProductImage, as: "images", where: { is_cover: true }, required: false },
                { model: ProductVariant, as: "variants", where: { is_active: true }, required: false },
                { model: Category, as: "category", attributes: ["id", "name", "name_bn"] },
            ],
            limit: parseInt(limit),
            offset,
            order: [["created_at", "DESC"]],
        });
        return res.json({ products: rows, total: count, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        console.error("getProducts error:", err.message);
        return res.status(500).json({ error: "Failed to fetch products." });
    }
};

const getProductById = async (req, res) => {
    try {
        const product = await Product.findOne({
            where: { id: req.params.id, is_active: true },
            include: [
                { model: ProductImage, as: "images", order: [["display_order", "ASC"]] },
                { model: ProductVariant, as: "variants", where: { is_active: true }, required: false },
                { model: Category, as: "category", attributes: ["id", "name", "name_bn"] },
            ],
        });
        if (!product) return res.status(404).json({ error: "Product not found." });
        return res.json({ product });
    } catch (err) {
        console.error("getProductById error:", err.message);
        return res.status(500).json({ error: "Failed to fetch product." });
    }
};

const getCategories = async (req, res) => {
    try {
        const categories = await Category.findAll({ order: [["name", "ASC"]] });
        return res.json({ categories });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch categories." });
    }
};

export { getProducts, getProductById, getCategories };
