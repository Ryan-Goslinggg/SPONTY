/**
 * Loads the demo community into the database. Safe to run repeatedly: rows
 * that already exist are left alone.
 *
 *   npm run db:seed
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { friendships, postLikes, posts, profiles, reviews, users } from "../lib/server/db/schema";
import { loadEnv } from "./env";
import { demoData } from "./demo-data";

loadEnv();

/** Demo ids like "p3" become fixed UUIDs so reruns don't duplicate anything. */
const demoUuid = (kind: "post" | "review", id: string) =>
  `00000000-0000-4000-${kind === "post" ? "8" : "9"}000-${id.replace(/\D/g, "").padStart(12, "0")}`;

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);
  const data = demoData();

  await db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values(data.users.map((u) => ({ id: u.id, name: u.name, email: `${u.handle}@demo.sponty.invalid` })))
      .onConflictDoNothing();
    await tx
      .insert(profiles)
      .values(
        data.users.map((u) => ({
          userId: u.id,
          handle: u.handle,
          tint: u.tint,
          bio: u.bio,
          hobbies: u.hobbies,
          locationName: u.location.name,
          lat: u.location.lat,
          lng: u.location.lng,
        })),
      )
      .onConflictDoNothing();
    await tx
      .insert(friendships)
      .values(data.friendships.flatMap(([a, b]) => [
        { userId: a, friendId: b },
        { userId: b, friendId: a },
      ]))
      .onConflictDoNothing();
    await tx
      .insert(posts)
      .values(
        data.posts.map((p) => ({
          id: demoUuid("post", p.id),
          authorId: p.authorId,
          placeName: p.place.name,
          lat: p.place.lat,
          lng: p.place.lng,
          caption: p.caption,
          photos: p.photos,
          createdAt: new Date(p.createdAt),
        })),
      )
      .onConflictDoNothing();
    const likes = data.posts.flatMap((p) => p.likes.map((userId) => ({ postId: demoUuid("post", p.id), userId })));
    if (likes.length) await tx.insert(postLikes).values(likes).onConflictDoNothing();
    await tx
      .insert(reviews)
      .values(data.reviews.map((r) => ({ ...r, id: demoUuid("review", r.id), createdAt: new Date(r.createdAt) })))
      .onConflictDoNothing();
  });

  await pool.end();
  console.log(`Seeded ${data.users.length} demo people, ${data.posts.length} posts and ${data.reviews.length} reviews.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
