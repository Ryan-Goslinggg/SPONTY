import { describe, expect, it } from "vitest";
import { pushLayer } from "./layers";

describe("pushLayer", () => {
  it("only the most recent open layer is on top", () => {
    const a = pushLayer();
    const b = pushLayer();
    expect(a.isTop()).toBe(false);
    expect(b.isTop()).toBe(true);
    b.release();
    expect(a.isTop()).toBe(true);
    a.release();
  });

  it("releasing a lower layer keeps the top one on top", () => {
    const a = pushLayer();
    const b = pushLayer();
    a.release();
    expect(b.isTop()).toBe(true);
    b.release();
  });
});
