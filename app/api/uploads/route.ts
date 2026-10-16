import { getSessionUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { forbiddenCrossSite, isCrossSite, tooManyRequests } from "@/lib/server/http";
import { MalformedImageError, stripJpegMetadata } from "@/lib/server/jpeg";
import { consumeRateLimit } from "@/lib/server/queries";
import { MAX_PHOTO_BYTES, savePhoto, sniffPhotoType } from "@/lib/server/storage";

export const runtime = "nodejs";

/** Multipart framing around the photo is small; anything bigger is refused before it is read. */
const MAX_BODY_BYTES = MAX_PHOTO_BYTES + 64 * 1024;

/**
 * Stores one photo for a post and returns its public URL. The browser
 * re-encodes photos to JPEG before sending, so only JPEG is accepted, and
 * its metadata (EXIF GPS, XMP, comments) is stripped before storage.
 */
export async function POST(req: Request) {
  if (isCrossSite(req)) return forbiddenCrossSite();
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in to upload photos" }, { status: 401 });

  const declared = Number(req.headers.get("content-length"));
  if (declared > MAX_BODY_BYTES) return Response.json({ error: "Photo is too large" }, { status: 413 });

  const limit = await consumeRateLimit(getDb(), `upload:${user.id}`, 30, 60 * 60);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec, "Too many uploads. Try again later.");

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("photo");
  } catch {
    return Response.json({ error: "Expected a multipart form with a photo" }, { status: 400 });
  }
  if (!(file instanceof File)) return Response.json({ error: "Missing photo" }, { status: 400 });
  if (file.size > MAX_PHOTO_BYTES) return Response.json({ error: "Photo is too large" }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (sniffPhotoType(bytes) !== "image/jpeg") return Response.json({ error: "Only JPEG photos are accepted" }, { status: 415 });

  let clean: Uint8Array;
  try {
    clean = stripJpegMetadata(bytes);
  } catch (err) {
    if (err instanceof MalformedImageError) return Response.json({ error: "That photo looks damaged" }, { status: 415 });
    throw err;
  }

  const url = await savePhoto(user.id, clean, "image/jpeg");
  return Response.json({ url }, { status: 201 });
}
