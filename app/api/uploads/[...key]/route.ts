import { readLocalPhoto } from "@/lib/server/storage";

export const runtime = "nodejs";

/** Serves photos saved by the local storage driver. With Vercel Blob, photos are served by Blob directly. */
export async function GET(_req: Request, ctx: RouteContext<"/api/uploads/[...key]">) {
  const { key } = await ctx.params;
  const photo = await readLocalPhoto(key.join("/"));
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": photo.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
