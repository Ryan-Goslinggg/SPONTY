import "server-only";
import { waitUntil } from "@vercel/functions";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { cache } from "react";
import { getDb } from "./db";
import { accounts, authRateLimits, sessions, users, verifications } from "./db/schema";
import { consumeRateLimit } from "./queries";

/** Failed or not, each account can be tried this many times per window, whatever IP the guesses come from. */
const SIGN_IN_PER_EMAIL = { max: 10, windowSec: 15 * 60 };

function hostOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).host;
  } catch {
    return undefined;
  }
}

/**
 * Hosts allowed to serve auth. Vercel exposes the production, branch and
 * per-deployment hostnames, so previews work without extra config.
 */
function allowedHosts(): string[] {
  const hosts = [
    hostOf(process.env.BETTER_AUTH_URL),
    hostOf(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    hostOf(process.env.VERCEL_BRANCH_URL),
    hostOf(process.env.VERCEL_URL),
  ];
  if (process.env.NODE_ENV !== "production") hosts.push("localhost:3000", "127.0.0.1:3000");
  return [...new Set(hosts.filter((h): h is string => !!h))];
}

/** The secret signs every session. A missing or short one in production is a deploy mistake, so fail loudly. */
function authSecret(): string | undefined {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error("BETTER_AUTH_SECRET must be set to at least 32 random characters in production.");
  }
  return secret;
}

/**
 * Which header holds the client's real IP for per-IP limits. On Vercel,
 * x-vercel-forwarded-for is set by the platform and can't be forged by the
 * client. Elsewhere, x-forwarded-for is only as trustworthy as the proxy in
 * front of the app, which is why sign-in is also limited per account.
 */
function ipAddressHeaders(): string[] {
  return process.env.VERCEL ? ["x-vercel-forwarded-for", "x-real-ip"] : ["x-forwarded-for"];
}

const hashKey = (value: string) => createHash("sha256").update(value).digest("base64url").slice(0, 32);

function createAuth() {
  return betterAuth({
    secret: authSecret(),
    appName: "Sponty",
    baseURL: {
      allowedHosts: allowedHosts(),
      fallback: process.env.BETTER_AUTH_URL,
      protocol: process.env.NODE_ENV === "production" ? "https" : "auto",
    },
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { user: users, session: sessions, account: accounts, verification: verifications, rateLimit: authRateLimits },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      // No cookie cache: every request checks the sessions table, so signing
      // out or deleting an account takes effect everywhere immediately.
    },
    // Stored in Postgres so limits hold across serverless instances.
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60 * 60, max: 5 },
      },
    },
    hooks: {
      // Per-account brute-force limit. The per-IP rule above can be dodged by
      // rotating IPs; this one can't. The email is hashed so the limits table
      // never stores addresses.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/email") return;
        const email = String((ctx.body as { email?: unknown } | undefined)?.email ?? "").trim().toLowerCase();
        if (!email) return;
        const r = await consumeRateLimit(getDb(), `signin:${hashKey(email)}`, SIGN_IN_PER_EMAIL.max, SIGN_IN_PER_EMAIL.windowSec);
        if (!r.ok) {
          throw new APIError("TOO_MANY_REQUESTS", { message: "Too many sign-in attempts for this account. Try again later." });
        }
      }),
    },
    advanced: {
      backgroundTasks: { handler: waitUntil },
      ipAddress: { ipAddressHeaders: ipAddressHeaders() },
      useSecureCookies: process.env.NODE_ENV === "production",
    },
    // nextCookies lets server actions set auth cookies; it must stay last.
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
let auth: Auth | undefined;

/** Created on first use so `next build` works without a database. */
export function getAuth(): Auth {
  auth ??= createAuth();
  return auth;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
  }
}

/** The signed-in user for this request, or null. Deduplicated per request. */
export const getSessionUser = cache(async () => {
  // Read headers first: it marks the route dynamic, so builds never try to reach the database.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  return session ? { id: session.user.id, name: session.user.name } : null;
});

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
