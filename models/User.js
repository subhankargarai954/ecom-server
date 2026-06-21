import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";

const User = sequelize.define("users", {
    id:               { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name:             { type: DataTypes.STRING(100), allowNull: false },
    phone:            { type: DataTypes.STRING(10), allowNull: false, unique: true },
    email:            { type: DataTypes.STRING(255) },
    hashed_password:  { type: DataTypes.TEXT, allowNull: false },
    address:          { type: DataTypes.TEXT },
    role:             { type: DataTypes.STRING(10), allowNull: false, defaultValue: "customer" },
    created_at:       { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: "users", timestamps: false });

export default User;
