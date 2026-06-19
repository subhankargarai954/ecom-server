import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";

const ProductVariant = sequelize.define("product_variants", {
    id:                 { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    product_id:         { type: DataTypes.INTEGER, allowNull: false },
    variant_name:       { type: DataTypes.STRING(100), allowNull: false },
    price_override:     { type: DataTypes.DECIMAL(10, 2) },  // null = use product base_price
    available_quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active:          { type: DataTypes.BOOLEAN, defaultValue: true },
    created_at:         { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: "product_variants", timestamps: false });

export default ProductVariant;
