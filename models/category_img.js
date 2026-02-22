// models/category_img.js

import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";

const CategoryImg = sequelize.define(
    "category_img",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
        },
        image_url: {
            type: DataTypes.TEXT,
            allowNull: false,
            primaryKey: true,
        },
    },
    {
        tableName: "category_img",
        timestamps: false,
    }
);

export default CategoryImg;
