import { PGlite } from "@electric-sql/pglite";
import { cube } from "@electric-sql/pglite/contrib/cube";
import { earthdistance } from "@electric-sql/pglite/contrib/earthdistance";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import * as schema from "./db/schema";
import type { Db } from "./db/types";

/** A fresh in-memory Postgres with every migration applied, for tests. */
export async function createTestDb(): Promise<{ db: Db; pg: PGlite; createUser: (id: string, name?: string) => Promise<void> }> {
  const pg = await PGlite.create({ extensions: { cube, earthdistance } });
  const db = drizzle(pg, { schema });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
  const createUser = async (id: string, name = id) => {
    await db.insert(schema.users).values({ id, name, email: `${id}@example.test` });
  };
  return { db, pg, createUser };
}
