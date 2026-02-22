// cartController.js

import express from "express";

import { Cart } from "../models/index.js";

const getCart = async (req, res) => {
    const loggedUserId = req.user.id;
    // console.dir(response, { depth: null });
    console.log(`loggedUserId: ${loggedUserId}`);
    try {
        const cartItems = await Cart.findAll({
            where: { user_id: loggedUserId },
            order: [["product_id", "ASC"]],
        });

        cartItems &&
            cartItems.map((item, index) => {
                console.log(`______________${index}________________`);
                console.log(`user: ${item.user_id}`);
                console.log(`product: ${item.product_id}`);
                console.log(`count: ${item.count}`);
                console.log("");
            });

        res.send({ cartItems: cartItems });
    } catch (error) {
        console.log(error);
    }
};

const addToCart = async (req, res) => {
    const loggedUserId = req.user.id;
    const productId = req.body.productId;
    const count = req.body.count;

    // console.log(`addToCart`);

    try {
        const existingItem = await Cart.findOne({
            where: { user_id: loggedUserId, product_id: productId },
        });

        if (existingItem) {
            try {
                existingItem.count = count;
                await existingItem.save();
                res.send({ item: existingItem });
            } catch (error) {
                console.log(`error updating cart data: ${error}`);
            }
        } else {
            try {
                const insertedItem = await Cart.create({
                    user_id: loggedUserId,
                    product_id: productId,
                    count: count,
                });

                res.send({ item: insertedItem });
            } catch (error) {
                console.log(`error insering cart data: ${error}`);
            }
        }
    } catch (error) {
        console.log(`${error}`);
    }
};

const removeFromCart = async (req, res) => {
    const loggedUserId = req.user.id;
    const productId = req.body.productId;

    try {
        const existingItem = await Cart.findOne({
            where: { user_id: loggedUserId, product_id: productId },
        });

        if (!existingItem) return res.send({ item: null });

        await existingItem.destroy();

        res.send({ item: existingItem });
    } catch (error) {
        console.log(`${error}`);
    }
};

const increaseCartItem = async (req, res) => {
    const loggedUserId = req.user.id;
    const productId = req.body.productId;
    console.log(`increasedCartItem: uid:${loggedUserId} prod-id:${productId}`);
    try {
        const existingItem = await Cart.findOne({
            where: { user_id: loggedUserId, product_id: productId },
        });

        if (existingItem) {
            try {
                await existingItem.increment("count", { by: 1 });
                await existingItem.reload();

                res.send({ item: existingItem });
            } catch (error) {
                console.log(error);
            }
        } else {
            try {
                const insertedItem = await Cart.create({
                    user_id: loggedUserId,
                    product_id: productId,
                    count: 1,
                });

                res.send({ item: insertedItem });
            } catch (error) {
                console.log(error);
            }
        }
    } catch (error) {
        console.log(`${error}`);
    }
};

const decreaseCartItem = async (req, res) => {
    const loggedUserId = req.user.id;
    const productId = req.body.productId;
    console.log(`decreasedCartItem: uid:${loggedUserId} prod-id:${productId}`);

    try {
        const existingItem = await Cart.findOne({
            where: { user_id: loggedUserId, product_id: productId },
        });

        if (existingItem) {
            if (existingItem.count > 1) {
                try {
                    await existingItem.decrement("count", { by: 1 });
                    await existingItem.reload();

                    res.send({ item: existingItem });
                } catch (error) {
                    console.log(error);
                }
            } else {
                console.log("only single item left");
            }
        } else {
            console.log(`no cart item found with this productId`);
        }
    } catch (error) {
        console.log(error);
    }
};

export {
    getCart,
    addToCart,
    removeFromCart,
    increaseCartItem,
    decreaseCartItem,
};





















// // cartController.js

// import express from "express";
// import pool from "../config/pool.js";

// const getCart = async (req, res) => {
//     const loggedUserId = req.user.id;
//     // console.dir(response, { depth: null });
//     console.log(`loggedUserId: ${loggedUserId}`);
//     try {
//         const cartItems = await pool.query(
//             `select * from cart where user_id = $1 order by product_id`,
//             [loggedUserId]
//         );

//         cartItems.rows &&
//             cartItems.rows.map((item, index) => {
//                 console.log(`______________${index}________________`);
//                 console.log(`user: ${item.user_id}`);
//                 console.log(`product: ${item.product_id}`);
//                 console.log(`count: ${item.count}`);
//                 console.log("");
//             });

