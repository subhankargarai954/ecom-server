import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";

// Permanent record of every SMS / WhatsApp notification sent for an order.
const MessageLog = sequelize.define("message_logs", {
    id:           { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    order_id:     { type: DataTypes.INTEGER },
    user_id:      { type: DataTypes.INTEGER },
    channel:      { type: DataTypes.STRING(10), allowNull: false },   // sms | whatsapp
    event:        { type: DataTypes.STRING(40), allowNull: false },   // order_placed, advance_confirmed, ...
    to_phone:     { type: DataTypes.STRING(20) },
    body:         { type: DataTypes.TEXT },
    media:        { type: DataTypes.TEXT },                           // JSON array of media URLs
    status:       { type: DataTypes.STRING(20), defaultValue: "simulated" }, // sent | failed | simulated
    provider:     { type: DataTypes.STRING(20) },                     // twilio | simulation
    provider_sid: { type: DataTypes.STRING(80) },
    error:        { type: DataTypes.TEXT },
    created_at:   { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: "message_logs", timestamps: false });

export default MessageLog;
