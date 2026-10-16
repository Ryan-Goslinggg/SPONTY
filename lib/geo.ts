import type { LatLng, Place } from "./types";

/** The pin circle is 500m in diameter. */
export const PIN_DIAMETER_M = 500;
export const PIN_RADIUS_M = PIN_DIAMETER_M / 2;

/** Where new accounts start until they set their own location. */
export const DEFAULT_PLACE: Place = { name: "Manila", lat: 14.5995, lng: 120.9842 };

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Round a coordinate to ~1km (2 decimals) so a stored location can't pinpoint a home. */
export function coarsenCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Coarsen a place's coordinates while keeping its name. */
export function coarsenPlace<T extends LatLng>(place: T): T {
  return { ...place, lat: coarsenCoord(place.lat), lng: coarsenCoord(place.lng) };
}

export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isWithinRadius(center: LatLng, point: LatLng, radiusM = PIN_RADIUS_M): boolean {
  return distanceMeters(center, point) <= radiusM;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  if (meters < 10_000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters / 1000)} km`;
}
