"use server";

import { z } from "zod";
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

async function run<T>(fn: (me: { id: string; name: string }) => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn(await requireUser()) };
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: "Your session ended. Please sign in again." };
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
  return run((me) => q.updateProfile(getDb(), me.id, ProfilePatchInput.parse(patch)));
}

export async function createPostAction(input: unknown): Promise<Result<Post>> {
  return run(async (me) => {
    const post = PostInput.parse(input);
    if (!post.photos.every((url) => isOwnPhotoUrl(me.id, url))) throw new q.NotAllowedError("Photos must be uploaded first");
    return q.createPost(getDb(), me.id, post);
  });
}

export async function setLikeAction(postId: unknown, liked: boolean): Promise<Result<Pick<Post, "likeCount" | "likedByMe">>> {
  return run((me) => q.setLike(getDb(), me.id, z.uuid().parse(postId), liked === true));
}

export async function addFriendAction(friendId: unknown): Promise<Result<User>> {
  return run((me) => q.addFriend(getDb(), me.id, IdInput.parse(friendId)));
}

export async function getUsersAction(ids: unknown): Promise<Result<User[]>> {
  return run(() => q.getUsers(getDb(), IdInput.array().max(100).parse(ids)));
}

export async function sendMessageAction(input: unknown): Promise<Result<Message>> {
  return run((me) => {
    const { friendId, text } = MessageInput.parse(input);
    return q.sendMessage(getDb(), me.id, friendId, text);
  });
}

export async function loadThreadAction(friendId: unknown): Promise<Result<Message[]>> {
  return run((me) => q.listThread(getDb(), me.id, IdInput.parse(friendId)));
}

export async function createReviewAction(input: unknown): Promise<Result<Review>> {
  return run((me) => q.createReview(getDb(), me.id, ReviewInput.parse(input)));
}

export async function reviewsNearAction(center: unknown): Promise<Result<{ reviews: Review[]; users: User[] }>> {
  return run(() => q.reviewsNear(getDb(), LatLngInput.parse(center)));
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
