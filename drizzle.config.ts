import { defineConfig } from "drizzle-kit";
import { loadEnv } from "./scripts/env";

loadEnv();

// Migrations must run on a direct connection, not through a pooler.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: url ?? "" },
  strict: true,
  verbose: true,
});
