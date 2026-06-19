import { Category } from "../../models/index.js";

const getAllCategories = async (req, res) => {
    try {
        const categories = await Category.findAll({ order: [["name", "ASC"]] });
        return res.json({ categories });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch categories." });
    }
};

const createCategory = async (req, res) => {
    const { name, name_bn, image_url } = req.body;
    if (!name) return res.status(400).json({ error: "Category name is required." });
    try {
        const category = await Category.create({ name, name_bn, image_url });
        return res.status(201).json({ category });
    } catch (err) {
        return res.status(500).json({ error: "Failed to create category." });
    }
};

const updateCategory = async (req, res) => {
    const { name, name_bn, image_url } = req.body;
    try {
        const [updated] = await Category.update({ name, name_bn, image_url }, { where: { id: req.params.id } });
        if (!updated) return res.status(404).json({ error: "Category not found." });
        const category = await Category.findByPk(req.params.id);
        return res.json({ category });
    } catch (err) {
        return res.status(500).json({ error: "Failed to update category." });
    }
};

const deleteCategory = async (req, res) => {
    try {
        const deleted = await Category.destroy({ where: { id: req.params.id } });
        if (!deleted) return res.status(404).json({ error: "Category not found." });
        return res.json({ message: "Category deleted." });
    } catch (err) {
        return res.status(500).json({ error: "Failed to delete category." });
    }
};

export { getAllCategories, createCategory, updateCategory, deleteCategory };
