import { existsSync } from "node:fs";

/** Loads .env.local (then .env) for CLI scripts, the same files `next dev` reads. Real env vars win. */
export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const before = { ...process.env };
    process.loadEnvFile(file);
    Object.assign(process.env, before);
  }
}
