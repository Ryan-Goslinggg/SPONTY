import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Database schema. The first four tables belong to Better Auth (their field
 * names are what its Drizzle adapter expects); the rest are Sponty's own.
 *
 * Changing this file? Run `npm run db:generate` to write a new migration.
 * Things Drizzle can't express (extensions, the GiST geo index, NOTIFY
 * triggers) live in hand-written migrations in `drizzle/`.
 */

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();

// ---------------------------------------------------------------- Better Auth

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("accounts_user_id_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

/** Better Auth's own limiter for sign-in/sign-up, shared across serverless instances. */
export const authRateLimits = pgTable("auth_rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// --------------------------------------------------------------------- Sponty

export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    handle: text("handle").notNull().unique(),
    /** Soft background tint used for the avatar bubble. */
    tint: text("tint").notNull(),
    bio: text("bio").default("").notNull(),
    hobbies: text("hobbies").array().default(sql`'{}'::text[]`).notNull(),
    locationName: text("location_name").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    updatedAt: updatedAt(),
  },
  // The GiST index on ll_to_earth(lat, lng) used for nearest-people suggestions is in a hand-written migration.
  (t) => [
    check("profiles_bio_len", sql`char_length(${t.bio}) <= 600`),
    // The tint is interpolated into map marker HTML, so only a plain hex colour may ever be stored.
    check("profiles_tint_hex", sql`${t.tint} ~ '^#[0-9a-fA-F]{6}$'`),
    check("profiles_handle_format", sql`${t.handle} ~ '^[a-z0-9_]{1,30}$'`),
    check("profiles_lat_range", sql`${t.lat} between -90 and 90`),
    check("profiles_lng_range", sql`${t.lng} between -180 and 180`),
  ],
);

/**
 * Friendship is mutual and instant, stored as two directed rows so "my
 * friends" is a plain index lookup. Both rows are written in one transaction.
 */
export const friendships = pgTable(
  "friendships",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    friendId: text("friend_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.friendId] }),
    check("friendships_not_self", sql`${t.userId} <> ${t.friendId}`),
  ],
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeName: text("place_name").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    caption: text("caption").default("").notNull(),
    /** Public URLs in photo storage (Vercel Blob, or the local disk driver in dev). */
    photos: text("photos").array().default(sql`'{}'::text[]`).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("posts_created_at_idx").on(t.createdAt.desc()),
    index("posts_author_id_idx").on(t.authorId),
    check("posts_caption_len", sql`char_length(${t.caption}) <= 500`),
    check("posts_photos_len", sql`coalesce(array_length(${t.photos}, 1), 0) <= 4`),
  ],
);

export const postLikes = pgTable(
  "post_likes",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    // A thread is the unordered pair, so index it that way.
    index("messages_thread_idx").on(
      sql`least(${t.senderId}, ${t.recipientId})`,
      sql`greatest(${t.senderId}, ${t.recipientId})`,
      t.createdAt,
    ),
    index("messages_sender_idx").on(t.senderId, t.createdAt),
    index("messages_recipient_idx").on(t.recipientId, t.createdAt),
    check("messages_text_len", sql`char_length(${t.text}) between 1 and 1000`),
    check("messages_not_self", sql`${t.senderId} <> ${t.recipientId}`),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeName: text("place_name").notNull(),
    category: text("category", { enum: ["food", "spot"] }).notNull(),
    rating: smallint("rating").notNull(),
    text: text("text").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    createdAt: createdAt(),
  },
  // The GiST index on ll_to_earth(lat, lng) used by the radius query is in a hand-written migration.
  (t) => [
    index("reviews_author_id_idx").on(t.authorId),
    check("reviews_category", sql`${t.category} in ('food', 'spot')`),
    check("reviews_rating_range", sql`${t.rating} between 1 and 5`),
    check("reviews_text_len", sql`char_length(${t.text}) between 1 and 400`),
    check("reviews_place_len", sql`char_length(${t.placeName}) between 1 and 80`),
  ],
);

/** Fixed-window counters for app-level rate limits (e.g. the AI match endpoint). */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).defaultNow().notNull(),
  count: integer("count").notNull(),
});
