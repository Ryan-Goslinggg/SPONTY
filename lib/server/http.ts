/**
 * Cross-site request forgery guard for route handlers that change state.
 *
 * Server actions and Better Auth already check the Origin header; plain route
 * handlers don't, so they call this. Browsers always send Origin on
 * cross-origin POSTs, so a mismatch means another site is riding the user's
 * cookies. Requests with no Origin at all come from non-browser clients,
 * which can't carry a victim's cookies, so they're allowed.
 */
export function isCrossSite(req: Request): boolean {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return true;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return true;
  }
  // Behind a proxy (Vercel), the public host is in x-forwarded-host.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  return originHost !== host;
}

export function forbiddenCrossSite(): Response {
  return Response.json({ error: "Cross-site requests are not allowed" }, { status: 403 });
}

export function tooManyRequests(retryAfterSec: number, message = "Too many requests. Try again later."): Response {
  return Response.json({ error: message }, { status: 429, headers: { "Retry-After": String(retryAfterSec) } });
}