//         res.send({ cartItems: cartItems.rows });
//     } catch (error) {
//         console.log(error);
//     }
// };

// const addToCart = async (req, res) => {
//     const loggedUserId = req.user.id;
//     const productId = req.body.productId;
//     const count = req.body.count;

//     // console.log(`addToCart`);

//     try {
//         const existingItem = await pool.query(
//             `select * from cart where user_id = $1 and product_id = $2`,
//             [loggedUserId, productId]
//         );

//         if (existingItem.rowCount) {
//             try {
//                 const updatedItem = await pool.query(
//                     `update cart set count = $1 where user_id = $2 and product_id = $3 returning *`,
//                     [count, loggedUserId, productId]
//                 );

//                 // console.log(`updatedItem.rows: ${updatedItem.rows[0]}`);
//                 res.send({ item: updatedItem.rows[0] });
//             } catch (error) {
//                 console.log(`error updating cart data: ${error}`);
//             }
//         } else {
//             try {
//                 const insertedItem = await pool.query(
//                     `insert into cart (user_id, product_id, count) values ($1, $2, $3) returning *`,
//                     [loggedUserId, productId, count]
//                 );

//                 // console.log(`insertedItem.rows: ${insertedItem.rows[0]}`);
//                 res.send({ item: insertedItem.rows[0] });
//             } catch (error) {
//                 console.log(`error insering cart data: ${error}`);
//             }
//         }
//     } catch (error) {
//         console.log(`${error}`);
//     }
// };

// const removeFromCart = async (req, res) => {
//     const loggedUserId = req.user.id;
//     const productId = req.body.productId;

//     try {
//         const deletedItem = await pool.query(
//             `delete from cart where user_id = $1 and product_id = $2 returning *`,
//             [loggedUserId, productId]
//         );

//         // console.log(`deletedItem: ${deletedItem.rows[0]}`);
//         res.send({ item: deletedItem.rows[0] });
//     } catch (error) {
//         console.log(`${error}`);
//     }
// };

// const increaseCartItem = async (req, res) => {
//     const loggedUserId = req.user.id;
//     const productId = req.body.productId;
//     console.log(`increasedCartItem: uid:${loggedUserId} prod-id:${productId}`);
//     try {
//         const existingItem = await pool.query(
//             `select * from cart where user_id = $1 and product_id = $2`,
//             [loggedUserId, productId]
//         );

//         if (existingItem.rowCount) {
//             try {
//                 const updatedItem = await pool.query(
//                     `update cart set count = count + 1 where user_id = $1 and product_id = $2 returning *`,
//                     [loggedUserId, productId]
//                 );

//                 // console.log(`updatedItem: ${updatedItem.rows[0]}`);
//                 res.send({ item: updatedItem.rows[0] });
//             } catch (error) {
//                 console.log(error);
//             }
//         } else {
//             try {
//                 const insertedItem = await pool.query(
//                     `insert into cart (user_id, product_id, count) values ($1, $2, $3) returning *`,
//                     [loggedUserId, productId, 1]
//                 );

//                 // console.log(`insertedItem: ${insertedItem.rows[0]}`);
//                 res.send({ item: insertedItem.rows[0] });
//             } catch (error) {
//                 console.log(error);
//             }
//         }
//     } catch (error) {
//         console.log(`${error}`);
//     }
// };

// const decreaseCartItem = async (req, res) => {
//     const loggedUserId = req.user.id;
//     const productId = req.body.productId;
//     console.log(`decreasedCartItem: uid:${loggedUserId} prod-id:${productId}`);

//     try {
//         const existingItem = await pool.query(
//             `select * from cart where user_id = $1 and product_id = $2`,
//             [loggedUserId, productId]
//         );

//         if (existingItem.rowCount) {
//             if (existingItem.rows[0].count > 1) {
//                 try {
//                     const updatedItem = await pool.query(
//                         `update cart set count = count - 1 where user_id = $1 and product_id = $2 returning *`,
//                         [loggedUserId, productId]
//                     );

//                     // console.log(`updatedItem: `);
//                     // console.dir(updatedItem.rows, { depth: null });

//                     res.send({ item: updatedItem.rows[0] });
//                 } catch (error) {
//                     console.log(error);
//                 }
//             } else {
//                 console.log("only single item left");
//             }
//         } else {
//             console.log(`no cart item found with this productId`);
//         }
//     } catch (error) {
//         console.log(error);
//     }
// };

// export {
//     getCart,
//     addToCart,
//     removeFromCart,
//     increaseCartItem,
//     decreaseCartItem,
// };
