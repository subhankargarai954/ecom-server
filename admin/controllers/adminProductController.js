// adminProductController.js

import pool from "../../config/pool.js";
import axios from "axios";

const isImageLoadable = async (url) => {
    try {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        return response.status === 200;
    } catch (error) {
        return false;
    }
};

const getAllProducts = async (req, res) => {
    try {
        const response = await pool.query(`select * from product`);
        return res.json({ products: response.rows });
    } catch (error) {
        console.error(`getAllProducts error: ${error.message}`);
        return res.status(500).json({ error: "Failed to fetch products" });
    }
};

const getCategoryName = async (req, res) => {
    const categoryId = req.params.id;
    try {
        const response = await pool.query(
            `select name from category where id = $1`,
            [categoryId]
        );
        if (!response.rowCount)
            return res.status(404).json({ error: "Category not found" });
        return res.json(response.rows[0]);
    } catch (error) {
        console.error(`getCategoryName error: ${error.message}`);
        return res.status(500).json({ error: "Failed to fetch category" });
    }
};

const getProductImages = async (req, res) => {
    const productId = req.params.id;
    try {
        const response = await pool.query(
            `select image_url from product_img where id = $1`,
            [productId]
        );
        return res.json(response.rows);
    } catch (error) {
        console.error(`getProductImages error: ${error.message}`);
        return res.status(500).json({ error: "Failed to fetch product images" });
    }
};

const getAllCategoryName = async (req, res) => {
    try {
        const response = await pool.query(`select * from category`);
        return res.json({ categories: response.rows });
    } catch (error) {
        console.error(`getAllCategoryName error: ${error.message}`);
        return res.status(500).json({ error: "Failed to fetch categories" });
    }
};

const storeProduct = async (req, res) => {
    const { prodId, prodName, prodImage, prodPrice, prodCategoryId, prodDetails } =
        req.body;

    if (prodId) {
        try {
            const response = await pool.query(
                `update product set name = $1, image = $2, price = $3, more_info = $4, category_id = $5 where id = $6 returning *`,
                [prodName, prodImage, prodPrice, prodDetails, prodCategoryId, prodId]
            );
            return res.json({ product: response.rows[0] });
        } catch (error) {
            console.error(`storeProduct update error: ${error.message}`);
            return res.status(500).json({ error: error.message });
        }
    } else {
        try {
            const response = await pool.query(
                `insert into product (name, image, category_id, price, more_info) values($1, $2, $3, $4, $5) returning *`,
                [prodName, prodImage, prodCategoryId, prodPrice, prodDetails]
            );
            if (response.rowCount)
                return res.json({ product: response.rows[0] });
            else
                return res.status(500).json({ error: "Error adding Product" });
        } catch (error) {
            console.error(`storeProduct insert error: ${error.message}`);
            return res.status(500).json({ error: error.message });
        }
    }
};

const storeProductImages = async (req, res) => {
    const { images, productId } = req.body;

    try {
        const existing = await pool.query(
            `SELECT * FROM product_img WHERE id = $1`,
            [productId]
        );
        if (existing.rowCount > 0) {
            await pool.query(`DELETE FROM product_img WHERE id = $1`, [productId]);
        }

        const loadableImages = [];
        for (const imageUrl of images) {
            if (await isImageLoadable(imageUrl)) loadableImages.push(imageUrl);
        }

        try {
            const allInsertedImages = (
                await Promise.all(
                    loadableImages.map(async (image_url) => {
                        const insertResponse = await pool.query(
                            `INSERT INTO product_img (id, image_url) VALUES ($1, $2) ON CONFLICT (id, image_url) DO NOTHING RETURNING *`,
                            [productId, image_url]
                        );
                        return insertResponse.rowCount
                            ? insertResponse.rows[0].image_url
                            : null;
                    })
                )
            ).filter((image) => image !== null);

            return res.json({ images: allInsertedImages });
        } catch (error) {
            console.error(`storeProductImages insert error: ${error.message}`);
            return res.status(500).json({ error: error.message });
        }
    } catch (error) {
        console.error(`storeProductImages error: ${error.message}`);
        return res.status(500).json({ error: error.message });
    }
};

const deleteProduct = async (req, res) => {
    const prodId = parseInt(req.params.id, 10);
    try {
        const response = await pool.query(
            `delete from product where id = $1 returning *`,
            [prodId]
        );
        return res.json({ product: response.rows[0] });
    } catch (error) {
        console.error(`deleteProduct error: ${error.message}`);
        return res.status(500).json({ error: error.message });
    }
};

export {
    getAllProducts,
    getCategoryName,
    getProductImages,
    getAllCategoryName,
    storeProduct,
    storeProductImages,
    deleteProduct,
};
