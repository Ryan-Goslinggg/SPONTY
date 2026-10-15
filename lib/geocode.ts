import type { LatLng, Place } from "./types";

/** OpenStreetMap Nominatim: free geocoding, light usage only (max ~1 request/second). */
const NOMINATIM = "https://nominatim.openstreetmap.org";

interface NominatimResult {
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
}

/** "Poblacion, Makati, Metro Manila, ..." -> "Poblacion, Makati" */
function shortName(r: NominatimResult): string {
  const parts = r.display_name.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.slice(0, 2).join(", ") || r.name || "Unnamed place";
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const url = `${NOMINATIM}/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal, headers: { "Accept-Language": "en" } });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = (await res.json()) as NominatimResult[];
  return data.map((r) => ({ name: shortName(r), lat: Number(r.lat), lng: Number(r.lon) }));
}

export async function reverseGeocode({ lat, lng }: LatLng): Promise<string | null> {
  try {
    const res = await fetch(`${NOMINATIM}/reverse?format=jsonv2&zoom=14&lat=${lat}&lon=${lng}`, {
      headers: { "Accept-Language": "en" },
    });
    if (!res.ok) return null;
    const r = (await res.json()) as NominatimResult & { address?: Record<string, string> };
    const a = r.address ?? {};
    const local = a.suburb || a.neighbourhood || a.village || a.town;
    const city = a.city || a.municipality || a.county;
    return [local, city].filter(Boolean).join(", ") || shortName(r);
  } catch {
    return null;
  }
}

/** Thrown when the browser or the user has blocked location access. */
export class PermissionDeniedError extends Error {
  constructor(message = "Permission was denied") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

export function getCurrentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Location is not available on this device"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        reject(err.code === err.PERMISSION_DENIED ? new PermissionDeniedError() : new Error("Couldn't get your location")),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });
}
