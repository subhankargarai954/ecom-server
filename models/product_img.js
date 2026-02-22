// models/product_img.js

import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";

const ProductImg = sequelize.define(
    "product_img",
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
        },
        image_url: {
            type: DataTypes.TEXT,
            allowNull: false,
            primaryKey: true,
        },
    },
    {
        tableName: "product_img",
        timestamps: false,
    }
);

export default ProductImg;
