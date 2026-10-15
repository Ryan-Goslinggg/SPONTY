import { describe, expect, it } from "vitest";
import { hasReviewedPlace } from "./reviews";
import type { Review } from "./types";

const review: Review = {
  id: "r1",
  authorId: "me",
  placeName: "Corner Ramen Bar",
  category: "food",
  rating: 5,
  text: "",
  lat: 14.5652,
  lng: 121.0297,
  createdAt: 0,
};

describe("hasReviewedPlace", () => {
  it("catches the same author reviewing the same place again", () => {
    expect(hasReviewedPlace([review], "me", "  corner ramen bar ", { lat: 14.5653, lng: 121.0297 })).toBe(true);
  });

  it("allows other authors, other names, and far-away places with the same name", () => {
    expect(hasReviewedPlace([review], "someone", "Corner Ramen Bar", review)).toBe(false);
    expect(hasReviewedPlace([review], "me", "Kalye coffee", review)).toBe(false);
    expect(hasReviewedPlace([review], "me", "Corner Ramen Bar", { lat: 14.58, lng: 121.0297 })).toBe(false);
  });
});
