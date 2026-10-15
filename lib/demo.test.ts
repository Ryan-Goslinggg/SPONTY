import { describe, expect, it } from "vitest";
import { demoData } from "../scripts/demo-data";
import { DEMO_USER_IDS } from "./demo";

describe("DEMO_USER_IDS", () => {
  it("matches exactly the people the demo seed creates", () => {
    expect(new Set(demoData(0).users.map((u) => u.id))).toEqual(DEMO_USER_IDS);
  });
});
