import { describe, expect, it } from "vitest";
import { coarsen } from "./privacy";

describe("coarsen", () => {
  it("rounds coordinates to two decimals (~1km)", () => {
    expect(coarsen(14.564912)).toBe(14.56);
    expect(coarsen(121.03499)).toBe(121.03);
    expect(coarsen(-0.005)).toBe(-0);
  });
});
