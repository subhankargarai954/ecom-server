// models/users.js

import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";

const Users = sequelize.define(
    "users",
    {
        name: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        phone: {
            type: DataTypes.STRING(10),
            primaryKey: true,
            allowNull: false,
        },
        hashedpassword: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        address: {
            type: DataTypes.TEXT,
        },
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            unique: true,
        },
    },
    {
        tableName: "users",
        timestamps: false,
    }
);

export default Users;
