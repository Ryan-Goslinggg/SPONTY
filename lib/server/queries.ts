import { and, desc, eq, inArray, ne, notExists, or, sql } from "drizzle-orm";
import { DEFAULT_PLACE, PIN_RADIUS_M } from "@/lib/geo";
import type { Message, Post, Review, Snapshot, User } from "@/lib/types";
import { friendships, messages, postLikes, posts, profiles, rateLimits, reviews, users } from "./db/schema";
import type { Db } from "./db/types";
import type { PostInput, ProfilePatch, ReviewInput } from "./inputs";

/**
 * Every read and write the app makes. Functions take the database as an
 * argument so tests can run them against an in-process PGlite database.
 * Callers are responsible for authentication and input validation.
 */

export class NotAllowedError extends Error {}

const FEED_LIMIT = 50;
const THREAD_LIMIT = 200;
const SUGGESTION_LIMIT = 25;
const NEARBY_REVIEW_LIMIT = 200;

const TINTS = ["#c8e8d2", "#fde2e4", "#dbeafe", "#fef3c7", "#ede9fe", "#d1fae5", "#cffafe", "#fce7f3", "#ffedd5", "#e0e7ff", "#ecfccb"];

// ---------------------------------------------------------------------- users

const userColumns = {
  id: users.id,
  name: users.name,
  handle: profiles.handle,
  tint: profiles.tint,
  bio: profiles.bio,
  hobbies: profiles.hobbies,
  locationName: profiles.locationName,
  lat: profiles.lat,
  lng: profiles.lng,
};

type UserRow = { [K in keyof typeof userColumns]: (typeof userColumns)[K]["_"]["data"] };

function toUser(r: UserRow): User {
  return {
    id: r.id,
    name: r.name,
    handle: r.handle,
    tint: r.tint,
    bio: r.bio,
    hobbies: r.hobbies,
    location: { name: r.locationName, lat: r.lat, lng: r.lng },
  };
}

function selectUsers(db: Db) {
  return db.select(userColumns).from(users).innerJoin(profiles, eq(profiles.userId, users.id));
}

export async function getUsers(db: Db, ids: string[]): Promise<User[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  return (await selectUsers(db).where(inArray(users.id, unique))).map(toUser);
}

export async function getUser(db: Db, id: string): Promise<User | undefined> {
  return (await getUsers(db, [id]))[0];
}

function baseHandle(name: string): string {
  const slug = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 15);
  return slug || "traveler";
}

