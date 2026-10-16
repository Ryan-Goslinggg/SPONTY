import { describe, expect, it } from "vitest";
import { COMMENT_SECRET, GPS_SECRET, jpegWithMetadata } from "../../scripts/security/fixtures";
import { MalformedImageError, stripJpegMetadata } from "./jpeg";

const contains = (bytes: Uint8Array, needle: string) => Buffer.from(bytes).includes(Buffer.from(needle, "latin1"));

describe("stripJpegMetadata", () => {
  it("removes EXIF/GPS, XMP and comment metadata from a phone-style JPEG", () => {
    const original = jpegWithMetadata();
    expect(contains(original, GPS_SECRET)).toBe(true);
    expect(contains(original, COMMENT_SECRET)).toBe(true);

    const stripped = stripJpegMetadata(original);
    expect(contains(stripped, GPS_SECRET)).toBe(false);
    expect(contains(stripped, COMMENT_SECRET)).toBe(false);
    // Still a valid JPEG: starts with SOI, ends with EOI.
    expect([stripped[0], stripped[1]]).toEqual([0xff, 0xd8]);
    expect([stripped[stripped.length - 2], stripped[stripped.length - 1]]).toEqual([0xff, 0xd9]);
  });

  it("drops anything smuggled after the end-of-image marker", () => {
    const withTrailer = new Uint8Array([...jpegWithMetadata(), ...Buffer.from("<script>alert(1)</script>", "latin1")]);
    const stripped = stripJpegMetadata(withTrailer);
    expect(contains(stripped, "<script>")).toBe(false);
    expect([stripped[stripped.length - 2], stripped[stripped.length - 1]]).toEqual([0xff, 0xd9]);
  });

  it("rejects non-JPEG input", () => {
    expect(() => stripJpegMetadata(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toThrow(MalformedImageError);
    expect(() => stripJpegMetadata(new Uint8Array([0xff, 0xd8]))).toThrow(MalformedImageError);
  });
});
