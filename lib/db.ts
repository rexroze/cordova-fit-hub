import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const globalPool = globalThis as typeof globalThis & { pgPool?: Pool };
export const pool =
  globalPool.pgPool ??
  new Pool({
    connectionString: url,
    max: 10,
    ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });
if (process.env.NODE_ENV !== "production") globalPool.pgPool = pool;
export const db = drizzle(pool, { schema });
