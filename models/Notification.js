import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";

const Notification = sequelize.define("notifications", {
    id:         { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    type:       { type: DataTypes.STRING(40), allowNull: false },
    title:      { type: DataTypes.TEXT, allowNull: false },
    message:    { type: DataTypes.TEXT },
    order_id:   { type: DataTypes.INTEGER },
    audience:   { type: DataTypes.STRING(10), allowNull: false, defaultValue: "admin" }, // admin | customer
    user_id:    { type: DataTypes.INTEGER },   // recipient when audience = customer
    is_read:    { type: DataTypes.BOOLEAN, defaultValue: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: "notifications", timestamps: false });

export default Notification;
