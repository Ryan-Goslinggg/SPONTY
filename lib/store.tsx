"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { createSeed, ME_ID, type SeedState } from "./seed";
import type { Place, Post, Review, User } from "./types";

/**
 * Client-side data store persisted to localStorage. Every user action goes
 * through the methods below, so swapping this for a real backend later only
 * touches this file.
 */

const STORAGE_KEY = "sponty:v1";

type State = SeedState;

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function load(): State | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as State) : null;
  } catch {
    return null;
  }
}

interface Store {
  state: State;
  me: User;
  userById: (id: string) => User | undefined;
  isFriend: (id: string) => boolean;
  updateProfile: (patch: Partial<Pick<User, "name" | "bio" | "hobbies" | "location">>) => void;
  addPost: (input: { place: Place; caption: string; photos: string[] }) => void;
  toggleLike: (postId: string) => void;
  addFriend: (id: string) => void;
  sendMessage: (threadId: string, text: string) => void;
  addReview: (input: Omit<Review, "id" | "authorId" | "createdAt">) => void;
  resetDemo: () => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [initial, setInitial] = useState<State | null>(null);

  useEffect(() => {
    // Data lives on this device, so it can only be read after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitial(load() ?? createSeed());
  }, []);

  if (!initial) return <Splash />;
  return <LoadedStore initial={initial}>{children}</LoadedStore>;
}

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center" aria-label="Loading">
      <span className="animate-pop text-3xl font-black tracking-tight text-mint-500">sponty</span>
    </div>
  );
}

function LoadedStore({ initial, children }: { initial: State; children: React.ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const toast = useToast();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      toast("Storage is full - this change won't survive a reload. Try fewer photos.");
    }
  }, [state, toast]);

  const update = useCallback((fn: (s: State) => State) => setState(fn), []);

  const store = useMemo<Store>(() => {
    const me = state.users.find((u) => u.id === ME_ID)!;
    return {
      state,
      me,
      userById: (id) => state.users.find((u) => u.id === id),
      isFriend: (id) => state.friends.includes(id),
      updateProfile: (patch) =>
        update((s) => ({ ...s, users: s.users.map((u) => (u.id === ME_ID ? { ...u, ...patch } : u)) })),
      addPost: ({ place, caption, photos }) =>
        update((s) => ({
          ...s,
          posts: [
            { id: newId("p"), authorId: ME_ID, place, caption, photos, createdAt: Date.now(), likes: [] } satisfies Post,
            ...s.posts,
          ],
        })),
      toggleLike: (postId) =>
        update((s) => ({
          ...s,
          posts: s.posts.map((p) =>
            p.id !== postId
              ? p
              : { ...p, likes: p.likes.includes(ME_ID) ? p.likes.filter((l) => l !== ME_ID) : [...p.likes, ME_ID] },
          ),
        })),
      addFriend: (id) =>
        update((s) => (s.friends.includes(id) ? s : { ...s, friends: [...s.friends, id] })),
      sendMessage: (threadId, text) =>
        update((s) => ({
          ...s,
          messages: [...s.messages, { id: newId("m"), threadId, fromId: ME_ID, text, createdAt: Date.now() }],
        })),
      addReview: (input) =>
        update((s) => ({
          ...s,
          reviews: [...s.reviews, { ...input, id: newId("r"), authorId: ME_ID, createdAt: Date.now() }],
        })),
      resetDemo: () => {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore: storage may be unavailable
        }
        setState(createSeed());
      },
    };
  }, [state, update]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
