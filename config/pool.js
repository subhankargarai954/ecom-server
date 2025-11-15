// pool.js
import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

const useDatabaseUrl = !!process.env.DATABASE_URL;
const enableSsl = process.env.DB_SSL === "true" || false;

const poolConfig = useDatabaseUrl
    ? {
          connectionString: process.env.DATABASE_URL,
          ssl: enableSsl ? { rejectUnauthorized: false } : false,
      }
    : {
          user: process.env.DB_USER,
          host: process.env.DB_HOST,
          database: process.env.DB_NAME,
          password: process.env.DB_PASSWORD,
          port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
          ssl: enableSsl ? { rejectUnauthorized: false } : false,
      };

const pool = new Pool(poolConfig);

pool.on("connect", () => {
    console.log(`Connected to the database`);
});

pool.on("error", (err) => {
    console.log(`Error connecting to the database : ${err}`);
});

export default pool;
