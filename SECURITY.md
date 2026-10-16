# Security

How Sponty defends against abuse, and how to check it still does.
This covers the running app (accounts, the database, uploads, the API).
For privacy and legal compliance (consent, data deletion, cookies), see [docs/compliance.md](docs/compliance.md).

## Testing it yourself

Two scripts run against your own local server. Both refuse any non-localhost target unless you opt in, because they create accounts and generate heavy traffic. Never point them at a deployment you don't own.

```bash
npm run dev
```

```bash
npm run security:attack
```

`security:attack` plays an attacker and prints, for each of 40-odd attacks, whether it was blocked. It writes `.data/security-report.json` and exits non-zero if anything is vulnerable.

```bash
npm run security:load
```

`security:load` plays a crowd of concurrent users hammering the read paths and reports throughput, latency percentiles and the error mix, so you can see the server stays up (no 5xx, no dropped connections) and sheds load with 429s rather than falling over.

Both reuse the two accounts saved in `.data/security-accounts.json`. Run the attack suite first.
If a run stops with "rate limited while signing in", the per-IP sign-in limit tripped; wait a minute and rerun.

## What's defended

### Authentication and sessions

- Email and password sign-in via Better Auth, passwords stored only as salted hashes.
- Session cookies are HttpOnly and SameSite=Lax, so scripts can't read them and other sites can't send them.
- No cookie cache: every request checks the sessions table, so sign-out and account deletion take effect everywhere at once.
- Forged or post-sign-out tokens are rejected (401).
- Sign-in is limited to 5 attempts per minute per IP, sign-up to 5 per hour, so password guessing and mass account creation are throttled.
- Passwords must be 8 to 128 characters, so a huge password can't be used to exhaust the hasher.

### Authorization

- App pages live behind an auth-guarded layout; signed-out visitors are redirected to sign-in.
- Every API route and server action authenticates first.
- You can only message people you're friends with.
- Profile updates can only change your own name, bio, hobbies and location. Protected fields (id, handle, tint, email) can't be mass-assigned.
- A post may only reference photos the author uploaded, checked against the owner's storage folder, so you can't hotlink a tracking pixel, a `javascript:` URL, or someone else's photo.

### Input validation

- Every input the browser sends is validated with Zod against the same limits the UI and database enforce.
- All database access uses parameterized queries (Drizzle), so injection attempts are stored as plain text, never executed.
- Output is rendered by React, which escapes it, so a `<script>` in a name or review shows as text.

### Uploads

- Only JPEG is accepted (the browser re-encodes every photo to JPEG first), confirmed by magic bytes, not the filename.
- Metadata is stripped server-side: EXIF (which carries GPS), XMP and comments are removed, and anything after the end-of-image marker is dropped, so a photo can't leak the uploader's location or smuggle HTML. See `lib/server/jpeg.ts`.
- Files are capped at 4 MB and refused earlier by Content-Length.
- Photos are served with `Content-Type: image/jpeg` and `X-Content-Type-Options: nosniff`, so a polyglot can't be served as HTML.
- Photo paths are validated, so `../` traversal returns 404.

### Cross-site requests (CSRF)

- State-changing API routes reject requests whose Origin isn't the app's own.
- Next.js server actions reject cross-origin POSTs.
- Session cookies are SameSite, so the browser won't attach them to cross-site requests anyway.

### Browser hardening

Every page sends a Content-Security-Policy with a per-request nonce (see `proxy.ts` and `lib/csp.ts`), plus `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a strict `Referrer-Policy`, a locked-down `Permissions-Policy` (only this site's camera and geolocation), `Cross-Origin-Opener-Policy`, and HSTS in production. `X-Powered-By` is off.

### Abuse and denial of service

Per-user caps, counted in Postgres so they hold across serverless instances (`lib/server/actions.ts`):

| Action | Limit |
| --- | --- |
| Posts | 10 per hour |
| Messages | 30 per minute |
| Reviews | 20 per hour |
| Friend adds | 30 per hour |
| Likes | 120 per minute |
| Profile edits | 30 per hour |
| Photo uploads | 30 per hour |
| AI match | 6 per minute, 100 per day |
| Nearby reviews | 200 per minute |

Realtime (SSE) connections are capped per user, so one account can't hold open unlimited streams.
Fake reviews are further discouraged by a one-review-per-place rule, an "I've been here" attestation, and a report button (see compliance docs).

### Personal data

- Profile locations are rounded to about 1 km (2 decimal degrees) in the browser **and** again on the server, so a user's exact home is never stored or shown to others.
- Profiles returned to other users never include email addresses.
- "Delete my data" deletes the account and cascades to the profile, sessions, friendships, posts and their photos, likes, messages (sent and received) and reviews.

## Accepted risks

These are known and deliberately left for now; the attack suite reports them as warnings, not failures.

- **Account enumeration at sign-up.** Signing up with an existing email returns an error that reveals the email is taken. Fixing this properly needs email verification (so sign-up always "succeeds" and sends a mail). Until Sponty sends email, this is accepted.
- **X-Forwarded-For spoofing against the sign-in limit, on a dev server only.** Locally, Node trusts the `X-Forwarded-For` header, so rotating it can dodge the per-IP limit. In production on Vercel, the client IP comes from Vercel's own header, which a client can't forge, so the limit holds. Per-account and global limits apply regardless. If you deploy behind a different proxy, configure Better Auth's trusted IP header for it.

## Deployment checklist

- Set a strong `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and the correct `BETTER_AUTH_URL`.
- Connect a Vercel Blob store so `BLOB_READ_WRITE_TOKEN` is set; the local-disk photo driver refuses to run in production.
- Keep `ANTHROPIC_API_KEY` server-side only (it already is; it's never sent to the browser).
- Run `npm run security:attack` against a preview deployment (with `ATTACK_ALLOW_REMOTE=1`) before going live, and after any change to auth, uploads or the API.

## Reporting a vulnerability

Email the address on the [About page](/about). Please don't open a public issue for a security problem.
