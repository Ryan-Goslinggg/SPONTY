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
- Satellite imagery from Esri World Imagery through Leaflet. No API key needed.
- Place search from OpenStreetMap Nominatim.
- Friend matching uses Claude (`/api/match`) when `ANTHROPIC_API_KEY` is set.
  Without a key, or if the AI call fails, a local scoring heuristic (`lib/match.ts`) is used.
- Data is stored in the browser (`localStorage`) and starts with demo users, posts, and reviews.
  Everything goes through `lib/store.tsx`, so moving to a real backend only means changing that file.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

Other scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Deploy to Vercel

1. Import this repository in Vercel.
   It detects Next.js automatically, so no extra config is needed.
2. Optional: under Project Settings, Environment Variables, add `ANTHROPIC_API_KEY` to turn on AI friend matching.
   `SPONTY_MATCH_MODEL` can override the model (default `claude-opus-5-5`).

## Known limits (next steps)

- No accounts or shared database yet.
  Each browser has its own copy of the data, so two people can't see each other's posts or messages.
- Chats don't get replies, since no other real users exist yet.
- `/api/match` has no auth or rate limit.
  Add both before you share the URL widely, because each call costs API credits when a key is set.
