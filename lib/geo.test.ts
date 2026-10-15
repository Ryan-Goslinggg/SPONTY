import { describe, expect, it } from "vitest";
import { distanceMeters, formatDistance, isWithinRadius, PIN_RADIUS_M } from "./geo";

describe("distanceMeters", () => {
  it("is zero for the same point", () => {
    expect(distanceMeters({ lat: 14.5, lng: 121 }, { lat: 14.5, lng: 121 })).toBe(0);
  });

  it("matches a known distance (Manila to Cebu ~ 570km)", () => {
    const d = distanceMeters({ lat: 14.5995, lng: 120.9842 }, { lat: 10.3157, lng: 123.8854 });
    expect(d / 1000).toBeGreaterThan(560);
    expect(d / 1000).toBeLessThan(580);
  });
});

describe("isWithinRadius", () => {
  const center = { lat: 14.5649, lng: 121.03 };

  it("uses a 250m radius for the 500m circle", () => {
    expect(PIN_RADIUS_M).toBe(250);
  });

  it("includes points just inside and excludes points just outside", () => {
    // 0.002 deg latitude is ~222m, 0.0025 is ~278m
    expect(isWithinRadius(center, { lat: center.lat + 0.002, lng: center.lng })).toBe(true);
    expect(isWithinRadius(center, { lat: center.lat + 0.0025, lng: center.lng })).toBe(false);
  });
});

describe("formatDistance", () => {
  it("formats meters and kilometers", () => {
    expect(formatDistance(120.4)).toBe("120 m");
    expect(formatDistance(2345)).toBe("2.3 km");
    expect(formatDistance(45_600)).toBe("46 km");
  });
});
