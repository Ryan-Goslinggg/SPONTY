"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import type { MapReview } from "@/components/FindMap";
import { LocateIcon, PlusIcon, SearchIcon, StarIcon } from "@/components/icons";
import { Field } from "@/components/ProfileSheet";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { timeAgo } from "@/lib/format";
import { distanceMeters, isWithinRadius, PIN_DIAMETER_M } from "@/lib/geo";
import { getCurrentPosition, searchPlaces } from "@/lib/geocode";
import { ME_ID } from "@/lib/seed";
import { useStore } from "@/lib/store";
import type { LatLng, Place, ReviewCategory } from "@/lib/types";

// Leaflet touches `window`, so the map only renders in the browser.
const FindMap = dynamic(() => import("@/components/FindMap"), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full" />,
});

type Mode = "close" | "open";

export default function FindPage() {
  const { state, me, userById, isFriend } = useStore();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("close");
  const [pin, setPin] = useState<LatLng | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<(LatLng & { key: number }) | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [reviewing, setReviewing] = useState(false);

  const dropPin = useCallback((p: LatLng, fly = false) => {
    setPin(p);
    setFocusedId(null);
    setExpanded(true);
    if (fly) setFlyTarget({ ...p, key: Date.now() });
  }, []);

  const visible: MapReview[] = useMemo(() => {
    if (!pin) return [];
    return state.reviews
      .filter((r) => isWithinRadius(pin, r))
      .filter((r) => mode === "open" || r.authorId === ME_ID || isFriend(r.authorId))
      .map((review) => ({ review, author: userById(review.authorId)!, friend: isFriend(review.authorId) }))
      .filter((r) => r.author)
      .sort((a, b) => distanceMeters(pin, a.review) - distanceMeters(pin, b.review));
  }, [pin, mode, state.reviews, isFriend, userById]);

  // How many more pins the other mode would reveal, to nudge switching.
  const hiddenInOpen = useMemo(
    () => (pin && mode === "close" ? state.reviews.filter((r) => isWithinRadius(pin, r)).length - visible.length : 0),
    [pin, mode, state.reviews, visible.length],
  );

  async function locate() {
    try {
      const p = await getCurrentPosition();
      dropPin(p, true);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 animate-fade-in">
      <div className="absolute inset-0 isolate">
        <FindMap
          initialCenter={me.location}
          pin={pin}
          onPick={(p) => dropPin(p, true)}
          reviews={visible}
          focusedId={focusedId}
          onFocus={(id) => {
            setFocusedId(id);
            setExpanded(true);
          }}
          flyTarget={flyTarget}
        />
      </div>

      {/* Top controls */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] mx-auto max-w-md space-y-2 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto relative z-20 flex gap-2">
          <PlaceSearch onSelect={(p) => dropPin(p, true)} />
          <button
            type="button"
            onClick={locate}
            aria-label="Pin my location"
            className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-mint-700 shadow-lg"
          >
            <LocateIcon />
          </button>
        </div>
        <div className="pointer-events-auto relative mx-auto grid w-56 grid-cols-2 rounded-full bg-white/95 p-1 shadow-lg backdrop-blur">
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-mint-500 transition-transform duration-500 ease-[var(--ease-bounce)]"
            style={{ transform: mode === "open" ? "translateX(100%)" : "translateX(0)" }}
          />
          {(["close", "open"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`press relative z-10 rounded-full py-2 text-xs font-black uppercase tracking-widest ${mode === m ? "text-white" : "text-ink-soft"}`}
            >
              {m}
            </button>
          ))}
        </div>
        {!pin && (
          <p className="mx-auto w-fit animate-pop rounded-full bg-ink/80 px-4 py-2 text-center text-xs font-bold text-white backdrop-blur">
            Tap the map to drop a pin and see a {PIN_DIAMETER_M}m circle of reviews
          </p>
        )}
      </div>

      {/* Results card */}
      {pin && (
        <section className="absolute inset-x-0 bottom-24 z-[500] mx-auto max-w-md px-4" aria-label="Reviews in this area">
          <div className="animate-fade-up overflow-hidden rounded-[26px] bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="flex w-full items-center justify-between px-4 pb-2 pt-3 text-left"
              aria-expanded={expanded}
            >
              <div>
                <p className="font-extrabold">
                  {visible.length} {visible.length === 1 ? "review" : "reviews"} within {PIN_DIAMETER_M}m
                </p>
                <p className="text-xs font-semibold text-ink-soft">
                  {mode === "close" ? "Friends only" : "Everyone"}
                  {hiddenInOpen > 0 && ` · ${hiddenInOpen} more in OPEN mode`}
                </p>
              </div>
              <span className="mx-auto mb-auto mr-0 h-1.5 w-8 rounded-full bg-mint-200" aria-hidden="true" />
            </button>

            <div className={`grid transition-[grid-template-rows] duration-400 ease-[var(--ease-bounce)] ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden">
                <ul className="no-scrollbar max-h-[30dvh] space-y-2 overflow-y-auto px-3 pb-2">
                  {visible.length === 0 && (
                    <li className="px-2 py-4 text-center text-sm text-ink-soft">
                      {mode === "close" ? "None of your friends have reviewed this area yet." : "No one has reviewed this area yet."} Be the first!
                    </li>
                  )}
                  {visible.map(({ review, author, friend }) => (
                    <li key={review.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setFocusedId(review.id);
                          setFlyTarget({ lat: review.lat, lng: review.lng, key: Date.now() });
                        }}
                        className={`press flex w-full gap-3 rounded-2xl p-2.5 text-left transition-colors ${focusedId === review.id ? "bg-mint-100" : "hover:bg-mint-50"}`}
                      >
                        <Avatar user={author} size={36} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate font-extrabold">{review.placeName}</span>
                            <span className="shrink-0 text-[11px] font-semibold text-ink-soft">
                              {Math.round(distanceMeters(pin, review))}m
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-ink-soft">
                            <Stars value={review.rating} />
                            <span>
                              {author.id === ME_ID ? "You" : author.name}
                              {friend && " · friend"} · {timeAgo(review.createdAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm leading-snug">{review.text}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border-t border-mint-100 p-3">
              <button
                type="button"
                onClick={() => setReviewing(true)}
                className="press flex w-full items-center justify-center gap-2 rounded-2xl bg-mint-500 py-2.5 text-sm font-extrabold text-white shadow-md shadow-mint-500/30 hover:bg-mint-600"
              >
                <PlusIcon size={18} /> I&apos;ve been here - add a review
              </button>
            </div>
          </div>
        </section>
      )}

      <ReviewSheet open={reviewing} onClose={() => setReviewing(false)} at={pin} />
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex text-amber-400" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} size={12} filled={i <= value} />
      ))}
    </span>
  );
}

function PlaceSearch({ onSelect }: { onSelect: (p: Place) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 3) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      searchPlaces(query, ctrl.signal).then(setResults).catch(() => {});
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  return (
    <div className="relative flex-1">
      <label className="flex h-12 items-center gap-2 rounded-2xl bg-white px-3 shadow-lg focus-within:ring-4 focus-within:ring-mint-200/60">
        <SearchIcon size={18} className="text-ink-soft" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (e.target.value.trim().length < 3) setResults([]);
          }}
          placeholder="Search a place"
          className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-ink-soft/60"
        />
      </label>
      {results.length > 0 && (
        <ul className="absolute inset-x-0 top-14 animate-fade-in overflow-hidden rounded-2xl bg-white shadow-xl">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button
                type="button"
                className="w-full px-4 py-3 text-left text-sm hover:bg-mint-50"
                onClick={() => {
                  onSelect(r);
                  setQ("");
                  setResults([]);
                }}
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

function ReviewSheet({ open, onClose, at }: { open: boolean; onClose: () => void; at: LatLng | null }) {
  return (
    <Sheet open={open} onClose={onClose} title="Add a review">
      {open && at && <ReviewForm at={at} onDone={onClose} />}
    </Sheet>
  );
}

function ReviewForm({ at, onDone }: { at: LatLng; onDone: () => void }) {
  const { addReview } = useStore();
  const toast = useToast();
  const [placeName, setPlaceName] = useState("");
  const [category, setCategory] = useState<ReviewCategory>("food");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const valid = placeName.trim() && text.trim();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        addReview({ placeName: placeName.trim(), category, rating, text: text.trim(), lat: at.lat, lng: at.lng });
        toast("Review pinned");
        onDone();
      }}
    >
      <p className="-mt-2 text-xs text-ink-soft">Your review is pinned where you dropped the pin.</p>
      <Field label="Place name">
        <input value={placeName} onChange={(e) => setPlaceName(e.target.value)} maxLength={80} placeholder="e.g. Corner ramen bar" className="input" />
      </Field>
      <Field label="What is it?">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["food", "🍜 Restaurant"],
              ["spot", "🌄 Spot"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              aria-pressed={category === value}
              className={`press rounded-2xl border py-2.5 text-sm font-bold ${category === value ? "border-mint-400 bg-mint-100 text-mint-700" : "border-mint-200 text-ink-soft"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Rating">
        <div className="flex gap-1 text-amber-400">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" onClick={() => setRating(i)} aria-label={`${i} stars`} className="press">
              <StarIcon size={32} filled={i <= rating} />
            </button>
          ))}
        </div>
      </Field>
      <Field label="Your feedback">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={400}
          rows={3}
          placeholder="What makes it a hidden gem?"
          className="input resize-none"
        />
      </Field>
      <button
        type="submit"
        disabled={!valid}
        className="press w-full rounded-2xl bg-mint-500 py-3 font-extrabold text-white shadow-md shadow-mint-500/30 hover:bg-mint-600 disabled:bg-mint-200 disabled:shadow-none"
      >
        Pin review
      </button>
    </form>
  );
}
