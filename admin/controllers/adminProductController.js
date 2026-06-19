import { cloudinary, uploadToCloudinary } from "../../middleware/upload.js";
import { sequelize, Product, ProductVariant, ProductImage, Category } from "../../models/index.js";

const getAllProducts = async (req, res) => {
    try {
        const products = await Product.findAll({
            include: [
                { model: ProductImage, as: "images", order: [["display_order", "ASC"]] },
                { model: ProductVariant, as: "variants" },
                { model: Category, as: "category", attributes: ["id", "name"] },
            ],
            order: [["created_at", "DESC"]],
        });
        return res.json({ products });
    } catch (err) {
        console.error("getAllProducts error:", err.message);
        return res.status(500).json({ error: "Failed to fetch products." });
    }
};

const getProductById = async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id, {
            include: [
                { model: ProductImage, as: "images", order: [["display_order", "ASC"]] },
                { model: ProductVariant, as: "variants" },
                { model: Category, as: "category" },
            ],
        });
        if (!product) return res.status(404).json({ error: "Product not found." });
        return res.json({ product });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch product." });
    }
};

const createProduct = async (req, res) => {
    const { name, category_id, base_price, discount_percent, description, available_quantity, variants } = req.body;
    if (!name || !base_price) return res.status(400).json({ error: "Name and base price are required." });

    const t = await sequelize.transaction();
    try {
        const product = await Product.create({
            name, category_id: category_id || null,
            base_price, discount_percent: discount_percent || 0,
            description, available_quantity: available_quantity || 0,
        }, { transaction: t });

        if (variants && Array.isArray(variants) && variants.length > 0) {
            for (const v of variants) {
                await ProductVariant.create({
                    product_id: product.id,
                    variant_name: v.variant_name,
                    price_override: v.price_override || null,
                    available_quantity: v.available_quantity || 0,
                }, { transaction: t });
            }
        }

        await t.commit();
        const full = await Product.findByPk(product.id, {
            include: [{ model: ProductVariant, as: "variants" }, { model: ProductImage, as: "images" }],
        });
        return res.status(201).json({ product: full });
    } catch (err) {
        await t.rollback();
        console.error("createProduct error:", err.message);
        return res.status(500).json({ error: "Failed to create product." });
    }
};

const updateProduct = async (req, res) => {
    const { name, category_id, base_price, discount_percent, description, available_quantity, is_active } = req.body;
    try {
        const [updated] = await Product.update({
            name, category_id, base_price, discount_percent, description, available_quantity, is_active,
            updated_at: new Date(),
        }, { where: { id: req.params.id } });

        if (!updated) return res.status(404).json({ error: "Product not found." });
        const product = await Product.findByPk(req.params.id, {
            include: [{ model: ProductVariant, as: "variants" }, { model: ProductImage, as: "images" }],
        });
        return res.json({ product });
    } catch (err) {
        console.error("updateProduct error:", err.message);
        return res.status(500).json({ error: "Failed to update product." });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id, {
            include: [{ model: ProductImage, as: "images" }],
        });
        if (!product) return res.status(404).json({ error: "Product not found." });

        for (const img of product.images) {
            try {
                const parts = img.image_url.split("/upload/");
                if (parts.length > 1) {
                    const publicId = parts[1].replace(/\.[^.]+$/, ""); // remove extension
                    await cloudinary.uploader.destroy(publicId);
                }
            } catch {}
        }

        await product.destroy();
        return res.json({ message: "Product deleted." });
    } catch (err) {
        return res.status(500).json({ error: "Failed to delete product." });
    }
};

// Variant management
const addVariant = async (req, res) => {
    const { variant_name, price_override, available_quantity } = req.body;
    if (!variant_name) return res.status(400).json({ error: "Variant name is required." });
    try {
        const variant = await ProductVariant.create({
            product_id: req.params.id,
            variant_name,
            price_override: price_override || null,
            available_quantity: available_quantity || 0,
        });
        return res.status(201).json({ variant });
    } catch (err) {
        return res.status(500).json({ error: "Failed to add variant." });
    }
};

const updateVariant = async (req, res) => {
    const { variant_name, price_override, available_quantity, is_active } = req.body;
    try {
        const [updated] = await ProductVariant.update(
            { variant_name, price_override, available_quantity, is_active },
            { where: { id: req.params.variant_id, product_id: req.params.id } }
        );
        if (!updated) return res.status(404).json({ error: "Variant not found." });
        const variant = await ProductVariant.findByPk(req.params.variant_id);
        return res.json({ variant });
    } catch (err) {
        return res.status(500).json({ error: "Failed to update variant." });
    }
};

const deleteVariant = async (req, res) => {
    try {
        const deleted = await ProductVariant.destroy({
            where: { id: req.params.variant_id, product_id: req.params.id },
        });
        if (!deleted) return res.status(404).json({ error: "Variant not found." });
        return res.json({ message: "Variant deleted." });
    } catch (err) {
        return res.status(500).json({ error: "Failed to delete variant." });
    }
};

// Image upload: receives files via multer (memory), uploads to Cloudinary
const uploadImages = async (req, res) => {
    const product_id = req.params.id;

    try {
        if (!req.files || req.files.length === 0)
            return res.status(400).json({ error: "No files uploaded." });

        const coverIndex = parseInt(req.body.cover_index ?? 0);

        // Upload all buffers to Cloudinary
        const uploadResults = await Promise.all(
            req.files.map((file) => uploadToCloudinary(file.buffer))
        );

        // Clear old images from DB (Cloudinary files are kept unless explicitly deleted)
        await ProductImage.destroy({ where: { product_id } });

        const images = await Promise.all(
            uploadResults.map((result, i) =>
                ProductImage.create({
                    product_id,
                    image_url: result.secure_url,
                    is_cover: i === coverIndex,
                    display_order: i,
                })
            )
        );

        return res.json({ images });
    } catch (err) {
        console.error("uploadImages error:", err.message);
        return res.status(500).json({ error: "Failed to upload images." });
    }
};

const setCoverImage = async (req, res) => {
    const { image_id } = req.body;
    const product_id = req.params.id;
    try {
        await ProductImage.update({ is_cover: false }, { where: { product_id } });
        await ProductImage.update({ is_cover: true }, { where: { id: image_id, product_id } });
        return res.json({ message: "Cover image updated." });
    } catch (err) {
        return res.status(500).json({ error: "Failed to update cover image." });
    }
};

const deleteImage = async (req, res) => {
    try {
        const image = await ProductImage.findOne({
            where: { id: req.params.image_id, product_id: req.params.id },
        });
        if (!image) return res.status(404).json({ error: "Image not found." });

        try {
            const parts = image.image_url.split("/upload/");
            if (parts.length > 1) {
                const publicId = parts[1].replace(/\.[^.]+$/, "");
                await cloudinary.uploader.destroy(publicId);
            }
        } catch {}

        await image.destroy();
        return res.json({ message: "Image deleted." });
    } catch (err) {
        return res.status(500).json({ error: "Failed to delete image." });
    }
};

export {
    getAllProducts, getProductById, createProduct, updateProduct, deleteProduct,
    addVariant, updateVariant, deleteVariant,
    uploadImages, setCoverImage, deleteImage,
};
