import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";

const Cart = sequelize.define("cart", {
    id:         { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id:    { type: DataTypes.INTEGER, allowNull: false },
    product_id: { type: DataTypes.INTEGER, allowNull: false },
    variant_id: { type: DataTypes.INTEGER },  // null when product has no variants
    quantity:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: "cart", timestamps: false });

export default Cart;
