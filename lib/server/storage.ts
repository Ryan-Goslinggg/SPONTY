import "server-only";
import { del, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Photo storage. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set, and a
 * local folder otherwise so development works offline. Production refuses
 * the local driver because serverless disks are ephemeral.
 */

export const PHOTO_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
export type PhotoType = keyof typeof PHOTO_TYPES;
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

const LOCAL_ROOT = path.join(process.cwd(), ".data", "uploads");
const LOCAL_URL_PREFIX = "/api/uploads/";
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export function blobEnabled(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export function assertStorageConfigured() {
  if (!blobEnabled() && process.env.VERCEL) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set. Connect a Vercel Blob store to this project.");
  }
}

/** Every photo lives under its owner's folder, which is how posts prove they own their photos. */
function ownerPrefix(userId: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(userId)) throw new Error("Unexpected user id format");
  return `posts/${userId}/`;
}

/** Checks magic bytes so a renamed file can't pose as an image. */
export function sniffPhotoType(bytes: Uint8Array): PhotoType | null {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export async function savePhoto(userId: string, bytes: Uint8Array, type: PhotoType): Promise<string> {
  assertStorageConfigured();
  const key = `${ownerPrefix(userId)}${randomUUID()}.${PHOTO_TYPES[type]}`;
  if (blobEnabled()) {
    const blob = await put(key, Buffer.from(bytes), {
      access: "public",
      contentType: type,
      addRandomSuffix: false,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return blob.url;
  }
  const file = path.join(LOCAL_ROOT, ...key.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return `${LOCAL_URL_PREFIX}${key}`;
}

/** True when `url` is a photo this user uploaded through `savePhoto`. */
export function isOwnPhotoUrl(userId: string, url: string): boolean {
  const prefix = ownerPrefix(userId);
  if (blobEnabled()) {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return false;
    }
    return u.protocol === "https:" && u.hostname.endsWith(BLOB_HOST_SUFFIX) && u.pathname.startsWith(`/${prefix}`) && !u.search;
  }
  return url.startsWith(`${LOCAL_URL_PREFIX}${prefix}`) && LOCAL_KEY.test(url.slice(LOCAL_URL_PREFIX.length));
}

/**
 * Deletes a user's photos. Only URLs inside their own folder are touched, so
 * demo photos and anything else stay put. Best effort: missing files are fine.
 */
export async function deleteOwnPhotos(userId: string, urls: string[]): Promise<void> {
  const own = urls.filter((url) => isOwnPhotoUrl(userId, url));
  if (own.length === 0) return;
  if (blobEnabled()) {
    await del(own);
    return;
  }
  await Promise.all(
    own.map((url) => rm(path.join(LOCAL_ROOT, ...url.slice(LOCAL_URL_PREFIX.length).split("/")), { force: true })),
  );
}

const LOCAL_KEY = /^posts\/[A-Za-z0-9_-]+\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

/** Reads a photo saved by the local driver. Returns null for unknown or malformed keys. */
export async function readLocalPhoto(key: string): Promise<{ bytes: Buffer; type: PhotoType } | null> {
  if (blobEnabled() || !LOCAL_KEY.test(key)) return null;
  const ext = key.slice(key.lastIndexOf(".") + 1);
  const type = (Object.keys(PHOTO_TYPES) as PhotoType[]).find((t) => PHOTO_TYPES[t] === ext)!;
  try {
    return { bytes: await readFile(path.join(LOCAL_ROOT, ...key.split("/"))), type };
  } catch {
    return null;
  }
}
