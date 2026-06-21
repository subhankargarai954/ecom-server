import { Cart, Product, ProductVariant, ProductImage } from "../models/index.js";
import { getReservedMap, reservedFor, shownAvailable } from "../services/stock.js";

const getCart = async (req, res) => {
    try {
        const items = await Cart.findAll({
            where: { user_id: req.user.id },
            include: [
                {
                    model: Product,
                    as: "product",
                    include: [
                        { model: ProductImage, as: "images", where: { is_cover: true }, required: false },
                    ],
                },
                { model: ProductVariant, as: "variant" },
            ],
        });
        // Show free-to-order quantity (on-hand − reserved) so the cap matches listings.
        const reservedMap = await getReservedMap(items.map((i) => i.product?.id).filter(Boolean));
        const cart = items.map((i) => {
            const obj = i.toJSON();
            if (obj.product) obj.product.available_quantity = shownAvailable(obj.product.available_quantity, reservedFor(reservedMap, obj.product.id, null));
            if (obj.variant) obj.variant.available_quantity = shownAvailable(obj.variant.available_quantity, reservedFor(reservedMap, obj.product.id, obj.variant.id));
            return obj;
        });
        return res.json({ cart });
    } catch (err) {
        console.error("getCart error:", err.message);
        return res.status(500).json({ error: "Failed to fetch cart." });
    }
};

const addToCart = async (req, res) => {
    const { product_id, variant_id, quantity = 1 } = req.body;
    if (!product_id) return res.status(400).json({ error: "product_id is required." });

    try {
        const product = await Product.findByPk(product_id);
        if (!product || !product.is_active)
            return res.status(404).json({ error: "Product not found." });

        // Check if variant required
        const variants = await ProductVariant.findAll({ where: { product_id, is_active: true } });
        if (variants.length > 0 && !variant_id)
            return res.status(400).json({ error: "Please select a variant for this product." });

        const [item, created] = await Cart.findOrCreate({
            where: { user_id: req.user.id, product_id, variant_id: variant_id || null },
            defaults: { quantity },
        });

        if (!created) {
            item.quantity += parseInt(quantity);
            await item.save();
        }

        return res.json({ message: "Added to cart.", item });
    } catch (err) {
        console.error("addToCart error:", err.message);
        return res.status(500).json({ error: "Failed to add to cart." });
    }
};

const updateCartItem = async (req, res) => {
    const { quantity } = req.body;
    const { id } = req.params;
    if (!quantity || quantity < 1)
        return res.status(400).json({ error: "Quantity must be at least 1." });

    try {
        const item = await Cart.findOne({ where: { id, user_id: req.user.id } });
        if (!item) return res.status(404).json({ error: "Cart item not found." });

        item.quantity = quantity;
        await item.save();
        return res.json({ message: "Cart updated.", item });
    } catch (err) {
        return res.status(500).json({ error: "Failed to update cart." });
    }
};

const removeFromCart = async (req, res) => {
    const { id } = req.params;
    try {
        const deleted = await Cart.destroy({ where: { id, user_id: req.user.id } });
        if (!deleted) return res.status(404).json({ error: "Cart item not found." });
        return res.json({ message: "Removed from cart." });
    } catch (err) {
        return res.status(500).json({ error: "Failed to remove from cart." });
    }
};

const clearCart = async (req, res) => {
    try {
        await Cart.destroy({ where: { user_id: req.user.id } });
        return res.json({ message: "Cart cleared." });
    } catch (err) {
        return res.status(500).json({ error: "Failed to clear cart." });
    }
};

export { getCart, addToCart, updateCartItem, removeFromCart, clearCart };
