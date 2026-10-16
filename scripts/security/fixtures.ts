/** Hand-built files for upload attacks. They only need valid structure, not decodable pixels. */

const bytes = (...parts: (number[] | string | Uint8Array)[]) =>
  Uint8Array.from(
    parts.flatMap((p) => (typeof p === "string" ? [...Buffer.from(p, "latin1")] : [...p])),
  );

function segment(marker: number, payload: Uint8Array | string): Uint8Array {
  const body = typeof payload === "string" ? Buffer.from(payload, "latin1") : payload;
  const len = body.length + 2;
  return bytes([0xff, marker, len >> 8, len & 0xff], body);
}

export const GPS_SECRET = "GPS-SECRET-14.59951N-120.98423E";
export const COMMENT_SECRET = "COMMENT-SECRET-home-address";

/** A JPEG carrying EXIF (with a GPS marker string), XMP and a comment, like a phone photo straight off the camera. */
export function jpegWithMetadata(): Uint8Array {
  return bytes(
    [0xff, 0xd8],
    segment(0xe0, bytes("JFIF\0", [1, 1, 0, 0, 1, 0, 1, 0, 0])),
    segment(0xe1, `Exif\0\0MM\0*\0\0\0\x08${GPS_SECRET}`),
    segment(0xe1, `http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>${GPS_SECRET}</x:xmpmeta>`),
    segment(0xfe, COMMENT_SECRET),
    segment(0xdb, bytes([0], new Uint8Array(64).fill(1))),
    segment(0xda, bytes([1, 1, 0, 0, 0x3f, 0])),
    [0x12, 0x34, 0x56, 0xff, 0x00, 0x78],
    [0xff, 0xd9],
  );
}

/** A file that is a JPEG to a magic-byte check but carries HTML and script after the header. */
export function jpegHtmlPolyglot(): Uint8Array {
  return bytes([0xff, 0xd8, 0xff, 0xe0], "<html><script>alert(document.cookie)</script></html>");
}

export const SVG_XSS = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.cookie)"><script>alert(1)</script></svg>`;
export const HTML_XSS = "<!doctype html><script>alert(document.cookie)</script>";

export function pngHeaderOnly(): Uint8Array {
  return bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "tEXtComment\0hello");
}

export function oversizedJpeg(mb: number): Uint8Array {
  const b = new Uint8Array(mb * 1024 * 1024);
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return b;
}

export function containsText(haystack: Uint8Array, needle: string): boolean {
  return Buffer.from(haystack).includes(Buffer.from(needle, "latin1"));
}
