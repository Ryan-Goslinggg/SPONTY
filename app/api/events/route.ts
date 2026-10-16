import { getSessionUser } from "@/lib/server/auth";
import { acquireStreamSlot, subscribe } from "@/lib/server/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const HEARTBEAT_MS = 20_000;
// End the stream before the platform kills the function; EventSource reconnects on its own.
const STREAM_MS = (maxDuration - 20) * 1000;

/** Server-sent events for the signed-in user: new messages and new friends, as they happen. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const releaseSlot = acquireStreamSlot(user.id);
  if (!releaseSlot) return new Response("Too many open streams", { status: 429, headers: { "Retry-After": "30" } });

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      const timers: { heartbeat?: ReturnType<typeof setInterval>; deadline?: ReturnType<typeof setTimeout> } = {};
      let unsubscribe = () => {};
      const close = () => {
        if (closed) return;
        closed = true;
        releaseSlot();
        clearInterval(timers.heartbeat);
        clearTimeout(timers.deadline);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      };
      cleanup = close;
      req.signal.addEventListener("abort", close);

      try {
        unsubscribe = await subscribe(user.id, (event) => send(`data: ${JSON.stringify(event)}\n\n`), close);
      } catch (err) {
        console.error("events: could not subscribe", err);
        send("retry: 5000\n\n");
        close();
        return;
      }
      if (closed) {
        unsubscribe();
        return;
      }
      // "ready" tells the client the listener is live, so a resync now can't miss anything.
      send("retry: 2000\nevent: ready\ndata: {}\n\n");
      timers.heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      timers.deadline = setTimeout(close, STREAM_MS);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
