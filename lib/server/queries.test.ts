import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_PLACE } from "@/lib/geo";
import type { Db } from "./db/types";
import {
  addFriend,
  consumeRateLimit,
  createPost,
  createReview,
  deleteUserData,
  ensureProfile,
  latestMessagePerThread,
  listFeed,
  listFriendIds,
  listThread,
  loadSnapshot,
  NotAllowedError,
  reviewsNear,
  sendMessage,
  setLike,
  suggestionPool,
  updateProfile,
} from "./queries";
import { createTestDb } from "./test-db";

let db: Db;
let pg: PGlite;
let createUserAndProfile: (id: string) => Promise<void>;

const POBLACION = { name: "Poblacion", lat: 14.5649, lng: 121.03 };
const CEBU = { name: "Cebu", lat: 10.3157, lng: 123.8854 };

beforeAll(async () => {
  const t = await createTestDb();
  db = t.db;
  pg = t.pg;
  createUserAndProfile = async (id) => {
    await t.createUser(id);
    await ensureProfile(db, { id, name: id });
  };
  for (const [id, name] of [
    ["ana", "Ana Cruz"],
    ["ben", "Ben Lim"],
    ["cy", "Cy"],
    ["dee", "Ana Cruz"],
  ]) {
    await t.createUser(id, name);
    await ensureProfile(db, { id, name });
  }
  await updateProfile(db, "ben", { location: POBLACION });
  await updateProfile(db, "cy", { location: CEBU });
}, 30_000);

afterAll(async () => {
  await pg.close();
});

describe("profiles", () => {
  it("creates a profile once, with a unique handle and the default place", async () => {
    const ana = await ensureProfile(db, { id: "ana", name: "Ana Cruz" });
    const again = await ensureProfile(db, { id: "ana", name: "Ana Cruz" });
    const dee = await ensureProfile(db, { id: "dee", name: "Ana Cruz" });
    expect(again).toEqual(ana);
    expect(ana.handle).toBe("anacruz");
    expect(dee.handle).toMatch(/^anacruz\d{4}$/);
    expect(ana.location).toEqual(DEFAULT_PLACE);
  });

  it("updates name, bio, hobbies and location together", async () => {
    const me = await updateProfile(db, "dee", { name: "Dee", bio: "Hi", hobbies: ["Hiking"], location: POBLACION });
    expect(me).toMatchObject({ name: "Dee", bio: "Hi", hobbies: ["Hiking"], location: POBLACION });
  });
});

describe("friends", () => {
  it("are mutual, idempotent and can't be yourself", async () => {
    await addFriend(db, "ana", "ben");
    await addFriend(db, "ana", "ben");
    expect(await listFriendIds(db, "ana")).toEqual(["ben"]);
    expect(await listFriendIds(db, "ben")).toEqual(["ana"]);
    await expect(addFriend(db, "ana", "ana")).rejects.toBeInstanceOf(NotAllowedError);
    await expect(addFriend(db, "ana", "nobody")).rejects.toBeInstanceOf(NotAllowedError);
  });

  it("suggests non-friends nearest first", async () => {
    await updateProfile(db, "ana", { location: POBLACION });
    const pool = await suggestionPool(db, "ana");
    expect(pool.map((u) => u.id)).toEqual(["dee", "cy"]);
  });
});

describe("posts", () => {
  it("are shared with everyone, newest first, with per-viewer likes", async () => {
    const first = await createPost(db, "ana", { place: POBLACION, caption: "Ramen", photos: [] });
    const second = await createPost(db, "cy", { place: CEBU, caption: "", photos: ["https://example.test/a.jpg"] });
    expect(await setLike(db, "ben", first.id, true)).toEqual({ likeCount: 1, likedByMe: true });
    await setLike(db, "ben", first.id, true);
    await setLike(db, "cy", first.id, true);

    const benFeed = await listFeed(db, "ben");
    expect(benFeed.map((p) => p.id)).toEqual([second.id, first.id]);
    expect(benFeed[1]).toMatchObject({ likeCount: 2, likedByMe: true, caption: "Ramen", place: POBLACION });
    expect((await listFeed(db, "ana"))[1]).toMatchObject({ likeCount: 2, likedByMe: false });

    expect(await setLike(db, "ben", first.id, false)).toEqual({ likeCount: 1, likedByMe: false });
    await expect(setLike(db, "ben", "00000000-0000-0000-0000-000000000000", true)).rejects.toBeInstanceOf(NotAllowedError);
  });
});

describe("messages", () => {
  it("only flow between friends and are named after the other person", async () => {
    await expect(sendMessage(db, "ana", "cy", "hi")).rejects.toBeInstanceOf(NotAllowedError);
    const m1 = await sendMessage(db, "ana", "ben", "Ramen tonight?");
    const m2 = await sendMessage(db, "ben", "ana", "Yes!");
    expect(m1).toMatchObject({ threadId: "ben", fromId: "ana" });

    const thread = await listThread(db, "ana", "ben");
    expect(thread.map((m) => m.text)).toEqual(["Ramen tonight?", "Yes!"]);
    expect(thread.every((m) => m.threadId === "ben")).toBe(true);
    expect((await listThread(db, "ben", "ana")).every((m) => m.threadId === "ana")).toBe(true);

    expect(await latestMessagePerThread(db, "ana")).toEqual([{ ...m2, threadId: "ben" }]);
  });

  it("announce themselves on the realtime channel", async () => {
    const events: string[] = [];
    const unlisten = await pg.listen("sponty_events", (payload) => events.push(payload));
    await sendMessage(db, "ana", "ben", "ping");
    await addFriend(db, "ana", "cy");
    await new Promise((r) => setTimeout(r, 50));
    await unlisten();

    const parsed = events.map((e) => JSON.parse(e));
    expect(parsed[0]).toMatchObject({ type: "message", to: ["ana", "ben"], message: { senderId: "ana", recipientId: "ben", text: "ping" } });
    expect(typeof parsed[0].message.createdAt).toBe("number");
    expect(parsed.slice(1)).toEqual(
      expect.arrayContaining([
        { type: "friend", to: ["ana"], friendId: "cy" },
        { type: "friend", to: ["cy"], friendId: "ana" },
      ]),
    );
  });
});

