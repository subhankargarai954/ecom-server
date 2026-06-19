import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";

const ProductImage = sequelize.define("product_images", {
    id:            { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    product_id:    { type: DataTypes.INTEGER, allowNull: false },
    image_url:     { type: DataTypes.TEXT, allowNull: false },
    is_cover:      { type: DataTypes.BOOLEAN, defaultValue: false },
    display_order: { type: DataTypes.INTEGER, defaultValue: 0 },
    created_at:    { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: "product_images", timestamps: false });

export default ProductImage;
