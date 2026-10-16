/**
 * Sponty attack suite. Plays an attacker against a running Sponty server and
 * reports which attacks were blocked. See SECURITY.md.
 *
 *   npm run dev            (in another terminal)
 *   npm run security:attack
 *
 * It only targets localhost unless ATTACK_ALLOW_REMOTE=1, because it creates
 * accounts, floods endpoints and trips rate limits. Never point it at a
 * deployment you don't own.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Client } from "./client";
import * as fx from "./fixtures";

const BASE = process.env.ATTACK_BASE_URL ?? "http://localhost:3000";
const EVIL = "https://evil.example";
const ACCOUNTS_FILE = ".data/security-accounts.json";
const NULL_ISLAND = { lat: 0.0001, lng: 0.0001 };

type Status = "blocked" | "VULNERABLE" | "warn";
interface Finding {
  category: string;
  attack: string;
  status: Status;
  detail: string;
}
const findings: Finding[] = [];
let category = "";

type Outcome = { blocked: boolean; detail: string; warnOnly?: boolean };

async function attack(name: string, fn: () => Promise<Outcome>) {
  let o: Outcome;
  try {
    o = await fn();
  } catch (err) {
    o = { blocked: false, detail: `attack crashed: ${(err as Error).message}` };
  }
  const status: Status = o.blocked ? "blocked" : o.warnOnly ? "warn" : "VULNERABLE";
  findings.push({ category, attack: name, status, detail: o.detail });
  const mark = status === "blocked" ? "  ok  " : status === "warn" ? " warn " : " FAIL ";
  console.log(`[${mark}] ${category} / ${name} - ${o.detail}`);
}

type Res<T> = { ok: true; data: T } | { ok: false; error: string } | { thrown: string };
const rejected = (r: Res<unknown>) => !("ok" in r) || !r.ok;
const describe = (r: Res<unknown>) => ("thrown" in r ? `threw "${r.thrown}"` : r.ok ? "accepted" : `rejected: ${r.error}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Creds {
  email: string;
  password: string;
}

/** Signed-in session cookies seen during setup, for the cookie flag check. */
const sessionCookies: string[] = [];

async function account(label: string, creds: Creds): Promise<Client> {
  const c = new Client(BASE, label);
  let res = await c.signIn(creds.email, creds.password);
  sessionCookies.push(...res.headers.getSetCookie());
  if (res.status === 401) res = await c.signUp(label, creds.email, creds.password);
  if (res.status === 429) throw new Error(`${label}: rate limited while signing in. Wait a minute and rerun.`);
  if (!res.ok) throw new Error(`${label}: could not sign in or up (${res.status} ${await res.text()})`);
  return c;
}

function loadCreds(): { attacker: Creds; victim: Creds } {
  if (existsSync(ACCOUNTS_FILE)) return JSON.parse(readFileSync(ACCOUNTS_FILE, "utf8"));
  const make = (who: string) => ({ email: `${who}-${randomBytes(4).toString("hex")}@security.test`, password: randomBytes(18).toString("base64url") });
  const creds = { attacker: make("attacker"), victim: make("victim") };
  mkdirSync(".data", { recursive: true });
  writeFileSync(ACCOUNTS_FILE, JSON.stringify(creds, null, 2));
  return creds;
}

async function upload(c: Client, data: Uint8Array | string, type: string, filename = "photo.jpg", init: { origin?: string | null } = {}) {
  const form = new FormData();
  form.append("photo", new Blob([typeof data === "string" ? data : Buffer.from(data)], { type }), filename);
  return c.fetch("/api/uploads", { method: "POST", body: form, ...init });
}

