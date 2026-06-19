import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";

const Product = sequelize.define("products", {
    id:                 { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name:               { type: DataTypes.TEXT, allowNull: false },
    category_id:        { type: DataTypes.INTEGER },
    base_price:         { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    discount_percent:   { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    description:        { type: DataTypes.TEXT },
    available_quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active:          { type: DataTypes.BOOLEAN, defaultValue: true },
    created_at:         { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at:         { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: "products", timestamps: false });

export default Product;
