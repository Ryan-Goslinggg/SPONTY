import { describe, expect, it } from "vitest";
import { clampScore, heuristicMatch, rankMatches, sharedHobbies } from "./match";
import type { MatchCandidate } from "./types";

const base = (over: Partial<MatchCandidate>): MatchCandidate => ({
  id: "x",
  name: "X",
  bio: "",
  hobbies: [],
  location: { name: "Makati", lat: 14.5547, lng: 121.0244 },
  ...over,
});

describe("sharedHobbies", () => {
  it("matches case-insensitively and by substring", () => {
    expect(sharedHobbies(["Hiking", "Coffee"], ["coffee hopping", "gaming"])).toEqual([
      "coffee hopping",
    ]);
  });
});

describe("heuristicMatch", () => {
  const me = base({
    id: "me",
    bio: "Weekend hiker who chases sunsets and street food",
    hobbies: ["hiking", "photography", "street food"],
  });

  it("scores similar nearby people above dissimilar faraway people", () => {
    const similar = heuristicMatch(
      me,
      base({ id: "a", bio: "Sunset hikes and street food crawls", hobbies: ["Hiking", "Street food"] }),
    );
    const different = heuristicMatch(
      me,
      base({
        id: "b",
        bio: "Competitive gamer",
        hobbies: ["gaming"],
        location: { name: "Cebu", lat: 10.3157, lng: 123.8854 },
      }),
    );
    expect(similar.score).toBeGreaterThan(different.score);
    expect(similar.score).toBeGreaterThanOrEqual(70);
    expect(different.score).toBeLessThan(20);
    expect(similar.reason).toContain("hiking");
  });

  it("always returns a score in [0, 100]", () => {
    const r = heuristicMatch(me, base({ id: "c" }));
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("clampScore / rankMatches", () => {
  it("clamps and sorts", () => {
    expect(clampScore(140)).toBe(100);
    expect(clampScore(-3)).toBe(0);
    expect(clampScore(Number.NaN)).toBe(0);
    expect(
      rankMatches([
        { id: "a", score: 10, reason: "" },
        { id: "b", score: 90, reason: "" },
      ]).map((m) => m.id),
    ).toEqual(["b", "a"]);
  });
});
