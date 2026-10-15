import "server-only";
import { Client } from "pg";
import type { RealtimeEvent } from "@/lib/realtime-events";

/**
 * Fans Postgres NOTIFY events out to open event streams.
 *
 * Each server instance keeps ONE dedicated LISTEN connection, shared by every
 * stream it serves, so connections scale with instances rather than with
 * users. Triggers on `messages` and `friendships` publish the events (see the
 * geo_and_realtime migration), so any writer is covered.
 */

const CHANNEL = "sponty_events";
const IDLE_CLOSE_MS = 30_000;

type Listener = (event: RealtimeEvent) => void;
type Subscriber = { onEvent: Listener; onDisconnect: () => void };

const subscribers = new Map<string, Set<Subscriber>>();
let client: Client | null = null;
let connecting: Promise<Client> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function subscriberCount() {
  let n = 0;
  for (const set of subscribers.values()) n += set.size;
  return n;
}

function dropConnection() {
  const c = client;
  client = null;
  connecting = null;
  // Streams end so their EventSource reconnects and resyncs on a fresh connection.
  for (const set of subscribers.values()) for (const s of set) s.onDisconnect();
  subscribers.clear();
  c?.end().catch(() => {});
}

async function connect(): Promise<Client> {
  if (client) return client;
  connecting ??= (async () => {
    // LISTEN needs a session, so it can't go through a transaction pooler.
    const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    const c = new Client({ connectionString });
    c.on("notification", (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      let event: RealtimeEvent & { to: string[] };
      try {
        event = JSON.parse(msg.payload);
      } catch {
        return;
      }
      const { to, ...rest } = event;
      for (const userId of new Set(to)) for (const s of subscribers.get(userId) ?? []) s.onEvent(rest as RealtimeEvent);
    });
    c.on("error", (err) => {
      console.error("realtime: listener connection failed", err);
      if (client === c) dropConnection();
    });
    c.on("end", () => {
      if (client === c) dropConnection();
    });
    try {
      await c.connect();
      await c.query(`LISTEN ${CHANNEL}`);
    } catch (err) {
      connecting = null;
      c.end().catch(() => {});
      throw err;
    }
    client = c;
    return c;
  })();
  return connecting;
}

/** Subscribes a stream to events for `userId`. Resolves once the listener is live. */
export async function subscribe(userId: string, onEvent: Listener, onDisconnect: () => void): Promise<() => void> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  await connect();
  const sub: Subscriber = { onEvent, onDisconnect };
  let set = subscribers.get(userId);
  if (!set) subscribers.set(userId, (set = new Set()));
  set.add(sub);

  return () => {
    const s = subscribers.get(userId);
    s?.delete(sub);
    if (s && s.size === 0) subscribers.delete(userId);
    if (subscriberCount() === 0 && !idleTimer) {
      idleTimer = setTimeout(() => {
        idleTimer = null;
        if (subscriberCount() === 0 && client) {
          const c = client;
          client = null;
          connecting = null;
          c.end().catch(() => {});
        }
      }, IDLE_CLOSE_MS);
    }
  };
}
