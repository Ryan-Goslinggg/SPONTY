import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { Db } from "./types";
import * as schema from "./schema";

let db: Db | undefined;

/** The app's shared connection pool. Created on first use so builds don't need a database. */
export function getDb(): Db {
  if (db) return db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set. See README > Environment variables.");
  const pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 10_000 });
  // On Vercel Fluid compute this releases idle clients before an instance is suspended.
  attachDatabasePool(pool);
  db = drizzle(pool, { schema });
  return db;
}
