/**
 * The Content-Security-Policy for every page.
 *
 * Scripts must carry the per-request nonce ('strict-dynamic' lets those
 * scripts load the app's own chunks), so injected markup can never run
 * script even if an escaping bug slips through. Every other resource is
 * limited to the origins the app really uses; see docs/third-party-services.md.
 */
export const IMAGE_ORIGINS = [
  "https://server.arcgisonline.com", // Esri satellite tiles and labels
  "https://picsum.photos", // demo post photos
  "https://fastly.picsum.photos", // where picsum redirects
  "https://*.public.blob.vercel-storage.com", // uploaded photos
];

export const CONNECT_ORIGINS = [
  "https://nominatim.openstreetmap.org", // place search and reverse geocoding
];

export function contentSecurityPolicy(nonce: string, dev: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // React's dev build needs eval for fast refresh; production never does.
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])],
    // Leaflet positions tiles and markers with inline styles.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...IMAGE_ORIGINS],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...CONNECT_ORIGINS, ...(dev ? ["ws:", "wss:"] : [])],
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "frame-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "manifest-src": ["'self'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!dev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}