describe("reviews", () => {
  it("are found within the circle and not outside it", async () => {
    const near = await createReview(db, "ben", { placeName: "Corner ramen", category: "food", rating: 5, text: "Great", lat: 14.5652, lng: 121.0297 });
    // ~330m away: inside the old square box, outside the 250m circle.
    await createReview(db, "cy", { placeName: "Far stall", category: "food", rating: 3, text: "Ok", lat: 14.5649 + 0.0021, lng: 121.03 + 0.0021 });
    await createReview(db, "cy", { placeName: "Cebu spot", category: "spot", rating: 4, text: "Nice", lat: CEBU.lat, lng: CEBU.lng });

    const found = await reviewsNear(db, POBLACION);
    expect(found.reviews.map((r) => r.id)).toEqual([near.id]);
    expect(found.users.map((u) => u.id)).toEqual(["ben"]);
    expect(found.reviews[0]).toMatchObject({ placeName: "Corner ramen", category: "food", rating: 5 });
  });
});

describe("snapshot", () => {
  it("bundles me, friends, the feed and latest messages", async () => {
    const snap = await loadSnapshot(db, { id: "ana", name: "Ana Cruz" });
    expect(snap.me.id).toBe("ana");
    expect(snap.friends.sort()).toEqual(["ben", "cy"]);
    expect(snap.posts.length).toBe(2);
    expect(new Set(snap.users.map((u) => u.id))).toEqual(new Set(["ana", "ben", "cy"]));
    expect(snap.messages.map((m) => m.text)).toEqual(["ping"]);
  });
});

describe("account deletion", () => {
  it("removes the user and everything they own, leaving others intact", async () => {
    await createUserAndProfile("eve");
    await addFriend(db, "eve", "ana");
    const post = await createPost(db, "eve", { place: POBLACION, caption: "Bye", photos: ["/api/uploads/posts/eve/x.jpg"] });
    await setLike(db, "ana", post.id, true);
    const anaPost = (await listFeed(db, "ana")).find((p) => p.authorId === "ana")!;
    await setLike(db, "eve", anaPost.id, true);
    await sendMessage(db, "eve", "ana", "hi");
    await sendMessage(db, "ana", "eve", "hello");
    await createReview(db, "eve", { placeName: "Spot", category: "spot", rating: 4, text: "Nice", lat: POBLACION.lat, lng: POBLACION.lng });
    await consumeRateLimit(db, "match:minute:eve", 6, 60);
    await consumeRateLimit(db, "match:minute:xeve", 6, 60);

    const { photoUrls } = await deleteUserData(db, "eve");

    expect(photoUrls).toEqual(["/api/uploads/posts/eve/x.jpg"]);
    const count = async (table: string, where: string) =>
      Number((await pg.query<{ n: number }>(`select count(*)::int as n from ${table} where ${where}`)).rows[0].n);
    expect(await count("users", "id = 'eve'")).toBe(0);
    expect(await count("profiles", "user_id = 'eve'")).toBe(0);
    expect(await count("friendships", "user_id = 'eve' or friend_id = 'eve'")).toBe(0);
    expect(await count("posts", "author_id = 'eve'")).toBe(0);
    expect(await count("post_likes", "user_id = 'eve'")).toBe(0);
    expect(await count("messages", "sender_id = 'eve' or recipient_id = 'eve'")).toBe(0);
    expect(await count("reviews", "author_id = 'eve'")).toBe(0);
    expect(await count("rate_limits", "key = 'match:minute:eve'")).toBe(0);
    expect(await count("rate_limits", "key = 'match:minute:xeve'")).toBe(1);
    expect((await listFeed(db, "ana")).find((p) => p.id === anaPost.id)?.likeCount).toBe(anaPost.likeCount);
    expect(await listFriendIds(db, "ana")).not.toContain("eve");
  });
});

describe("rate limits", () => {
  it("allow up to the limit per window, then report when to retry", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await consumeRateLimit(db, "test:a", 3, 60));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results[2].remaining).toBe(0);
    expect(results[3].retryAfterSec).toBeGreaterThan(0);
    expect(results[3].retryAfterSec).toBeLessThanOrEqual(60);
    expect((await consumeRateLimit(db, "test:b", 3, 60)).ok).toBe(true);
  });

  it("resets once the window has passed", async () => {
    await consumeRateLimit(db, "test:c", 1, 60);
    await pg.query("update rate_limits set window_start = now() - interval '2 minutes' where key = 'test:c'");
    expect(await consumeRateLimit(db, "test:c", 1, 60)).toMatchObject({ ok: true, remaining: 0 });
  });
});
