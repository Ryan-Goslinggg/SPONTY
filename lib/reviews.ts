import { isWithinRadius } from "./geo";
import type { LatLng, Review } from "./types";

/** Two reviews closer than this with the same name are treated as the same place. */
export const SAME_PLACE_RADIUS_M = 75;

/** True when this author already reviewed a place with this name right here. One review per place keeps ratings honest. */
export function hasReviewedPlace(reviews: Review[], authorId: string, placeName: string, at: LatLng): boolean {
  const name = placeName.trim().toLowerCase();
  return reviews.some(
    (r) => r.authorId === authorId && r.placeName.trim().toLowerCase() === name && isWithinRadius(at, r, SAME_PLACE_RADIUS_M),
  );
}
