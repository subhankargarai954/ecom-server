import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";

const Payment = sequelize.define("payments", {
    id:                 { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    order_id:           { type: DataTypes.INTEGER, allowNull: false },
    payment_type:       { type: DataTypes.STRING(10), allowNull: false },  // advance | final
    method:             { type: DataTypes.STRING(10), allowNull: false },  // cash | online
    amount:             { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    status:             { type: DataTypes.STRING(15), allowNull: false, defaultValue: "pending" }, // pending|confirmed|failed|refunded
    gateway:            { type: DataTypes.STRING(20) },   // razorpay | cash | simulated
    gateway_order_id:   { type: DataTypes.TEXT },
    gateway_payment_id: { type: DataTypes.TEXT },
    gateway_signature:  { type: DataTypes.TEXT },
    confirmed_by_admin: { type: DataTypes.BOOLEAN, defaultValue: false },
    confirmed_at:       { type: DataTypes.DATE },
    slip_no:            { type: DataTypes.STRING(30) },
    created_at:         { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: "payments", timestamps: false });

export default Payment;
