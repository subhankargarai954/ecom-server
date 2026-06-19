// config/sequelize.js

import dotenv from "dotenv";
dotenv.config();

import { Sequelize } from "sequelize";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as neonModule from "@neondatabase/serverless";

// Required for Neon WebSocket connections in Node.js
neonConfig.webSocketConstructor = ws;

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    dialectModule: neonModule,
    logging: false,
    dialectOptions: {
        ssl: { require: true, rejectUnauthorized: false },
    },
});

export default sequelize;
