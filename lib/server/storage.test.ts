import { afterEach, describe, expect, it, vi } from "vitest";
import { isOwnPhotoUrl, sniffPhotoType } from "./storage";

const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sniffPhotoType", () => {
  it("recognises JPEG, PNG and WebP by their magic bytes", () => {
    expect(sniffPhotoType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffPhotoType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe("image/png");
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(sniffPhotoType(webp)).toBe("image/webp");
  });

  it("rejects anything else, whatever it claims to be", () => {
    expect(sniffPhotoType(new TextEncoder().encode("<svg xmlns="))).toBeNull();
    expect(sniffPhotoType(new Uint8Array([]))).toBeNull();
  });
});

describe("isOwnPhotoUrl", () => {
  it("accepts only the user's own uploads from the local driver", () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    expect(isOwnPhotoUrl("ana", `/api/uploads/posts/ana/${UUID}.jpg`)).toBe(true);
    expect(isOwnPhotoUrl("ana", `/api/uploads/posts/ben/${UUID}.jpg`)).toBe(false);
    expect(isOwnPhotoUrl("ana", `/api/uploads/posts/ana/../ben/${UUID}.jpg`)).toBe(false);
    expect(isOwnPhotoUrl("ana", "https://evil.example/posts/ana/x.jpg")).toBe(false);
  });

  it("accepts only the user's own folder on Vercel Blob", () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_test");
    const base = "https://abc123.public.blob.vercel-storage.com";
    expect(isOwnPhotoUrl("ana", `${base}/posts/ana/${UUID}.jpg`)).toBe(true);
    expect(isOwnPhotoUrl("ana", `${base}/posts/ben/${UUID}.jpg`)).toBe(false);
    expect(isOwnPhotoUrl("ana", `https://evil.example/posts/ana/${UUID}.jpg`)).toBe(false);
    expect(isOwnPhotoUrl("ana", `http://abc123.public.blob.vercel-storage.com/posts/ana/${UUID}.jpg`)).toBe(false);
    expect(isOwnPhotoUrl("ana", "not a url")).toBe(false);
  });
});
