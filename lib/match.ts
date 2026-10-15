import { distanceMeters, formatDistance } from "./geo";
import type { MatchCandidate, MatchResult } from "./types";

/**
 * Local, deterministic compatibility scoring. Used when no AI key is configured
 * or when the AI call fails, so friend suggestions always work.
 */

const STOPWORDS = new Set(
  "about after also and any are because been but can for from have here into just like love more most much not only our out really some than that the their them then there they this very want what when where which while with you your i'm im always never every".split(
    " ",
  ),
);

export function normalizeHobby(hobby: string): string {
  return hobby.trim().toLowerCase().replace(/\s+/g, " ");
}

export function bioTokens(bio: string): Set<string> {
  return new Set(
    bio
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w))
      // crude stemming so "hiking" and "hikes" meet at "hik"
      .map((w) => w.replace(/(ing|ers|er|es|s)$/, "")),
  );
}

function hobbiesOverlap(a: string, b: string): boolean {
  return a === b || a.includes(b) || b.includes(a);
}

export function sharedHobbies(a: string[], b: string[]): string[] {
  const na = a.map(normalizeHobby);
  const nb = b.map(normalizeHobby);
  return b.filter((_, i) => na.some((h) => hobbiesOverlap(h, nb[i])));
}

/** Closeness in [0, 1]: ~1 in the same neighbourhood, ~0.5 at 35km, ~0 across the country. */
export function proximityScore(meters: number): number {
  return Math.exp(-meters / 50_000);
}

export function heuristicMatch(me: MatchCandidate, candidate: MatchCandidate): MatchResult {
  const shared = sharedHobbies(me.hobbies, candidate.hobbies);
  const hobbyScore =
    shared.length / Math.max(1, Math.min(me.hobbies.length, candidate.hobbies.length));

  const ta = bioTokens(me.bio);
  const tb = bioTokens(candidate.bio);
  const bioShared = [...ta].filter((t) => tb.has(t)).length;
  const bioScore = Math.min(1, bioShared / 3);

  const meters = distanceMeters(me.location, candidate.location);
  const prox = proximityScore(meters);

  const score = Math.round(100 * (0.5 * hobbyScore + 0.2 * bioScore + 0.3 * prox));

  const parts: string[] = [];
  if (shared.length) parts.push(`You both like ${shared.slice(0, 2).join(" & ").toLowerCase()}`);
  else if (bioShared) parts.push("Your bios have a similar vibe");
  else parts.push("Different interests - could be a fun new perspective");
  parts.push(meters < 2000 ? "right around you" : `${formatDistance(meters)} away`);

  return { id: candidate.id, score: clampScore(score), reason: parts.join(", ") };
}

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function rankMatches(results: MatchResult[]): MatchResult[] {
  return [...results].sort((a, b) => b.score - a.score);
}
