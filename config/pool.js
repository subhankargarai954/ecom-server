// config/pool.js
// Neon's Pool is API-compatible with pg.Pool — no changes needed in controllers.

import dotenv from "dotenv";
dotenv.config();

import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

// Required for Neon WebSocket connections in Node.js
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on("connect", () => console.log("Connected to Neon database (pool)"));
pool.on("error", (err) => console.error(`Pool error: ${err.message}`));

export default pool;
