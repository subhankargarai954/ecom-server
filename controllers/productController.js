import { Op } from "sequelize";
import { Product, ProductVariant, ProductImage, Category } from "../models/index.js";
import { getReservedMap, reservedFor, shownAvailable } from "../services/stock.js";

// Replace each product/variant's physical on-hand with the quantity actually
// free for a new customer to order (on-hand − reserved by confirmed orders).
function applyAvailability(product, reservedMap) {
    const obj = product.toJSON ? product.toJSON() : product;
    obj.available_quantity = shownAvailable(obj.available_quantity, reservedFor(reservedMap, obj.id, null));
    if (Array.isArray(obj.variants)) {
        obj.variants = obj.variants.map((v) => ({
            ...v,
            available_quantity: shownAvailable(v.available_quantity, reservedFor(reservedMap, obj.id, v.id)),
        }));
    }
    return obj;
}

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
        const reservedMap = await getReservedMap(rows.map((p) => p.id));
        const products = rows.map((p) => applyAvailability(p, reservedMap));
        return res.json({ products, total: count, page: parseInt(page), limit: parseInt(limit) });
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
        const reservedMap = await getReservedMap([product.id]);
        return res.json({ product: applyAvailability(product, reservedMap) });
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
