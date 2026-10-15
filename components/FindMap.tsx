"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { initials } from "@/lib/format";
import { PIN_RADIUS_M } from "@/lib/geo";
import type { LatLng, Review, User } from "@/lib/types";

/**
 * Live satellite imagery from Esri World Imagery (no API key needed),
 * with a transparent labels layer on top so streets and places stay readable.
 */
const SATELLITE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const LABELS_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const ATTRIBUTION = "Imagery &copy; Esri, Maxar, Earthstar Geographics";

export interface MapReview {
  review: Review;
  author: User;
  friend: boolean;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function reviewIcon({ author, friend, review }: MapReview, focused: boolean) {
  const size = focused ? 44 : 36;
  const badge = review.category === "food" ? "🍜" : "🌄";
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div class="sponty-pin" role="img" aria-label="${escapeHtml(`${review.placeName}, ${review.rating} of 5 stars, by ${author.name}`)}" style="position:relative;width:${size}px;height:${size}px;border-radius:9999px;background:${author.tint};border:3px solid ${friend ? "#3b7d54" : "#fff"};box-shadow:0 4px 12px rgba(31,58,43,.35);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${Math.round(size * 0.34)}px;color:#1f3a2b">${escapeHtml(initials(author.name))}<span aria-hidden="true" style="position:absolute;right:-6px;bottom:-6px;font-size:14px">${badge}</span></div>`,
  });
}

const centerIcon = L.divIcon({
  className: "",
  iconSize: [34, 44],
  iconAnchor: [17, 42],
  html: `<svg aria-hidden="true" width="34" height="44" viewBox="0 0 34 44" style="filter:drop-shadow(0 4px 6px rgba(31,58,43,.4))"><path d="M17 43S2 27.5 2 17a15 15 0 1 1 30 0C32 27.5 17 43 17 43Z" fill="#2f6b47" stroke="#fff" stroke-width="3"/><circle cx="17" cy="17" r="6" fill="#fff"/></svg>`,
});

function ClickToPin({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
}

/**
 * Flies so the target lands in the upper part of the screen, clear of the
 * results card. `target.key` changes on every request, even for the same spot.
 */
function ExposeMap({ onReady }: { onReady?: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => onReady?.(map), [map, onReady]);
  return null;
}

function FlyTo({ target, zoom }: { target: (LatLng & { key: number }) | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    const z = Math.max(map.getZoom(), zoom);
    const offsetY = map.getSize().y * 0.22;
    const center = map.unproject(map.project([target.lat, target.lng], z).add([0, offsetY]), z);
    map.flyTo(center, z, { duration: 0.8 });
  }, [map, target, zoom]);
  return null;
}

export default function FindMap({
  initialCenter,
  pin,
  onPick,
  reviews,
  focusedId,
  onFocus,
  flyTarget,
  onReady,
}: {
  initialCenter: LatLng;
  pin: LatLng | null;
  onPick: (p: LatLng) => void;
  reviews: MapReview[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  flyTarget: (LatLng & { key: number }) | null;
  /** Hands the Leaflet map to the page, e.g. to pin the current center from the keyboard. */
  onReady?: (map: L.Map) => void;
}) {
  const icons = useMemo(
    () => new Map(reviews.map((r) => [r.review.id, reviewIcon(r, r.review.id === focusedId)])),
    [reviews, focusedId],
  );

  return (
    <MapContainer
      center={[initialCenter.lat, initialCenter.lng]}
      zoom={15}
      maxZoom={19}
      zoomControl={false}
      className="h-full w-full"
      attributionControl
    >
      <TileLayer url={SATELLITE_URL} attribution={ATTRIBUTION} maxNativeZoom={19} maxZoom={19} />
      <TileLayer url={LABELS_URL} maxNativeZoom={19} maxZoom={19} />
      <ClickToPin onPick={onPick} />
      <FlyTo target={flyTarget} zoom={16} />
      <ExposeMap onReady={onReady} />

      {pin && (
        <>
          <Circle
            center={[pin.lat, pin.lng]}
            radius={PIN_RADIUS_M}
            pathOptions={{ color: "#a8d8b8", weight: 3, fillColor: "#7fc196", fillOpacity: 0.18, dashArray: "6 8" }}
          />
          <Marker position={[pin.lat, pin.lng]} icon={centerIcon} interactive={false} />
        </>
      )}

      {reviews.map((r) => (
        <Marker
          key={r.review.id}
          position={[r.review.lat, r.review.lng]}
          icon={icons.get(r.review.id)!}
          eventHandlers={{ click: () => onFocus(r.review.id) }}
          zIndexOffset={r.review.id === focusedId ? 1000 : 0}
          title={`${r.review.placeName} by ${r.author.name}`}
          keyboard
        >
          <Popup>
            <strong>{r.review.placeName}</strong>
            <br />
            {"★".repeat(r.review.rating)}
            {"☆".repeat(5 - r.review.rating)} · {r.author.name}
            <br />
            {r.review.text}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
