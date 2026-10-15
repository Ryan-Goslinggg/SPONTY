import { getSessionUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { consumeRateLimit } from "@/lib/server/queries";
import { MAX_PHOTO_BYTES, savePhoto, sniffPhotoType } from "@/lib/server/storage";

export const runtime = "nodejs";

/** Stores one photo for a post and returns its public URL. The browser compresses photos before sending. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in to upload photos" }, { status: 401 });

  const limit = await consumeRateLimit(getDb(), `upload:${user.id}`, 60, 60 * 60);
  if (!limit.ok) {
    return Response.json(
      { error: "Too many uploads. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("photo");
  } catch {
    return Response.json({ error: "Expected a multipart form with a photo" }, { status: 400 });
  }
  if (!(file instanceof File)) return Response.json({ error: "Missing photo" }, { status: 400 });
  if (file.size > MAX_PHOTO_BYTES) return Response.json({ error: "Photo is too large" }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffPhotoType(bytes);
  if (!type) return Response.json({ error: "Only JPEG, PNG or WebP photos" }, { status: 415 });

  const url = await savePhoto(user.id, bytes, type);
  return Response.json({ url }, { status: 201 });
}
