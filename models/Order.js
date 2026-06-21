import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";

const Order = sequelize.define("orders", {
    id:                       { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id:                  { type: DataTypes.INTEGER, allowNull: false },

    // Financials
    total_amount:             { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    advance_paid:             { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    final_paid:               { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    advance_payment_mode:     { type: DataTypes.STRING(10), defaultValue: "cash" },  // cash | online
    final_payment_mode:       { type: DataTypes.STRING(10) },
    payment_status:           { type: DataTypes.STRING(30), allowNull: false, defaultValue: "unpaid" },

    // Payment confirmation workflow
    advance_confirmed:        { type: DataTypes.BOOLEAN, defaultValue: false },
    advance_confirmed_at:     { type: DataTypes.DATE },
    final_confirmed:          { type: DataTypes.BOOLEAN, defaultValue: false },
    final_confirmed_at:       { type: DataTypes.DATE },
    stock_committed:          { type: DataTypes.BOOLEAN, defaultValue: false },

    // Availability / production
    all_items_available:      { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    is_made_to_order:         { type: DataTypes.BOOLEAN, defaultValue: false },

    // Dates
    tentative_delivery_date:  { type: DataTypes.DATEONLY },  // tentative ready date (admin estimate)
    final_delivery_date:      { type: DataTypes.DATEONLY },  // confirmed ready date
    actual_delivery_date:     { type: DataTypes.DATE },      // when customer actually collected

    // Status
    order_status:             { type: DataTypes.STRING(30), allowNull: false, defaultValue: "pending" },
    admin_notes:              { type: DataTypes.TEXT },
    cancellation_reason:      { type: DataTypes.TEXT },
    invoice_no:               { type: DataTypes.STRING(30) },

    created_at:               { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at:               { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: "orders", timestamps: false });

export default Order;
