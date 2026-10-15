"use client";

import { useEffect, useState } from "react";
import { getCurrentPosition, reverseGeocode, searchPlaces } from "@/lib/geocode";
import type { Place } from "@/lib/types";
import { LocateIcon, PinIcon, SearchIcon } from "./icons";

/** Search a place by name, or use the device location. */
export function PlacePicker({ value, onChange }: { value: Place | null; onChange: (p: Place) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      searchPlaces(q, ctrl.signal)
        .then((r) => {
          setResults(r);
          setStatus(r.length ? null : "No places found");
        })
        .catch((e: unknown) => {
          if ((e as Error).name !== "AbortError") setStatus("Search is unavailable right now");
        });
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  async function useMyLocation() {
    setStatus("Finding you...");
    try {
      const pos = await getCurrentPosition();
      const name = (await reverseGeocode(pos)) ?? "Current location";
      onChange({ name, ...pos });
      setStatus(null);
      setQuery("");
      setResults([]);
    } catch (e) {
      setStatus((e as Error).message);
    }
  }

  return (
    <div className="space-y-2">
      {value && (
        <div className="flex animate-fade-in items-center gap-2 rounded-2xl bg-mint-100 px-3 py-2 text-sm font-semibold text-mint-700">
          <PinIcon size={16} /> {value.name}
        </div>
      )}
      <div className="flex gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-2xl border border-mint-200 bg-mint-50 px-3 focus-within:border-mint-400">
          <SearchIcon size={16} className="text-ink-soft" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length < 3) setResults([]);
            }}
            placeholder="Search a place"
            className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-ink-soft/60"
          />
        </label>
        <button
          type="button"
          onClick={useMyLocation}
          className="press flex items-center gap-1 rounded-2xl bg-mint-100 px-3 text-sm font-bold text-mint-700 hover:bg-mint-200"
        >
          <LocateIcon size={16} /> Here
        </button>
      </div>
      {status && <p className="text-xs text-ink-soft">{status}</p>}
      {results.length > 0 && (
        <ul className="animate-fade-in overflow-hidden rounded-2xl border border-mint-100">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button
                type="button"
                onClick={() => {
                  onChange(r);
                  setQuery("");
                  setResults([]);
                }}
                className="w-full px-3 py-2.5 text-left text-sm hover:bg-mint-50"
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