async function main() {
  const host = new URL(BASE).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host) && process.env.ATTACK_ALLOW_REMOTE !== "1") {
    throw new Error(`Refusing to attack ${BASE}. Set ATTACK_ALLOW_REMOTE=1 only for a deployment you own.`);
  }
  console.log(`Attacking ${BASE}\n`);

  const creds = loadCreds();
  const attacker = await account("Attacker", creds.attacker);
  const victim = await account("Victim", creds.victim);
  // Spare sessions for attacks that sign out. The sign-in limit is 5 per minute, so setup uses 4.
  const spareA = await account("Victim (second device)", creds.victim);
  const spareB = await account("Victim (third device)", creds.victim);
  const anon = new Client(BASE, "anonymous");
  // Make sure Next has compiled the app (and its action manifest).
  await attacker.fetch("/");

  type Snap = { me: { id: string; name: string; handle: string; tint: string; location: { name: string; lat: number; lng: number } } };
  const snap = (await attacker.action<Res<Snap>>("getSnapshotAction")) as Res<Snap>;
  if (!("ok" in snap) || !snap.ok) throw new Error(`attacker snapshot failed: ${describe(snap)}`);
  const attackerMe = snap.data.me;
  const victimSnap = (await victim.action<Res<Snap>>("getSnapshotAction")) as Res<Snap>;
  if (!("ok" in victimSnap) || !victimSnap.ok) throw new Error("victim snapshot failed");
  const victimId = victimSnap.data.me.id;

  // ------------------------------------------------------------ authentication
  category = "Authentication";

  await attack("Open app pages without signing in", async () => {
    const res = await anon.fetch("/chat");
    return { blocked: res.status >= 300 && res.status < 400 && /sign-in/.test(res.headers.get("location") ?? ""), detail: `GET /chat -> ${res.status} ${res.headers.get("location") ?? ""}` };
  });

  await attack("Call APIs without a session", async () => {
    const codes = await Promise.all([
      anon.fetch("/api/match", { method: "POST" }).then((r) => r.status),
      upload(anon, fx.jpegWithMetadata(), "image/jpeg").then((r) => r.status),
      anon.fetch("/api/events").then((r) => r.status),
    ]);
    return { blocked: codes.every((c) => c === 401), detail: `match/uploads/events -> ${codes.join(", ")}` };
  });

  await attack("Call a server action without a session", async () => {
    const r = await anon.action<Res<unknown>>("getSnapshotAction");
    return { blocked: rejected(r as Res<unknown>), detail: describe(r as Res<unknown>) };
  });

  await attack("Forge a session cookie", async () => {
    const forged = new Client(BASE, "forged");
    forged.cookies.set("better-auth.session_token", `${randomBytes(24).toString("base64url")}.${randomBytes(32).toString("base64url")}`);
    const res = await forged.fetch("/api/events");
    await res.body?.cancel();
    return { blocked: res.status === 401, detail: `GET /api/events with forged token -> ${res.status}` };
  });

  await attack("Steal the session cookie with JavaScript or a cross-site request", async () => {
    const cookie = sessionCookies.find((s) => /session_token=/.test(s)) ?? "";
    const httpOnly = /httponly/i.test(cookie);
    const sameSite = /samesite=(lax|strict)/i.test(cookie);
    return { blocked: httpOnly && sameSite, detail: `HttpOnly=${httpOnly} SameSite=${sameSite ? "Lax/Strict" : "missing"}` };
  });

  await attack("Reuse a session token after sign-out", async () => {
    const stolen = spareA.cookieHeader();
    await spareA.postJson("/api/auth/sign-out", {});
    const replay = await new Client(BASE, "replayer").fetch("/api/events", { headers: { cookie: stolen } });
    await replay.body?.cancel();
    return { blocked: replay.status === 401, detail: `old cookie after sign-out -> ${replay.status}` };
  });

  await attack("Sign up with a trivially short password", async () => {
    const res = await anon.signUp("Weak", `weak-${randomUUID()}@security.test`, "1234567");
    return { blocked: res.status === 400 || res.status === 422 || res.status === 429, detail: `-> ${res.status}` };
  });

  await attack("SQL injection in the sign-in email", async () => {
    const res = await anon.signIn("' OR '1'='1' --", "anything-at-all");
    return { blocked: res.status === 400 || res.status === 401 || res.status === 429, detail: `-> ${res.status}` };
  });

  await attack("Hash-flood sign-up with a 10,000 character password", async () => {
    const t = Date.now();
    const res = await anon.signUp("Flood", `dos-${randomUUID()}@security.test`, "x".repeat(10_000));
    return { blocked: res.status === 400 || res.status === 429, detail: `-> ${res.status} in ${Date.now() - t}ms` };
  });

  await attack("Find out which emails have accounts (sign-up enumeration)", async () => {
    const res = await anon.signUp("Probe", creds.victim.email, randomBytes(12).toString("hex"));
    const body = await res.text();
    const leaks = /exist/i.test(body);
    return {
      blocked: !leaks,
      warnOnly: true,
      detail: leaks ? `sign-up says the email exists (${res.status}); accepted risk until email verification exists, see SECURITY.md` : `-> ${res.status}`,
    };
  });

  // ------------------------------------------------------------- authorization
  category = "Authorization";

  await attack("Message a stranger who isn't a friend", async () => {
    const r = await attacker.action<Res<unknown>>("sendMessageAction", { friendId: "u_carlo", text: "hi from a stranger" });
    return { blocked: rejected(r as Res<unknown>), detail: describe(r as Res<unknown>) };
  });

  await attack("Mass-assign protected profile fields (handle, tint, id, email)", async () => {
    await attacker.action("updateProfileAction", { handle: "admin", tint: "red;background:url(https://evil.example/x)", id: victimId, email: "x@evil.example", userId: victimId });
    const after = (await attacker.action<Res<Snap>>("getSnapshotAction")) as Res<Snap>;
    const me = "ok" in after && after.ok ? after.data.me : null;
    const victimAfter = (await victim.action<Res<Snap>>("getSnapshotAction")) as Res<Snap>;
    const ok = me?.handle === attackerMe.handle && me?.tint === attackerMe.tint && "ok" in victimAfter && victimAfter.ok;
    return { blocked: !!ok, detail: ok ? "handle/tint unchanged, victim untouched" : `profile now ${JSON.stringify(me)}` };
  });

  await attack("Prototype pollution through a profile patch", async () => {
    const r = await attacker.action<Res<unknown>>("updateProfileAction", JSON.parse('{"__proto__":{"isAdmin":true},"constructor":{"prototype":{"isAdmin":true}}}'));
    const probe = await attacker.action<Res<unknown>>("getSnapshotAction");
    return { blocked: "ok" in (probe as object), detail: `${describe(r as Res<unknown>)}; server still healthy` };
  });

  await attack("Read anyone's email address through profile lookups", async () => {
    const r = (await attacker.action<Res<Record<string, unknown>[]>>("getUsersAction", [victimId])) as Res<Record<string, unknown>[]>;
    const leaked = "ok" in r && r.ok && r.data.some((u) => "email" in u);
    return { blocked: !leaked, detail: leaked ? "email returned" : "profiles carry no email" };
  });

  await attack("Learn someone's precise home location from their profile", async () => {
    const precise = { name: "My flat", lat: 14.5995123, lng: 120.9842456 };
    await victim.action("updateProfileAction", { location: precise });
    const r = (await attacker.action<Res<{ location: { lat: number; lng: number } }[]>>("getUsersAction", [victimId])) as Res<{ location: { lat: number; lng: number } }[]>;
    const loc = "ok" in r && r.ok ? r.data[0]?.location : null;
    const decimals = (n: number) => (String(n).split(".")[1] ?? "").length;
    const coarse = !!loc && decimals(loc.lat) <= 2 && decimals(loc.lng) <= 2;
    return { blocked: coarse, detail: loc ? `others see ${loc.lat}, ${loc.lng}` : describe(r as Res<unknown>) };
  });

  await attack("Attach a tracking pixel from another site to a post", async () => {
    const r = await attacker.action<Res<unknown>>("createPostAction", { place: { name: "X", lat: 0, lng: 0 }, caption: "x", photos: ["https://evil.example/pixel.gif"] });
    return { blocked: rejected(r as Res<unknown>), detail: describe(r as Res<unknown>) };
  });

  await attack("Attach a javascript: URL as a post photo", async () => {
    const r = await attacker.action<Res<unknown>>("createPostAction", { place: { name: "X", lat: 0, lng: 0 }, caption: "x", photos: ["javascript:alert(document.cookie)"] });
    return { blocked: rejected(r as Res<unknown>), detail: describe(r as Res<unknown>) };
  });

  await attack("Post someone else's uploaded photo as your own", async () => {
    const up = await upload(victim, fx.jpegWithMetadata(), "image/jpeg");
    const { url } = (await up.json().catch(() => ({}))) as { url?: string };
    if (!url) return { blocked: true, detail: `victim upload failed (${up.status}); nothing to steal` };
    const r = await attacker.action<Res<unknown>>("createPostAction", { place: { name: "X", lat: 0, lng: 0 }, caption: "mine now", photos: [url] });
    return { blocked: rejected(r as Res<unknown>), detail: describe(r as Res<unknown>) };
  });

  // --------------------------------------------------------- input validation
  category = "Input validation";

  await attack("Stored XSS through the display name", async () => {
    const payload = `<img src=x onerror=alert(document.cookie)>`;
    await attacker.action("updateProfileAction", { name: payload });
    const html = await (await attacker.fetch("/")).text();
    await attacker.action("updateProfileAction", { name: attackerMe.name });
    const raw = html.includes(payload);
    return { blocked: !raw, detail: raw ? "payload rendered as raw HTML" : "payload is escaped in server-rendered HTML" };
  });

  await attack("Oversized caption, message and hobby list", async () => {
    const results = await Promise.all([
      attacker.action<Res<unknown>>("createPostAction", { place: { name: "X", lat: 0, lng: 0 }, caption: "x".repeat(5000), photos: [] }),
      attacker.action<Res<unknown>>("sendMessageAction", { friendId: victimId, text: "x".repeat(5000) }),
      attacker.action<Res<unknown>>("updateProfileAction", { hobbies: Array.from({ length: 500 }, (_, i) => `h${i}`) }),
    ]);
    return { blocked: results.every((r) => rejected(r as Res<unknown>)), detail: results.map((r) => describe(r as Res<unknown>)).join(" | ") };
  });

  await attack("Type confusion and SQL in action arguments", async () => {
    const results = await Promise.all([
      attacker.action<Res<unknown>>("setLikeAction", "1' OR '1'='1", true),
      attacker.action<Res<unknown>>("reviewsNearAction", { lat: "0 or 1=1", lng: 0 }),
      attacker.action<Res<unknown>>("reviewsNearAction", { lat: 1e9, lng: 0 }),
      attacker.action<Res<unknown>>("loadThreadAction", { $ne: null }),
    ]);
    const clean = results.every((r) => "ok" in (r as object) && !(r as { ok: boolean }).ok);
    return { blocked: clean, detail: results.map((r) => describe(r as Res<unknown>)).join(" | ") };
  });

  await attack("SQL injection stored in a review is kept as plain text", async () => {
    const text = `'); DROP TABLE users; -- ${randomUUID().slice(0, 6)}`;
    const r = await attacker.action<Res<unknown>>("createReviewAction", { placeName: "Robert'); --", category: "food", rating: 5, text, ...NULL_ISLAND });
    if (rejected(r as Res<unknown>)) return { blocked: true, detail: `review not stored (${describe(r as Res<unknown>)})` };
    const near = (await attacker.action<Res<{ reviews: { text: string }[] }>>("reviewsNearAction", NULL_ISLAND)) as Res<{ reviews: { text: string }[] }>;
    const kept = "ok" in near && near.ok && near.data.reviews.some((x) => x.text === text);
    return { blocked: kept, detail: kept ? "stored and returned verbatim, users table intact" : "review missing" };
  });

  await attack("Malformed JSON body on /api/match", async () => {
    const res = await attacker.postJson("/api/match", { ai: "definitely" });
    return { blocked: res.status === 400, detail: `-> ${res.status}` };
  });

  // ------------------------------------------------------------------ uploads
  category = "Uploads";

  await attack("Upload an SVG with script (stored XSS)", async () => {
    const res = await upload(attacker, fx.SVG_XSS, "image/svg+xml", "x.svg");
    return { blocked: res.status === 415, detail: `-> ${res.status}` };
  });

  await attack("Upload HTML pretending to be a JPEG", async () => {
    const res = await upload(attacker, fx.HTML_XSS, "image/jpeg", "x.jpg");
    return { blocked: res.status === 415, detail: `-> ${res.status}` };
  });

  await attack("Upload a JPEG/HTML polyglot and get it served as HTML", async () => {
    const res = await upload(attacker, fx.jpegHtmlPolyglot(), "image/jpeg");
    if (res.status !== 201) return { blocked: true, detail: `rejected (${res.status})` };
    const { url } = (await res.json()) as { url: string };
    const served = await attacker.fetch(url);
    await served.body?.cancel();
    const safe = served.headers.get("content-type") === "image/jpeg" && served.headers.get("x-content-type-options") === "nosniff";
    return { blocked: safe, detail: `served as ${served.headers.get("content-type")}, nosniff=${served.headers.get("x-content-type-options")}` };
  });

  await attack("Leak a photo's GPS location through EXIF metadata", async () => {
    const res = await upload(attacker, fx.jpegWithMetadata(), "image/jpeg");
    if (res.status !== 201) return { blocked: false, detail: `upload failed (${res.status}), can't check` };
    const { url } = (await res.json()) as { url: string };
    const stored = new Uint8Array(await (await attacker.fetch(url)).arrayBuffer());
    const leaked = fx.containsText(stored, fx.GPS_SECRET) || fx.containsText(stored, fx.COMMENT_SECRET);
    return { blocked: !leaked, detail: leaked ? "EXIF/XMP/comment survive in the stored file" : "metadata stripped" };
  });

  await attack("Smuggle HTML after a valid JPEG's end marker", async () => {
    const smuggled = Uint8Array.from([...fx.jpegWithMetadata(), ...Buffer.from("<script>alert(document.cookie)</script>")]);
    const res = await upload(attacker, smuggled, "image/jpeg");
    if (res.status !== 201) return { blocked: true, detail: `rejected (${res.status})` };
    const { url } = (await res.json()) as { url: string };
    const stored = new Uint8Array(await (await attacker.fetch(url)).arrayBuffer());
    const kept = fx.containsText(stored, "<script>");
    return { blocked: !kept, detail: kept ? "trailing script stored" : "trailing bytes dropped" };
  });

  await attack("Upload a PNG with metadata chunks", async () => {
    const res = await upload(attacker, fx.pngHeaderOnly(), "image/png", "x.png");
    return { blocked: res.status === 415, detail: `-> ${res.status} (only re-encoded JPEGs are accepted)` };
  });

  await attack("Upload an oversized file", async () => {
    const res = await upload(attacker, fx.oversizedJpeg(6), "image/jpeg");
    return { blocked: res.status === 413, detail: `-> ${res.status}` };
  });

  await attack("Path traversal when reading photos", async () => {
    const paths = [
      "/api/uploads/..%2f..%2fpackage.json",
      "/api/uploads/posts/x/..%2f..%2f..%2f.env.local",
      "/api/uploads/posts/..%5c..%5c..%5cpackage.json",
      "/api/uploads/%2e%2e/%2e%2e/package.json",
    ];
    const res = await Promise.all(paths.map(async (p) => {
      const r = await anon.fetch(p);
      const body = await r.text();
      return { status: r.status, leaked: /dependencies|DATABASE_URL/.test(body) };
    }));
    return { blocked: res.every((r) => !r.leaked && r.status === 404), detail: res.map((r) => r.status).join(", ") };
  });

  // --------------------------------------------------------------------- CSRF
  category = "Cross-site requests";

  await attack("Cross-site upload riding the victim's cookie", async () => {
    const res = await upload(victim, fx.jpegWithMetadata(), "image/jpeg", "x.jpg", { origin: EVIL });
    return { blocked: res.status === 403, detail: `Origin ${EVIL} -> ${res.status}` };
  });

  await attack("Cross-site AI match request riding the victim's cookie", async () => {
    const res = await victim.postJson("/api/match", { ai: true }, { origin: EVIL });
    return { blocked: res.status === 403, detail: `Origin ${EVIL} -> ${res.status}` };
  });

  await attack("Cross-site server action", async () => {
    const res = await victim.fetch("/", {
      method: "POST",
      origin: EVIL,
      headers: { "next-action": (await import("./client")).actionId("deleteAccountAction"), "content-type": "text/plain;charset=UTF-8", accept: "text/x-component" },
      body: "[]",
    });
    const body = await res.text();
    return { blocked: !/"ok":true/.test(body), detail: `deleteAccountAction from ${EVIL} -> ${res.status}` };
  });

  await attack("Cross-site sign-out (login CSRF family)", async () => {
    const res = await spareB.postJson("/api/auth/sign-out", {}, { origin: EVIL });
    await spareB.postJson("/api/auth/sign-out", {});
    return { blocked: res.status === 403, detail: `-> ${res.status}` };
  });

  // ---------------------------------------------------------------- headers
  category = "Browser hardening";

  await attack("Frame the app for clickjacking, sniff types, leak referrers", async () => {
    const res = await anon.fetch("/sign-in");
    await res.body?.cancel();
    const h = (n: string) => res.headers.get(n) ?? "";
    const csp = h("content-security-policy");
    const checks = {
      "CSP script-src": /script-src [^;]*'nonce-/.test(csp) || /script-src 'self'/.test(csp),
      "frame-ancestors none": /frame-ancestors 'none'/.test(csp) || h("x-frame-options") === "DENY",
      "object-src none": /object-src 'none'/.test(csp),
      nosniff: h("x-content-type-options") === "nosniff",
      "Referrer-Policy": !!h("referrer-policy"),
      "Permissions-Policy": !!h("permissions-policy"),
      "no X-Powered-By": !h("x-powered-by"),
    };
    const missing = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    return { blocked: missing.length === 0, detail: missing.length ? `missing: ${missing.join(", ")}` : "all present" };
  });

  // -------------------------------------------------------------------- abuse
  category = "Abuse and denial of service";

  await attack("Flood a stranger with messages after an instant friend add", async () => {
    await attacker.action("addFriendAction", victimId);
    const results = await Promise.all(Array.from({ length: 40 }, (_, i) => attacker.action<Res<unknown>>("sendMessageAction", { friendId: victimId, text: `spam ${i}` })));
    const accepted = results.filter((r) => !rejected(r as Res<unknown>)).length;
    return { blocked: accepted < 40, detail: `${accepted}/40 messages accepted` };
  });

  await attack("Flood fake reviews", async () => {
    const results = await Promise.all(Array.from({ length: 25 }, (_, i) => attacker.action<Res<unknown>>("createReviewAction", { placeName: `Fake ${i}`, category: "food", rating: 5, text: "Best ever!!!", ...NULL_ISLAND })));
    const accepted = results.filter((r) => !rejected(r as Res<unknown>)).length;
    return { blocked: accepted < 25, detail: `${accepted}/25 reviews accepted` };
  });

  await attack("Burn AI credits on /api/match", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) codes.push((await attacker.postJson("/api/match", { ai: false })).status);
    return { blocked: codes.includes(429), detail: codes.join(" ") };
  });

  await attack("Hold open many realtime streams", async () => {
    const ctrls = Array.from({ length: 10 }, () => new AbortController());
    const statuses = await Promise.all(ctrls.map((ctrl) => attacker.fetch("/api/events", { signal: ctrl.signal }).then((r) => r.status).catch(() => 0)));
    ctrls.forEach((c) => c.abort());
    const open = statuses.filter((s) => s === 200).length;
    return { blocked: open <= 5, detail: `${open}/10 streams opened` };
  });

  // Brute force goes last: it trips the per-IP sign-in limit for a minute.
  category = "Brute force";

  await attack("Guess a password repeatedly", async () => {
    const email = `nobody-${randomUUID()}@security.test`;
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await anon.signIn(email, `guess-${i}-xxxxxxxx`)).status);
    return { blocked: codes.includes(429), detail: codes.join(" ") };
  });

  await attack("Dodge the limit by rotating X-Forwarded-For, one account", async () => {
    // A fresh target each run, so the suite's own accounts never get locked out.
    const target = `lockout-${randomUUID()}@security.test`;
    const codes: number[] = [];
    for (let i = 0; i < 14; i++) {
      const ip = `203.0.113.${i + 1}`;
      codes.push((await anon.signIn(target, `wrong-${i}-xxxxxxxx`, { "x-forwarded-for": ip, "x-real-ip": ip, "x-vercel-forwarded-for": ip })).status);
    }
    return { blocked: codes.includes(429), detail: codes.join(" ") };
  });

  await attack("Credential stuffing: many accounts, rotating X-Forwarded-For", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) {
      const ip = `198.51.100.${i + 1}`;
      codes.push((await anon.signIn(`stuff-${randomUUID()}@security.test`, "password123", { "x-forwarded-for": ip })).status);
    }
    const local = ["localhost", "127.0.0.1", "::1"].includes(new URL(BASE).hostname);
    return {
      blocked: codes.includes(429),
      // Only a proxy can vouch for the client IP. On Vercel the app trusts x-vercel-forwarded-for, which clients can't set.
      warnOnly: local,
      detail: `${codes.join(" ")}${local && !codes.includes(429) ? " (dev server trusts X-Forwarded-For; Vercel uses its own unforgeable header)" : ""}`,
    };
  });

  await sleep(0);
  summarize();
}

function summarize() {
  const vulnerable = findings.filter((f) => f.status === "VULNERABLE");
  const warns = findings.filter((f) => f.status === "warn");
  console.log(`\n${findings.length} attacks: ${findings.length - vulnerable.length - warns.length} blocked, ${warns.length} accepted risks, ${vulnerable.length} vulnerable.`);
  mkdirSync(".data", { recursive: true });
  writeFileSync(".data/security-report.json", JSON.stringify({ base: BASE, at: new Date().toISOString(), findings }, null, 2));
  if (vulnerable.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
