"use client";

import { useEffect, useRef, useState } from "react";
import { distanceMeters, formatDistance } from "@/lib/geo";
import { useStore } from "@/lib/store";
import type { MatchResult, User } from "@/lib/types";
import { Avatar } from "./Avatar";
import { CheckIcon, PlusIcon, SparkleIcon } from "./icons";
import { useToast } from "./Toast";

type Source = "ai" | "heuristic";
type Suggestions = { key: string; source: Source; matches: MatchResult[]; users: User[]; error?: string };

/**
 * Revealed when the user scrolls to the bottom of the chat list. Ranks people
 * who aren't friends yet by how well they match the user's bio, hobbies and location.
 */
export function AddFriendPanel() {
  const { me, addFriend, isFriend } = useStore();
  const toast = useToast();
  const sentinel = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<Suggestions | null>(null);
  // Friends added while the panel is open stay visible with a check mark.
  const [justAdded, setJustAdded] = useState<string[]>([]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setRevealed(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Re-score when the profile changes. Adding a friend must not trigger a re-score.
  const profileKey = JSON.stringify([me.bio, me.hobbies, me.location]);

  useEffect(() => {
    if (!revealed) return;
    const ctrl = new AbortController();
    // The server picks the candidates (nearest non-friends) and scores them.
    fetch("/api/match", { method: "POST", signal: ctrl.signal })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error ?? "Couldn't load suggestions right now.");
        return body as Omit<Suggestions, "key">;
      })
      .then((data) => setResult({ key: profileKey, ...data }))
      .catch((e: unknown) => {
        if ((e as Error).name === "AbortError") return;
        const error = e instanceof TypeError ? "You're offline. Suggestions will be back when you are." : (e as Error).message;
        setResult({ key: profileKey, source: "heuristic", matches: [], users: [], error });
      });
    return () => ctrl.abort();
  }, [revealed, profileKey]);

  const loading = revealed && (!result || result.key !== profileKey);
  const userById = new Map(result?.users.map((u) => [u.id, u]));
  const candidates = result?.users.filter((u) => !isFriend(u.id) || justAdded.includes(u.id)) ?? [];

  return (
    <>
      <div ref={sentinel} className="h-1" aria-hidden="true" />
      <section
        className={`mt-4 rounded-[26px] border border-mint-200 bg-white p-4 shadow-[0_-6px_30px_rgb(31_58_43/0.06)] transition-all duration-500 ease-[var(--ease-bounce)] ${revealed ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
        aria-label="Add friends"
      >
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mint-100 text-mint-600">
            <SparkleIcon size={18} />
          </span>
          <h2 className="text-lg font-extrabold">Add friends</h2>
        </div>
        <p className="mb-4 text-xs text-ink-soft">
          {result?.source === "ai" ? "AI-picked" : "Picked"} from your bio, hobbies and where you are.
        </p>

        {!loading && result?.error && <p className="py-6 text-center text-sm text-ink-soft">{result.error}</p>}
        {!loading && result && !result.error && candidates.length === 0 && (
          <p className="py-6 text-center text-sm text-ink-soft">You&apos;re friends with everyone here!</p>
        )}

        {loading && (
          <ul className="space-y-3">
            {[0, 1, 2].map((i) => (
              <li key={i} className="skeleton h-20 rounded-2xl" />
            ))}
          </ul>
        )}

        {!loading && result && (
          <ul className="space-y-3">
            {result.matches.map((m, i) => {
              const u = userById.get(m.id);
              const added = isFriend(m.id);
              if (!u || (added && !justAdded.includes(m.id))) return null;
              return (
                <li
                  key={m.id}
                  className="flex animate-fade-up items-center gap-3 rounded-2xl bg-mint-50 p-3"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <div className="relative">
                    <Avatar user={u} size={48} />
                    <ScoreBadge score={m.score} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">{u.name}</p>
                    <p className="truncate text-[11px] font-semibold text-ink-soft">
                      {u.location.name} · {formatDistance(distanceMeters(me.location, u.location))}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink">{m.reason}</p>
                  </div>
                  <button
                    type="button"
                    disabled={added}
                    onClick={() => {
                      addFriend(u);
                      setJustAdded((a) => [...a, u.id]);
                      toast(`You and ${u.name.split(" ")[0]} are now friends`);
                    }}
                    className={`press flex h-10 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-bold ${added ? "bg-mint-100 text-mint-600" : "bg-mint-500 text-white shadow-md shadow-mint-500/30 hover:bg-mint-600"}`}
                  >
                    {added ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
                    {added ? "Added" : "Add"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "bg-mint-500" : score >= 40 ? "bg-mint-400" : "bg-mint-300";
  return (
    <span
      className={`absolute -bottom-1 -right-1 rounded-full ${color} px-1.5 text-[10px] font-black text-white ring-2 ring-mint-50`}
      title="Match score"
    >
      {score}%
    </span>
  );
}
