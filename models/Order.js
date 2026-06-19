import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";

const Order = sequelize.define("orders", {
    id:                       { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id:                  { type: DataTypes.INTEGER, allowNull: false },

    // Financials
    total_amount:             { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    advance_paid:             { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    final_paid:               { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    advance_payment_mode:     { type: DataTypes.STRING(10), defaultValue: "cash" },
    final_payment_mode:       { type: DataTypes.STRING(10) },
    payment_status:           { type: DataTypes.STRING(30), allowNull: false, defaultValue: "advance_paid" },

    // Availability
    all_items_available:      { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

    // Dates
    tentative_delivery_date:  { type: DataTypes.DATEONLY },
    final_delivery_date:      { type: DataTypes.DATEONLY },
    actual_delivery_date:     { type: DataTypes.DATE },

    // Status
    order_status:             { type: DataTypes.STRING(30), allowNull: false, defaultValue: "pending" },
    admin_notes:              { type: DataTypes.TEXT },
    cancellation_reason:      { type: DataTypes.TEXT },

    created_at:               { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at:               { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: "orders", timestamps: false });

export default Order;
