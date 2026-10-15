import "server-only";
import { waitUntil } from "@vercel/functions";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";
import { getDb } from "./db";
import { accounts, authRateLimits, sessions, users, verifications } from "./db/schema";

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

function createAuth() {
  return betterAuth({
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
    advanced: { backgroundTasks: { handler: waitUntil } },
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
