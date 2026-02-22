// models/index.js

import sequelize from "../config/sequelize.js";

import Category from "./category.js";
import CategoryImg from "./category_img.js";
import Product from "./product.js";
import ProductImg from "./product_img.js";
import Users from "./users.js";
import Cart from "./cart.js";

// CATEGORY -> CATEGORY_IMG
Category.hasMany(CategoryImg, {
    foreignKey: "id",
    sourceKey: "id",
    as: "category_images",
});
CategoryImg.belongsTo(Category, {
    foreignKey: "id",
    targetKey: "id",
});

// CATEGORY -> PRODUCT
Category.hasMany(Product, {
    foreignKey: "category_id",
    sourceKey: "id",
    onDelete: "CASCADE",
});
Product.belongsTo(Category, {
    foreignKey: "category_id",
    targetKey: "id",
});

// PRODUCT -> PRODUCT_IMG
Product.hasMany(ProductImg, {
    foreignKey: "id",
    sourceKey: "id",
    as: "product_images",
    onDelete: "CASCADE",
});
ProductImg.belongsTo(Product, {
    foreignKey: "id",
    targetKey: "id",
});

// USERS -> CART
Users.hasMany(Cart, {
    foreignKey: "user_id",
    sourceKey: "id",
});
Cart.belongsTo(Users, {
    foreignKey: "user_id",
    targetKey: "id",
});

// PRODUCT -> CART
Product.hasMany(Cart, {
    foreignKey: "product_id",
    sourceKey: "id",
    onDelete: "CASCADE",
});
Cart.belongsTo(Product, {
    foreignKey: "product_id",
    targetKey: "id",
});

export { sequelize, Category, CategoryImg, Product, ProductImg, Users, Cart };
