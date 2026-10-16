/**
 * Local load test for Sponty. It plays a crowd of users hammering the read
 * paths against YOUR OWN local server and reports how it copes: throughput,
 * latency percentiles and the error mix. Pair it with attack.ts, which checks
 * that specific abuses are blocked.
 *
 *   npm run dev            (in another terminal)
 *   npm run security:load
 *
 * It refuses any target that isn't localhost unless STRESS_ALLOW_REMOTE=1,
 * because it generates heavy traffic. Never point it at a deployment you don't own.
 *
 * It reuses the two accounts attack.ts created (.data/security-accounts.json).
 * Run attack.ts first, or it will create them (and spend a few sign-ins).
 */
import { existsSync, readFileSync } from "node:fs";
import { Client } from "./client";

const BASE = process.env.STRESS_BASE_URL ?? "http://localhost:3000";
const VIRTUAL_USERS = Number(process.env.STRESS_USERS ?? 20);
const DURATION_MS = Number(process.env.STRESS_SECONDS ?? 15) * 1000;
const ACCOUNTS_FILE = ".data/security-accounts.json";

const NEAR = { lat: 14.5649, lng: 121.03 };

interface Sample {
  ms: number;
  status: number;
  action: string;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function timed(samples: Sample[], action: string, fn: () => Promise<number>) {
  const t = performance.now();
  let status = 0;
  try {
    status = await fn();
  } catch {
    status = 0; // network error / connection refused
  }
  samples.push({ ms: performance.now() - t, status, action });
}

/** One virtual user: loop realistic reads until the clock runs out. */
async function virtualUser(client: Client, samples: Sample[], until: number) {
  const steps: [string, () => Promise<number>][] = [
    ["getSnapshot", async () => statusOf(await client.action("getSnapshotAction"))],
    ["reviewsNear", async () => statusOf(await client.action("reviewsNearAction", NEAR))],
    ["feedPage", () => client.fetch("/").then((r) => drain(r))],
  ];
  while (performance.now() < until) {
    for (const [name, fn] of steps) {
      if (performance.now() >= until) break;
      await timed(samples, name, fn);
    }
  }
}

const statusOf = (r: unknown) => (r && typeof r === "object" && "ok" in r ? ((r as { ok: boolean }).ok ? 200 : 409) : 500);
async function drain(r: Response): Promise<number> {
  await r.body?.cancel();
  return r.status;
}

async function signIn(creds: { email: string; password: string }, label: string): Promise<Client> {
  const c = new Client(BASE, label);
  const res = await c.signIn(creds.email, creds.password);
  if (!res.ok) throw new Error(`${label}: sign-in failed (${res.status}). Run the attack suite first to create accounts.`);
  await c.fetch("/"); // warm the action manifest
  return c;
}

async function main() {
  const host = new URL(BASE).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host) && process.env.STRESS_ALLOW_REMOTE !== "1") {
    throw new Error(`Refusing to load-test ${BASE}. Set STRESS_ALLOW_REMOTE=1 only for a deployment you own.`);
  }
  if (!existsSync(ACCOUNTS_FILE)) throw new Error("No accounts yet. Run `npm run security:attack` once first.");
  const creds = JSON.parse(readFileSync(ACCOUNTS_FILE, "utf8")) as { attacker: { email: string; password: string }; victim: { email: string; password: string } };

  console.log(`Load test: ${VIRTUAL_USERS} virtual users for ${DURATION_MS / 1000}s against ${BASE}\n`);
  // Two signed-in sessions shared across the virtual users (sign-in is rate limited, so we don't make one each).
  const sessions = await Promise.all([signIn(creds.attacker, "load-a"), signIn(creds.victim, "load-b")]);

  const samples: Sample[] = [];
  const until = performance.now() + DURATION_MS;
  const users = Array.from({ length: VIRTUAL_USERS }, (_, i) => virtualUser(sessions[i % sessions.length], samples, until));
  const wall = performance.now();
  await Promise.all(users);
  const elapsed = (performance.now() - wall) / 1000;

  report(samples, elapsed);
}

function report(samples: Sample[], elapsed: number) {
  const byAction = new Map<string, number[]>();
  const statuses = new Map<number, number>();
  for (const s of samples) {
    (byAction.get(s.action) ?? byAction.set(s.action, []).get(s.action)!).push(s.ms);
    statuses.set(s.status, (statuses.get(s.status) ?? 0) + 1);
  }

  console.log(`${samples.length} requests in ${elapsed.toFixed(1)}s = ${(samples.length / elapsed).toFixed(0)} req/s\n`);
  console.log("action        count    p50      p95      p99     max");
  for (const [action, msList] of byAction) {
    const s = [...msList].sort((a, b) => a - b);
    const f = (n: number) => `${n.toFixed(0)}ms`.padStart(7);
    console.log(`${action.padEnd(13)} ${String(s.length).padStart(5)}  ${f(percentile(s, 50))}  ${f(percentile(s, 95))}  ${f(percentile(s, 99))} ${f(s[s.length - 1])}`);
  }

  console.log("\nstatus mix:");
  const label: Record<number, string> = { 0: "network error", 200: "ok", 307: "redirect", 409: "rejected (expected)", 429: "rate limited", 500: "server error" };
  for (const [status, n] of [...statuses].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${String(status).padEnd(3)} ${(label[status] ?? "").padEnd(20)} ${n}`);
  }

  const serverErrors = (statuses.get(500) ?? 0) + (statuses.get(0) ?? 0);
  console.log(
    serverErrors === 0
      ? "\nHeld up: no 5xx or dropped connections. Rate limiting (429) is the only backpressure."
      : `\nWARNING: ${serverErrors} requests hit a server error or dropped connection under load.`,
  );
  if (serverErrors > samples.length * 0.01) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
