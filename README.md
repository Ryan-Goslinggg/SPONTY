# SPONTY -.-
A facebook like application wherein you can only post your spontaneuos trip with your friends; without the toxicity of being stuck in a dopamine loop/mindless scrolling. It is also a tool for finding unappreciated restaurants or places that are actually good. 

## Features

- **Home** - a wall of travel posts from everyone, friend or not.
  It ends with "You're all caught up" instead of scrolling forever.
- **Chat** - your friends and your conversations.
  Scroll to the bottom and an **Add friends** panel slides up.
  It ranks people by how well they match your bio, hobbies, and location.
- **Find** - a live satellite map.
  Tap anywhere (or search, or use your location) to drop a pin with a 500m circle.
  Reviews of restaurants and spots inside the circle show up as pins.
  **CLOSE** mode shows only your friends' reviews, and **OPEN** mode shows everyone's.

## Tech

- Next.js (App Router) + React + TypeScript, styled with Tailwind CSS.
- Postgres through Drizzle ORM, with SQL migrations in `drizzle/`.
  On Vercel this is Neon; locally any Postgres 15+ works.
- Email and password accounts with Better Auth.
  Sessions and sign-in rate limits live in Postgres.
- Photos are stored in Vercel Blob.
  Without a Blob token (local development), they are saved to `.data/uploads` instead.
- Chat is live: database triggers `NOTIFY` on new messages and friendships, and `/api/events` streams them to the browser with server-sent events.
  Each server instance shares one `LISTEN` connection across all its streams.
- The Find map asks Postgres for reviews inside the 500m circle, using the `earthdistance` extension and a GiST index.
- Satellite imagery from Esri World Imagery through Leaflet. No API key needed.
- Place search from OpenStreetMap Nominatim.
- Friend matching uses Claude (`/api/match`) when `ANTHROPIC_API_KEY` is set.
  Without a key, or if the AI call fails, a local scoring heuristic (`lib/match.ts`) is used.
  The endpoint requires sign-in, reads profiles from the database (never from the request), and is rate limited per user (6 per minute, 100 per day).

### Where things live

- `lib/store.tsx` - the client store every page uses (`useStore`).
  It updates the screen immediately, then confirms with the server and rolls back with a toast on failure.
- `lib/server/actions.ts` - server actions behind the store, each one authenticated and validated.
- `lib/server/queries.ts` - every database read and write.
  Tests run these against an in-memory Postgres (PGlite), so no database is needed for `npm test`.
- `lib/server/db/schema.ts` - the schema.
- `lib/server/auth.ts`, `lib/server/storage.ts`, `lib/server/realtime.ts` - auth, photo storage, live events.

## Environment variables

| Variable | Needed | What it is |
| --- | --- | --- |
| `DATABASE_URL` | Always | Postgres connection string. On Vercel, use Neon's pooled URL (the Neon integration sets it). |
| `DATABASE_URL_UNPOOLED` | Recommended on Vercel | Direct, non-pooled connection, used for migrations and the realtime `LISTEN`. Falls back to `DATABASE_URL`. The Neon integration sets it. |
| `BETTER_AUTH_SECRET` | Always | Random secret that signs sessions. Generate one with `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | Locally, and for custom domains | The app's public URL, such as `http://localhost:3000` or `https://sponty.app`. Vercel's own `*.vercel.app` hostnames are trusted automatically. |
| `BLOB_READ_WRITE_TOKEN` | On Vercel | Vercel Blob token for photo uploads. Set automatically when you connect a Blob store. |
| `ANTHROPIC_API_KEY` | Optional | Turns on AI friend matching. |
| `SPONTY_MATCH_MODEL` | Optional | Overrides the matching model (default `claude-opus-5-5`). |

## Run locally

You need Node 22+ and a Postgres 15+ database.
A local install works, or a free Neon database.

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` (at least `DATABASE_URL` and `BETTER_AUTH_SECRET`), then create the tables and load the demo community:

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Open http://localhost:3000 and create an account.
To try two accounts side by side, open the second one at http://127.0.0.1:3000 (cookies are per hostname).

Other scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
After changing `lib/server/db/schema.ts`, run `npm run db:generate` to write a new migration.

## Deploy to Vercel

1. Import this repository in Vercel.
   It detects Next.js automatically.
2. Under Storage, add a **Neon** Postgres database and a **Blob** store to the project.
   They set `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `BLOB_READ_WRITE_TOKEN`.
3. Under Project Settings, Environment Variables, add `BETTER_AUTH_SECRET`.
   If you use a custom domain, also add `BETTER_AUTH_URL` with that domain.
   Optionally add `ANTHROPIC_API_KEY` to turn on AI friend matching.
4. Run the migrations against the new database.
   Either set the Build Command to `npm run db:migrate && npm run build` so every deploy migrates (best with Neon's per-preview database branches), or run them once from your machine:

   ```bash
   vercel env pull .env.local
   ```

   ```bash
   npm run db:migrate
   ```

5. Optionally run `npm run db:seed` the same way to load the demo community.
6. Keep Fluid compute on (the default for new projects).
   The live chat stream runs for up to 5 minutes per connection and then reconnects by itself.

## Known limits (next steps)

- The Home wall shows the newest 50 trips and refreshes when you come back to the tab; it doesn't page further back or update live.
- No password reset or email verification yet (both need an email provider).
- People can be added as friends instantly, without a request to accept.
