import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { contentSecurityPolicy } from "@/lib/csp";

/** Pages that need an account. The (app) layout checks the session for real; this only saves signed-out visitors a round trip. */
function isAppPage(pathname: string): boolean {
  return pathname === "/" || pathname === "/find" || pathname === "/chat" || pathname.startsWith("/chat/");
}

/**
 * Runs before every page: gives each response a fresh CSP nonce (Next.js
 * reads it from the request header and stamps it on its own scripts) and
 * sends signed-out visitors of app pages straight to sign-in with a 307.
 */
export function proxy(request: NextRequest) {
  if (isAppPage(request.nextUrl.pathname) && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/sign-in", request.url), 307);
  }

  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: API routes return JSON, and static assets need no policy.
      source: "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
