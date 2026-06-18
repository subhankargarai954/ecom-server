// cartController.js

import { Cart } from "../models/index.js";

const getCart = async (req, res) => {
    const loggedUserId = req.user.id;
    try {
        const cartItems = await Cart.findAll({
            where: { user_id: loggedUserId },
            order: [["product_id", "ASC"]],
        });
        return res.json({ cartItems });
    } catch (error) {
        console.error(`getCart error: ${error.message}`);
        return res.status(500).json({ error: "Failed to fetch cart" });
    }
};

const addToCart = async (req, res) => {
    const loggedUserId = req.user.id;
    const { productId, count } = req.body;

    try {
        const existingItem = await Cart.findOne({
            where: { user_id: loggedUserId, product_id: productId },
        });

        if (existingItem) {
            existingItem.count = count;
            await existingItem.save();
            return res.json({ item: existingItem });
        } else {
            const insertedItem = await Cart.create({
                user_id: loggedUserId,
                product_id: productId,
                count,
            });
            return res.json({ item: insertedItem });
        }
    } catch (error) {
        console.error(`addToCart error: ${error.message}`);
        return res.status(500).json({ error: "Failed to update cart" });
    }
};

const removeFromCart = async (req, res) => {
    const loggedUserId = req.user.id;
    const { productId } = req.body;

    try {
        const existingItem = await Cart.findOne({
            where: { user_id: loggedUserId, product_id: productId },
        });

        if (!existingItem) return res.json({ item: null });

        await existingItem.destroy();
        return res.json({ item: existingItem });
    } catch (error) {
        console.error(`removeFromCart error: ${error.message}`);
        return res.status(500).json({ error: "Failed to remove from cart" });
    }
};

const increaseCartItem = async (req, res) => {
    const loggedUserId = req.user.id;
    const { productId } = req.body;

    try {
        const existingItem = await Cart.findOne({
            where: { user_id: loggedUserId, product_id: productId },
        });

        if (existingItem) {
            await existingItem.increment("count", { by: 1 });
            await existingItem.reload();
            return res.json({ item: existingItem });
        } else {
            const insertedItem = await Cart.create({
                user_id: loggedUserId,
                product_id: productId,
                count: 1,
            });
            return res.json({ item: insertedItem });
        }
    } catch (error) {
        console.error(`increaseCartItem error: ${error.message}`);
        return res.status(500).json({ error: "Failed to increase cart item" });
    }
};

const decreaseCartItem = async (req, res) => {
    const loggedUserId = req.user.id;
    const { productId } = req.body;

    try {
        const existingItem = await Cart.findOne({
            where: { user_id: loggedUserId, product_id: productId },
        });

        if (!existingItem)
            return res.status(404).json({ error: "Cart item not found" });

        if (existingItem.count <= 1)
            return res.status(400).json({ error: "Quantity is already 1" });

        await existingItem.decrement("count", { by: 1 });
        await existingItem.reload();
        return res.json({ item: existingItem });
    } catch (error) {
        console.error(`decreaseCartItem error: ${error.message}`);
        return res.status(500).json({ error: "Failed to decrease cart item" });
    }
};

export {
    getCart,
    addToCart,
    removeFromCart,
    increaseCartItem,
    decreaseCartItem,
};
