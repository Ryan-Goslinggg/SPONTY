import { describe, expect, it } from "vitest";
import { initials, timeAgo } from "./format";

describe("timeAgo", () => {
  const now = 1_000_000_000_000;
  it("buckets durations", () => {
    expect(timeAgo(now - 10_000, now)).toBe("just now");
    expect(timeAgo(now - 5 * 60_000, now)).toBe("5m");
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe("3h");
    expect(timeAgo(now - 2 * 86_400_000, now)).toBe("2d");
  });
});

describe("initials", () => {
  it("takes up to two initials", () => {
    expect(initials("Mika Santos")).toBe("MS");
    expect(initials("You")).toBe("Y");
    expect(initials("  ana  de la cruz ")).toBe("AD");
  });
});
