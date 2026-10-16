/**
 * Removes metadata from a JPEG without decoding it.
 *
 * Phone photos carry EXIF (often with GPS coordinates), XMP and comments.
 * The browser re-encodes photos before upload, which already drops them, but
 * a direct API call can send the original file. This walks the marker
 * segments and keeps only what's needed to display the image: JFIF (APP0),
 * ICC colour profiles (APP2), Adobe colour flags (APP14) and the image
 * tables and scans. Anything after the end-of-image marker is dropped too,
 * which defeats files that smuggle HTML or script after a valid image.
 *
 * Throws on anything that isn't a well-formed JPEG.
 */
export class MalformedImageError extends Error {}

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const COM = 0xfe;

function isStandalone(marker: number) {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

function keepSegment(marker: number, bytes: Uint8Array, start: number): boolean {
  if (marker === COM) return false;
  if (marker < 0xe0 || marker > 0xef) return true; // tables, frame headers, restart intervals
  if (marker === 0xe0) return true; // JFIF
  if (marker === 0xee) return true; // Adobe colour transform flags
  if (marker === 0xe2) return Buffer.from(bytes.subarray(start, start + 12)).toString("latin1") === "ICC_PROFILE\0";
  return false; // EXIF/XMP (APP1) and every other application segment
}

export function stripJpegMetadata(input: Uint8Array): Uint8Array {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== SOI) throw new MalformedImageError("Not a JPEG");
  const parts: Uint8Array[] = [input.subarray(0, 2)];
  let i = 2;

  while (i + 1 < input.length) {
    if (input[i] !== 0xff) throw new MalformedImageError("Expected a marker");
    let marker = input[i + 1];
    // Markers may be padded with extra 0xFF fill bytes.
    while (marker === 0xff && i + 2 < input.length) marker = input[++i + 1];

    if (marker === EOI) {
      parts.push(Uint8Array.of(0xff, EOI));
      return concat(parts);
    }
    if (isStandalone(marker)) {
      parts.push(input.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 3 >= input.length) throw new MalformedImageError("Truncated segment header");
    const length = (input[i + 2] << 8) | input[i + 3];
    const end = i + 2 + length;
    if (length < 2 || end > input.length) throw new MalformedImageError("Segment runs past the end of the file");

    if (marker === SOS) {
      // Entropy-coded data can't contain 0xFFD9 except as the real end marker
      // (0xFF bytes are stuffed with 0x00), so the image ends at the first one.
      const eoi = findEoi(input, end);
      if (eoi < 0) throw new MalformedImageError("No end-of-image marker");
      parts.push(input.subarray(i, eoi + 2));
      return concat(parts);
    }
    if (keepSegment(marker, input, i + 4)) parts.push(input.subarray(i, end));
    i = end;
  }
  throw new MalformedImageError("No image data");
}

function findEoi(bytes: Uint8Array, from: number): number {
  for (let j = from; j + 1 < bytes.length; j++) if (bytes[j] === 0xff && bytes[j + 1] === EOI) return j;
  return -1;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
