import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { distanceMeters, formatDistance } from "@/lib/geo";
import { clampScore, heuristicMatch, rankMatches } from "@/lib/match";
import { getSessionUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { consumeRateLimit, getUser, suggestionPool } from "@/lib/server/queries";
import type { MatchCandidate, MatchResult, User } from "@/lib/types";

export const runtime = "nodejs";

/** Each AI call costs credits, so callers are limited per user (burst and daily). */
const LIMITS = [
  { name: "minute", max: 6, windowSec: 60 },
  { name: "day", max: 100, windowSec: 60 * 60 * 24 },
];

const OutputSchema = z.object({
  matches: z.array(
    z.object({
      id: z.string(),
      score: z.number().describe("Compatibility from 0 (nothing in common) to 100 (ideal travel buddy)."),
      reason: z.string().describe("One short, friendly sentence (max ~15 words) addressed to the user."),
    }),
  ),
});

const SYSTEM_PROMPT = `You match travellers on Sponty, a social app for spontaneous trips and hidden-gem places.
Given the user's profile and a list of candidates, judge how well each candidate would click with the user as a travel friend.
Weigh three signals: shared or complementary hobbies, the vibe of their bios, and how close they are (people nearby can actually meet up).
Score honestly across the full 0-100 range; a far-away person with nothing in common should score low.
Write each reason in second person ("You both..."), warm and specific, without repeating the score.
Return exactly one entry per candidate, using the candidate's id.`;

function describe(p: MatchCandidate, me?: MatchCandidate) {
  const dist = me ? ` (${formatDistance(distanceMeters(me.location, p.location))} from the user)` : "";
  return `id: ${p.id}\nname: ${p.name}\nlocation: ${p.location.name}${dist}\nhobbies: ${p.hobbies.join(", ") || "none listed"}\nbio: ${p.bio || "(empty)"}`;
}

function heuristic(me: MatchCandidate, candidates: MatchCandidate[]): MatchResult[] {
  return rankMatches(candidates.map((c) => heuristicMatch(me, c)));
}

const toCandidate = (u: User): MatchCandidate => ({ id: u.id, name: u.name, bio: u.bio, hobbies: u.hobbies, location: u.location });

/**
 * Ranks people the signed-in user isn't friends with yet. Profiles come from
 * the database, never the request, so nobody can spend AI credits on
 * arbitrary prompts. Returns the candidates' profiles alongside the scores.
 */
const RequestSchema = z.object({ ai: z.boolean().default(false) }).default({ ai: false });

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in to see suggestions" }, { status: 401 });

  // Profiles only go to Claude when the user has opted in to AI matching.
  const { ai } = RequestSchema.parse(await req.json().catch(() => undefined));

  const db = getDb();
  for (const l of LIMITS) {
    const r = await consumeRateLimit(db, `match:${l.name}:${user.id}`, l.max, l.windowSec);
    if (!r.ok) {
      return Response.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } },
      );
    }
  }

  const [meUser, pool] = await Promise.all([getUser(db, user.id), suggestionPool(db, user.id)]);
  if (!meUser || pool.length === 0) return Response.json({ source: "heuristic", matches: [], users: pool });
  const { source, matches } = ai
    ? await score(toCandidate(meUser), pool.map(toCandidate))
    : { source: "heuristic" as const, matches: heuristic(toCandidate(meUser), pool.map(toCandidate)) };
  return Response.json({ source, matches, users: pool });
}

async function score(me: MatchCandidate, candidates: MatchCandidate[]): Promise<{ source: "ai" | "heuristic"; matches: MatchResult[] }> {
  if (!process.env.ANTHROPIC_API_KEY) return { source: "heuristic", matches: heuristic(me, candidates) };

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: process.env.SPONTY_MATCH_MODEL ?? "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(OutputSchema) },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `The user:\n${describe(me)}\n\nCandidates:\n\n${candidates.map((c) => describe(c, me)).join("\n\n")}`,
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return { source: "heuristic", matches: heuristic(me, candidates) };
    }

    // Keep only known ids and fill any the model skipped with the heuristic.
    const byId = new Map(response.parsed_output.matches.map((m) => [m.id, m]));
    const matches = candidates.map((c) => {
      const m = byId.get(c.id);
      return m ? { id: c.id, score: clampScore(m.score), reason: m.reason } : heuristicMatch(me, c);
    });
    return { source: "ai", matches: rankMatches(matches) };
  } catch (err) {
    console.error("match: AI scoring failed, using heuristic", err);
    return { source: "heuristic", matches: heuristic(me, candidates) };
  }
}