function hashString(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/**
 * Returns the user's profile, creating it on first use. Sign-up only creates
 * the auth user, so this is the one place profiles come into existence.
 */
export async function ensureProfile(db: Db, account: { id: string; name: string }): Promise<User> {
  const existing = await getUser(db, account.id);
  if (existing) return existing;

  const base = baseHandle(account.name);
  for (let attempt = 0; attempt < 6; attempt++) {
    const handle = attempt === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    await db
      .insert(profiles)
      .values({
        userId: account.id,
        handle,
        tint: TINTS[hashString(account.id) % TINTS.length],
        locationName: DEFAULT_PLACE.name,
        lat: DEFAULT_PLACE.lat,
        lng: DEFAULT_PLACE.lng,
      })
      // Either the handle is taken (try another) or a concurrent request created the profile (done).
      .onConflictDoNothing();
    const created = await getUser(db, account.id);
    if (created) return created;
  }
  throw new Error("Could not allocate a unique handle");
}

export async function updateProfile(db: Db, meId: string, patch: ProfilePatch): Promise<User> {
  await db.transaction(async (tx) => {
    if (patch.name !== undefined) await tx.update(users).set({ name: patch.name }).where(eq(users.id, meId));
    const profilePatch = {
      ...(patch.bio !== undefined && { bio: patch.bio }),
      ...(patch.hobbies !== undefined && { hobbies: patch.hobbies }),
      ...(patch.location && { locationName: patch.location.name, lat: patch.location.lat, lng: patch.location.lng }),
    };
    if (Object.keys(profilePatch).length) await tx.update(profiles).set(profilePatch).where(eq(profiles.userId, meId));
  });
  const me = await getUser(db, meId);
  if (!me) throw new NotAllowedError("No profile");
  return me;
}

// -------------------------------------------------------------------- friends

export async function listFriendIds(db: Db, meId: string): Promise<string[]> {
  const rows = await db
    .select({ id: friendships.friendId })
    .from(friendships)
    .where(eq(friendships.userId, meId))
    .orderBy(desc(friendships.createdAt));
  return rows.map((r) => r.id);
}

async function areFriends(db: Db, a: string, b: string): Promise<boolean> {
  const rows = await db
    .select({ one: sql`1` })
    .from(friendships)
    .where(and(eq(friendships.userId, a), eq(friendships.friendId, b)))
    .limit(1);
  return rows.length > 0;
}

/** Friendship is mutual and instant. Returns the new friend. */
export async function addFriend(db: Db, meId: string, friendId: string): Promise<User> {
  if (friendId === meId) throw new NotAllowedError("You can't befriend yourself");
  const friend = await getUser(db, friendId);
  if (!friend) throw new NotAllowedError("No such user");
  await db
    .insert(friendships)
    .values([
      { userId: meId, friendId },
      { userId: friendId, friendId: meId },
    ])
    .onConflictDoNothing();
  return friend;
}

/** People who aren't friends yet, nearest first, for the "Add friends" panel. */
export async function suggestionPool(db: Db, meId: string, limit = SUGGESTION_LIMIT): Promise<User[]> {
  const me = await getUser(db, meId);
  if (!me) return [];
  const rows = await selectUsers(db)
    .where(
      and(
        ne(users.id, meId),
        notExists(
          db
            .select({ one: sql`1` })
            .from(friendships)
            .where(and(eq(friendships.userId, meId), eq(friendships.friendId, users.id))),
        ),
      ),
    )
    .orderBy(sql`ll_to_earth(${profiles.lat}, ${profiles.lng}) <-> ll_to_earth(${me.location.lat}, ${me.location.lng})`)
    .limit(limit);
  return rows.map(toUser);
}

// ---------------------------------------------------------------------- posts

const likeCount = sql<number>`(select count(*)::int from ${postLikes} where ${postLikes.postId} = ${posts.id})`;
const likedBy = (meId: string) =>
  sql<boolean>`exists (select 1 from ${postLikes} where ${postLikes.postId} = ${posts.id} and ${postLikes.userId} = ${meId})`;

function toPost(r: { post: typeof posts.$inferSelect; likeCount: number; likedByMe: boolean }): Post {
  return {
    id: r.post.id,
    authorId: r.post.authorId,
    place: { name: r.post.placeName, lat: r.post.lat, lng: r.post.lng },
    caption: r.post.caption,
    photos: r.post.photos,
    createdAt: r.post.createdAt.getTime(),
    likeCount: Number(r.likeCount),
    likedByMe: Boolean(r.likedByMe),
  };
}

/** The wall shows everyone's trips, newest first, and deliberately ends. */
export async function listFeed(db: Db, meId: string, limit = FEED_LIMIT): Promise<Post[]> {
  const rows = await db
    .select({ post: posts, likeCount, likedByMe: likedBy(meId) })
    .from(posts)
    .orderBy(desc(posts.createdAt))
    .limit(limit);
  return rows.map(toPost);
}

export async function createPost(db: Db, meId: string, input: PostInput): Promise<Post> {
  const [post] = await db
    .insert(posts)
    .values({
      authorId: meId,
      placeName: input.place.name,
      lat: input.place.lat,
      lng: input.place.lng,
      caption: input.caption,
      photos: input.photos,
    })
    .returning();
  return toPost({ post, likeCount: 0, likedByMe: false });
}

export async function setLike(db: Db, meId: string, postId: string, liked: boolean): Promise<Pick<Post, "likeCount" | "likedByMe">> {
  const exists = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (!exists.length) throw new NotAllowedError("No such post");
  if (liked) await db.insert(postLikes).values({ postId, userId: meId }).onConflictDoNothing();
  else await db.delete(postLikes).where(and(eq(postLikes.postId, postId), eq(postLikes.userId, meId)));
  const [row] = await db
    .select({ likeCount, likedByMe: likedBy(meId) })
    .from(posts)
    .where(eq(posts.id, postId));
  return { likeCount: Number(row.likeCount), likedByMe: Boolean(row.likedByMe) };
}

// ------------------------------------------------------------------- messages

/** Maps a stored message to the viewer's perspective, where the thread is named after the other person. */
export function toMessage(viewerId: string, m: { id: string; senderId: string; recipientId: string; text: string; createdAt: Date | number }): Message {
  return {
    id: m.id,
    threadId: m.senderId === viewerId ? m.recipientId : m.senderId,
    fromId: m.senderId,
    text: m.text,
    createdAt: typeof m.createdAt === "number" ? m.createdAt : m.createdAt.getTime(),
  };
}

const threadLow = sql`least(${messages.senderId}, ${messages.recipientId})`;
const threadHigh = sql`greatest(${messages.senderId}, ${messages.recipientId})`;

/** The newest message of each of my threads, oldest first. */
export async function latestMessagePerThread(db: Db, meId: string): Promise<Message[]> {
  const rows = await db
    .selectDistinctOn([threadLow, threadHigh])
    .from(messages)
    .where(or(eq(messages.senderId, meId), eq(messages.recipientId, meId)))
    .orderBy(threadLow, threadHigh, desc(messages.createdAt));
  return rows.map((m) => toMessage(meId, m)).sort((a, b) => a.createdAt - b.createdAt);
}

/** The latest messages between me and a friend, oldest first. */
export async function listThread(db: Db, meId: string, friendId: string, limit = THREAD_LIMIT): Promise<Message[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(and(sql`${threadLow} = least(${meId}::text, ${friendId}::text)`, sql`${threadHigh} = greatest(${meId}::text, ${friendId}::text)`))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  return rows.map((m) => toMessage(meId, m)).reverse();
}

export async function sendMessage(db: Db, meId: string, friendId: string, text: string): Promise<Message> {
  if (!(await areFriends(db, meId, friendId))) throw new NotAllowedError("You can only message friends");
  const [row] = await db.insert(messages).values({ senderId: meId, recipientId: friendId, text }).returning();
  return toMessage(meId, row);
}

// -------------------------------------------------------------------- reviews

function toReview(r: typeof reviews.$inferSelect): Review {
  return {
    id: r.id,
    authorId: r.authorId,
    placeName: r.placeName,
    category: r.category,
    rating: r.rating,
    text: r.text,
    lat: r.lat,
    lng: r.lng,
    createdAt: r.createdAt.getTime(),
  };
}

export async function createReview(db: Db, meId: string, input: ReviewInput): Promise<Review> {
  const [row] = await db
    .insert(reviews)
    .values({ ...input, authorId: meId })
    .returning();
  return toReview(row);
}

/**
 * Everyone's reviews within `radiusM` of a point, nearest first, plus their
 * authors. The earth_box test uses the GiST index; the distance test trims
 * the box's corners to a true circle.
 */
export async function reviewsNear(
  db: Db,
  center: { lat: number; lng: number },
  radiusM = PIN_RADIUS_M,
): Promise<{ reviews: Review[]; users: User[] }> {
  const at = sql`ll_to_earth(${center.lat}::float8, ${center.lng}::float8)`;
  const point = sql`ll_to_earth(${reviews.lat}, ${reviews.lng})`;
  const rows = await db
    .select()
    .from(reviews)
    .where(and(sql`earth_box(${at}, ${radiusM}::float8) @> ${point}`, sql`earth_distance(${at}, ${point}) <= ${radiusM}::float8`))
    .orderBy(sql`earth_distance(${at}, ${point})`)
    .limit(NEARBY_REVIEW_LIMIT);
  const found = rows.map(toReview);
  return { reviews: found, users: await getUsers(db, found.map((r) => r.authorId)) };
}

// ------------------------------------------------------------------- snapshot

export async function loadSnapshot(db: Db, account: { id: string; name: string }): Promise<Snapshot> {
  const me = await ensureProfile(db, account);
  const [friends, feed, latest] = await Promise.all([
    listFriendIds(db, me.id),
    listFeed(db, me.id),
    latestMessagePerThread(db, me.id),
  ]);
  const others = await getUsers(db, [...friends, ...feed.map((p) => p.authorId)].filter((id) => id !== me.id));
  return { me, users: [me, ...others], friends, posts: feed, messages: latest };
}

// ------------------------------------------------------------------- deletion

/**
 * Deletes the account and everything it owns. Removing the user row cascades
 * to profile, sessions, friendships (both directions), posts, likes, messages
 * (sent and received) and reviews. Returns the deleted posts' photo URLs so
 * the caller can remove the files from storage.
 */
export async function deleteUserData(db: Db, userId: string): Promise<{ photoUrls: string[] }> {
  return db.transaction(async (tx) => {
    const owned = await tx.select({ photos: posts.photos }).from(posts).where(eq(posts.authorId, userId));
    await tx.delete(rateLimits).where(sql`right(${rateLimits.key}, ${userId.length + 1}::int) = ${`:${userId}`}`);
    await tx.delete(users).where(eq(users.id, userId));
    return { photoUrls: owned.flatMap((p) => p.photos) };
  });
}

// ---------------------------------------------------------------- rate limits

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Fixed-window counter in one atomic upsert, so it holds across serverless
 * instances. Each key keeps a single row that resets in place.
 */
export async function consumeRateLimit(db: Db, key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const expired = sql`${rateLimits.windowStart} <= now() - make_interval(secs => ${windowSec}::float8)`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
        windowStart: sql`case when ${expired} then now() else ${rateLimits.windowStart} end`,
      },
    })
    .returning({
      count: rateLimits.count,
      retryAfterSec: sql<number>`greatest(0, ceil(extract(epoch from ${rateLimits.windowStart} + make_interval(secs => ${windowSec}::float8) - now())))::int`,
    });
  return { ok: row.count <= limit, remaining: Math.max(0, limit - row.count), retryAfterSec: Number(row.retryAfterSec) };
}
