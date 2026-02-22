// models/cart.js

import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";

const Cart = sequelize.define(
    "cart",
    {
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
        },
        product_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
        },
        count: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    },
    {
        tableName: "cart",
        timestamps: false,
    }
);

export default Cart;
