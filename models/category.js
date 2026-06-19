import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";

const Category = sequelize.define("categories", {
    id:         { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name:       { type: DataTypes.STRING(255), allowNull: false },
    name_bn:    { type: DataTypes.STRING(255) },  // optional Bengali name
    image_url:  { type: DataTypes.TEXT },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: "categories", timestamps: false });

export default Category;
