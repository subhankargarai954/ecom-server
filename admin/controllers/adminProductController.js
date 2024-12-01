// adminProductController.js

import pool from "../../config/pool.js";
import axios from "axios";

const isImageLoadable = async (url) => {
    try {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        return (
            response.status === 200 // &&
            // response.headers["Content-Type"].startsWith("image/")
        );
    } catch (error) {
        return false;
    }
};

const getAllProducts = async (req, res) => {
    console.log(`getAllProducs`);
    try {
        const response = await pool.query(`select * from product`);
        response.rowCount && res.send({ products: response.rows });
    } catch (error) {
        console.dir(error, { depth: null });
    }
};

const getCategoryName = async (req, res) => {
    const categoryId = req.params.id;

    try {
        const response = await pool.query(
            `select name from category where id = $1`,
            [categoryId]
        );

        // console.dir(response.rows[0], { depth: null });
        response.rowCount && res.send(response.rows[0]);
    } catch (error) {
        console.dir(error, { depth: null });
    }
};

const getProductImages = async (req, res) => {
    const productId = req.params.id;

    try {
        const response = await pool.query(
            `select image_url from product_img where id = $1`,
            [productId]
        );
        // console.dir(response.rows);

        res.send(response.rows);
        // console.log(`response sent`);
    } catch (error) {}
};

const getAllCategoryName = async (req, res) => {
    try {
        const response = await pool.query(`select * from category`);

        // console.dir(response.rows, { depth: null });
        res.send({ categories: response.rows });
    } catch (error) {
        console.dir(error, { depth: null });
    }
};

const storeProduct = async (req, res) => {
    const {
        prodId,
        prodName,
        prodImage,
        prodPrice,
        prodCategoryId,
        prodDetails,
    } = req.body;
    console.dir(req.body, { depth: null });

    // if the product already exists then update
    if (prodId) {
        // console.log(`update product - ${prodId}`);
        try {
            const response = await pool.query(
                `update product set name = $1, image = $2, price = $3, more_info = $4, category_id = $5 where id = $6 returning *`,
                [
                    prodName,
                    prodImage,
                    prodPrice,
                    prodDetails,
                    prodCategoryId,
                    prodId,
                ]
            );
            console.dir(response.rows[0], { depth: null });
            return res.send({ product: response.rows[0] });
        } catch (error) {
            console.dir(error, { depth: null });
            res.send({ error: error });
        }
    } else {
        // if the product doesn't exist then create new product
        try {
            const response = await pool.query(
                `insert into product (name, image, category_id, price, more_info) values($1, $2, $3, $4, $5) returning *`,
                [prodName, prodImage, prodCategoryId, prodPrice, prodDetails]
            );
            if (response.rowCount) {
                // console.dir(response.rows[0]);
                return res.send({ product: response.rows[0] });
            } else return res.send({ error: "Error adding Product" });
        } catch (error) {
            console.log(error);
        }
    }
};

const storeProductImages = async (req, res) => {
    const { images, productId } = req.body;
    console.dir(req.body, { depth: null });

    try {
        // Check if images exist for the productId
        const response = await pool.query(
            `SELECT * FROM product_img WHERE id = $1`,
            [productId]
        );

        // If images exist, delete them
        if (response.rowCount > 0) {
            console.log(`Deleting existing images for productId: ${productId}`);
            await pool.query(`DELETE FROM product_img WHERE id = $1`, [
                productId,
            ]);
        }

        // Validate the new images
        const loadableImages = [];
        for (const imageUrl of images) {
            if (await isImageLoadable(imageUrl)) loadableImages.push(imageUrl);
        }
        console.dir(loadableImages, { depth: null });

        // Insert the new images
        try {
            const allInsertedImages = (
                await Promise.all(
                    loadableImages.map(async (image_url) => {
                        const insertResponse = await pool.query(
                            `INSERT INTO product_img (id, image_url) VALUES ($1, $2) ON CONFLICT (id, image_url) DO NOTHING RETURNING *`,
                            [productId, image_url]
                        );
                        console.dir(
                            "response.rows[0]",
                            insertResponse.rows[0],
                            {
                                depth: null,
                            }
                        );
                        if (insertResponse.rowCount)
                            return insertResponse.rows[0].image_url;
                        else return null;
                    })
                )
            ).filter((image) => image !== null);

            console.dir(allInsertedImages, { depth: null });
            res.send({ images: allInsertedImages });
        } catch (error) {
            console.error("Error inserting images:", error);
            res.send({ error });
        }
    } catch (error) {
        console.error("Error checking existing images:", error);
        res.send({ error });
    }
};

const deleteProduct = async (req, res) => {
    const prodId = parseInt(req.params.id, 10);
    console.log(prodId);

    try {
        const response = await pool.query(
            `delete from product where id = $1 returning *`,
            [prodId]
        );
        res.send({ product: response.rows[0] });
    } catch (error) {
        console.log(error);
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
