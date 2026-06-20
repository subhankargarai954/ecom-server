import sequelize from "../config/sequelize.js";

import User from "./User.js";
import Category from "./Category.js";
import Product from "./Product.js";
import ProductVariant from "./ProductVariant.js";
import ProductImage from "./ProductImage.js";
import Cart from "./Cart.js";
import Order from "./Order.js";
import OrderItem from "./OrderItem.js";
import Payment from "./Payment.js";
import Notification from "./Notification.js";
import MessageLog from "./MessageLog.js";

// Category → Product
Category.hasMany(Product, { foreignKey: "category_id", as: "products", onDelete: "SET NULL" });
Product.belongsTo(Category, { foreignKey: "category_id", as: "category" });

// Product → ProductVariant
Product.hasMany(ProductVariant, { foreignKey: "product_id", as: "variants", onDelete: "CASCADE" });
ProductVariant.belongsTo(Product, { foreignKey: "product_id", as: "product" });

// Product → ProductImage
Product.hasMany(ProductImage, { foreignKey: "product_id", as: "images", onDelete: "CASCADE" });
ProductImage.belongsTo(Product, { foreignKey: "product_id", as: "product" });

// User → Cart
User.hasMany(Cart, { foreignKey: "user_id", as: "cart_items", onDelete: "CASCADE" });
Cart.belongsTo(User, { foreignKey: "user_id", as: "user" });

// Product → Cart
Product.hasMany(Cart, { foreignKey: "product_id", as: "cart_entries", onDelete: "CASCADE" });
Cart.belongsTo(Product, { foreignKey: "product_id", as: "product" });

// ProductVariant → Cart
ProductVariant.hasMany(Cart, { foreignKey: "variant_id", as: "cart_entries", onDelete: "CASCADE" });
Cart.belongsTo(ProductVariant, { foreignKey: "variant_id", as: "variant" });

// User → Order
User.hasMany(Order, { foreignKey: "user_id", as: "orders" });
Order.belongsTo(User, { foreignKey: "user_id", as: "user" });

// Order → OrderItem
Order.hasMany(OrderItem, { foreignKey: "order_id", as: "items", onDelete: "CASCADE" });
OrderItem.belongsTo(Order, { foreignKey: "order_id", as: "order" });

// Product → OrderItem
Product.hasMany(OrderItem, { foreignKey: "product_id", as: "order_entries" });
OrderItem.belongsTo(Product, { foreignKey: "product_id", as: "product" });

// ProductVariant → OrderItem
ProductVariant.hasMany(OrderItem, { foreignKey: "variant_id", as: "order_entries" });
OrderItem.belongsTo(ProductVariant, { foreignKey: "variant_id", as: "variant" });

// Order → Payment
Order.hasMany(Payment, { foreignKey: "order_id", as: "payments", onDelete: "RESTRICT" });
Payment.belongsTo(Order, { foreignKey: "order_id", as: "order" });

// Order → Notification (optional link)
Order.hasMany(Notification, { foreignKey: "order_id", as: "notifications" });
Notification.belongsTo(Order, { foreignKey: "order_id", as: "order" });

// Order → MessageLog (SMS / WhatsApp history)
Order.hasMany(MessageLog, { foreignKey: "order_id", as: "messages" });
MessageLog.belongsTo(Order, { foreignKey: "order_id", as: "order" });

export {
    sequelize,
    User,
    Category,
    Product,
    ProductVariant,
    ProductImage,
    Cart,
    Order,
    OrderItem,
    Payment,
    Notification,
    MessageLog,
};
