// config/neon.js
// Use this for raw tagged-template SQL:  sql`SELECT * FROM users WHERE id = ${id}`

import dotenv from "dotenv";
dotenv.config();

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

export default sql;
