import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";

const OrderItem = sequelize.define("order_items", {
    id:                     { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    order_id:               { type: DataTypes.INTEGER, allowNull: false },
    product_id:             { type: DataTypes.INTEGER, allowNull: false },
    variant_id:             { type: DataTypes.INTEGER },
    quantity:               { type: DataTypes.INTEGER, allowNull: false },
    unit_price:             { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    discount_percent:       { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    was_available_at_order: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at:             { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: "order_items", timestamps: false });

export default OrderItem;
