// models/product.js

import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";

const Product = sequelize.define(
    "product",
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        category_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        price: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        more_info: {
            type: DataTypes.TEXT,
        },
        image: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue:
                "https://res.cloudinary.com/db4qfek2s/image/upload/v1728189313/product-logo-103-5614_whhixc.png",
        },
    },
    {
        tableName: "product",
        timestamps: false,
    }
);

export default Product;
