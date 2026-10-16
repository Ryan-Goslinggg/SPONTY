"use server";

import { z } from "zod";
import { coarsenPlace } from "@/lib/geo";
import type { Message, Post, Review, Snapshot, User } from "@/lib/types";
import { headers } from "next/headers";
import { getAuth, requireUser, UnauthorizedError } from "./auth";
import { getDb } from "./db";
import { IdInput, LatLngInput, MessageInput, PostInput, ProfilePatchInput, ReviewInput } from "./inputs";
import * as q from "./queries";
import { deleteOwnPhotos, isOwnPhotoUrl } from "./storage";

/**
 * Server actions behind the client store. Each one authenticates, validates
 * its input and then calls into `queries`. Failures come back as values
 * (not throws) so the store can roll back and show the message.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

// Not exported: a "use server" file may only export async functions.
class RateLimitedError extends Error {
  constructor(public retryAfterSec: number) {
    super(`You're doing that too fast. Try again in ${retryAfterSec} seconds.`);
  }
}

/**
 * Per-user caps on write actions, so a scripted client can't flood other
 * people with messages, fake reviews or friend-adds. They are counted in
 * Postgres, so they hold across serverless instances. Each is well above
 * what a person does by hand; see SECURITY.md before changing them.
 */
const WRITE_LIMITS = {
  post: { max: 10, windowSec: 60 * 60 },
  message: { max: 30, windowSec: 60 },
  review: { max: 20, windowSec: 60 * 60 },
  friend: { max: 30, windowSec: 60 * 60 },
  like: { max: 120, windowSec: 60 },
  profile: { max: 30, windowSec: 60 * 60 },
} as const;

async function limit(meId: string, kind: keyof typeof WRITE_LIMITS) {
  const { max, windowSec } = WRITE_LIMITS[kind];
  const res = await q.consumeRateLimit(getDb(), `action:${kind}:${meId}`, max, windowSec);
  if (!res.ok) throw new RateLimitedError(res.retryAfterSec);
}

async function run<T>(fn: (me: { id: string; name: string }) => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn(await requireUser()) };
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: "Your session ended. Please sign in again." };
    if (err instanceof RateLimitedError) return { ok: false, error: err.message };
    if (err instanceof q.NotAllowedError) return { ok: false, error: err.message };
    if (isZodError(err)) return { ok: false, error: "That doesn't look right. Check the form and try again." };
    console.error("action failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

function isZodError(err: unknown): err is z.ZodError {
  return err instanceof Error && err.name === "ZodError";
}

export async function getSnapshotAction(): Promise<Result<Snapshot>> {
  return run((me) => q.loadSnapshot(getDb(), me));
}

export async function updateProfileAction(patch: unknown): Promise<Result<User>> {
  return run(async (me) => {
    const parsed = ProfilePatchInput.parse(patch);
    await limit(me.id, "profile");
    // Coarsen here too, not just in the UI: a user's exact location must never be stored.
    const safe = parsed.location ? { ...parsed, location: coarsenPlace(parsed.location) } : parsed;
    return q.updateProfile(getDb(), me.id, safe);
  });
}

export async function createPostAction(input: unknown): Promise<Result<Post>> {
  return run(async (me) => {
    const post = PostInput.parse(input);
    if (!post.photos.every((url) => isOwnPhotoUrl(me.id, url))) throw new q.NotAllowedError("Photos must be uploaded first");
    await limit(me.id, "post");
    return q.createPost(getDb(), me.id, post);
  });
}

export async function setLikeAction(postId: unknown, liked: boolean): Promise<Result<Pick<Post, "likeCount" | "likedByMe">>> {
  return run(async (me) => {
    const id = z.uuid().parse(postId);
    await limit(me.id, "like");
    return q.setLike(getDb(), me.id, id, liked === true);
  });
}

export async function addFriendAction(friendId: unknown): Promise<Result<User>> {
  return run(async (me) => {
    await limit(me.id, "friend");
    return q.addFriend(getDb(), me.id, IdInput.parse(friendId));
  });
}

export async function getUsersAction(ids: unknown): Promise<Result<User[]>> {
  return run(() => q.getUsers(getDb(), IdInput.array().max(100).parse(ids)));
}

export async function sendMessageAction(input: unknown): Promise<Result<Message>> {
  return run(async (me) => {
    const { friendId, text } = MessageInput.parse(input);
    await limit(me.id, "message");
    return q.sendMessage(getDb(), me.id, friendId, text);
  });
}

export async function loadThreadAction(friendId: unknown): Promise<Result<Message[]>> {
  return run((me) => q.listThread(getDb(), me.id, IdInput.parse(friendId)));
}

export async function createReviewAction(input: unknown): Promise<Result<Review>> {
  return run(async (me) => {
    const review = ReviewInput.parse(input);
    await limit(me.id, "review");
    return q.createReview(getDb(), me.id, review);
  });
}

export async function reviewsNearAction(center: unknown): Promise<Result<{ reviews: Review[]; users: User[] }>> {
  return run(async (me) => {
    const at = LatLngInput.parse(center);
    // Generous for real panning, but caps scraping the whole review table by sweeping the map.
    const res = await q.consumeRateLimit(getDb(), `action:nearby:${me.id}`, 200, 60);
    if (!res.ok) throw new RateLimitedError(res.retryAfterSec);
    return q.reviewsNear(getDb(), at);
  });
}

/**
 * Permanently deletes the signed-in account and all of its data: profile,
 * sessions, friendships, posts and their photos, likes, messages (sent and
 * received) and reviews. Signs the browser out first.
 */
export async function deleteAccountAction(): Promise<Result<null>> {
  return run(async (me) => {
    // Clears the session cookie in this response (via the nextCookies plugin).
    await getAuth().api.signOut({ headers: await headers() });
    const { photoUrls } = await q.deleteUserData(getDb(), me.id);
    try {
      await deleteOwnPhotos(me.id, photoUrls);
    } catch (err) {
      // The account is already gone; orphaned files are unreachable from the app.
      console.error("deleteAccount: some photos could not be removed", err);
    }
    return null;
  });
}
