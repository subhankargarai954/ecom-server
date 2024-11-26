import pool from "../config/pool.js";

const getAllCategory = async (req, res) => {
    try {
        let response = await pool.query("select * from category");
        response = response.rows;

        // Use map to create an array of promises for fetching images
        const categoryPromises = response.map(async (category) => {
            try {
                let res = await pool.query(
                    `select * from category_img where id = ${category.id}`
                );
                res = res.rows;
                // console.log(res);

                let image = [];

                res.forEach((row) => {
                    image.push(row.image_url);
                });

                // console.log(images);
                category.images = image;
                // console.log(category); // Add images to the category object
                return category; // Return the updated category object
            } catch (error) {
                console.log(
                    `error getting images from category_img table : ${error}`
                );
                return category; // Return the category even if image fetching fails
            }
        });

        // Wait for all category image promises to complete
        const updatedResponse = await Promise.all(categoryPromises);
        // console.log(updatedResponse);
        // Send the updated response after all promises are resolved
        res.send(response);
    } catch (error) {
        console.log(
            `error getting category details from category table : ${error}`
        );
    }
    console.log(`getAllCategory`);
};

const getAllByCategoryId = async (req, res) => {
    const id = req.params.id;
    // console.log(id);
    try {
        console.log(`getallbycategory`);
        let response = await pool.query(
            "select * from product where category_id = $1",
            [id]
        );

        response = response.rows;

        // console.log(response);
        res.send(response);
    } catch (error) {
        console.log(`problem retrieving data from database : ${error}`);
    }
    console.log(`getAllByCategory`);
};

const getProductDetails = async (req, res) => {
    const id = req.params.id;
    // console.log(`product id : ${id}`);
    try {
        let response = await pool.query("select * from product where id=$1", [
            id,
        ]);
        // console.log(response.rowCount);
        response = response.rows[0];
        // console.log(`product details : ${response}`);
        res.send(response);
    } catch (error) {
        console.log(`error retrieving data from database : ${error}`);
    }
    console.log(`getProductDetails`);
};

const getProductImages = async (req, res) => {
    const id = req.params.id;
    // console.log(`product images id : ${id}`);
    try {
        let response = await pool.query(
            "select image_url from product_img where id = $1",
            [id]
        );
        response = response.rows;
        // console.log(`product images : ${response}`);
        res.send(response);
    } catch (error) {
        console.log(`error retriving images from database : ${error}`);
    }
    console.log(`getProductImages`);
};

const getCategoryName = async (req, res) => {
    const categoryId = req.params.id;
    // console.log(`category id : ${categoryId}`);
    try {
        let response = await pool.query(
            `select name from category where id = $1`,
            [categoryId]
        );

        response = response.rows;
        // console.log(`getCategoryName : response : ${response[0].name}`);
        res.send(response);
    } catch (error) {
        console.log(`error getting getCategoryName from database : ${error}`);
    }
    console.log(`getCategoryName`);
};

export {
    getAllByCategoryId,
    getAllCategory,
    getProductDetails,
    getProductImages,
    getCategoryName,
};
