import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { distanceMeters, formatDistance } from "@/lib/geo";
import { clampScore, heuristicMatch, rankMatches } from "@/lib/match";
import type { MatchCandidate, MatchResult } from "@/lib/types";

export const runtime = "nodejs";

const PlaceSchema = z.object({
  name: z.string().max(120),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const CandidateSchema = z.object({
  id: z.string().max(64),
  name: z.string().max(80),
  bio: z.string().max(600),
  hobbies: z.array(z.string().max(60)).max(20),
  location: PlaceSchema,
});

const RequestSchema = z.object({
  me: CandidateSchema,
  candidates: z.array(CandidateSchema).min(1).max(25),
});

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

export async function POST(req: Request) {
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { me, candidates } = body;

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ source: "heuristic", matches: heuristic(me, candidates) });
  }

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
      return Response.json({ source: "heuristic", matches: heuristic(me, candidates) });
    }

    // Keep only known ids and fill any the model skipped with the heuristic.
    const byId = new Map(response.parsed_output.matches.map((m) => [m.id, m]));
    const matches = candidates.map((c) => {
      const m = byId.get(c.id);
      return m ? { id: c.id, score: clampScore(m.score), reason: m.reason } : heuristicMatch(me, c);
    });
    return Response.json({ source: "ai", matches: rankMatches(matches) });
  } catch (err) {
    console.error("match: AI scoring failed, using heuristic", err);
    return Response.json({ source: "heuristic", matches: heuristic(me, candidates) });
  }
}
