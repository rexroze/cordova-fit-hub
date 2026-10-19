import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: url });
try {
  const sql = await readFile(resolve("db/migrations/0001_initial.sql"), "utf8");
  await pool.query(sql);
  console.log("Database schema is up to date.");
} finally {
  await pool.end();
}
