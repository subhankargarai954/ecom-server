// config/sequelize.js

import dotenv from "dotenv";
dotenv.config();

import { Sequelize } from "sequelize";

const useDatabaseUrl = !!process.env.DATABASE_URL;
const enableSsl = process.env.DB_SSL === "true";

const baseConfig = {
    dialect: "postgres",
    logging: false,
    ...(enableSsl && {
        dialectOptions: {
            ssl: { require: true, rejectUnauthorized: false },
        },
    }),
};

const sequelize = useDatabaseUrl
    ? new Sequelize(process.env.DATABASE_URL, baseConfig)
    : new Sequelize(
          process.env.DB_NAME,
          process.env.DB_USER,
          process.env.DB_PASSWORD,
          {
              ...baseConfig,
              host: process.env.DB_HOST || "localhost",
              port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
          }
      );

export default sequelize;
