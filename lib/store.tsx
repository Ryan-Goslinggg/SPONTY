"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { authClient } from "./auth-client";
import type { RealtimeEvent } from "./realtime-events";
import * as actions from "./server/actions";
import type { LatLng, Message, Place, Post, Review, Snapshot, User } from "./types";

/**
 * The client side of Sponty's data. Pages read `state` and call the methods
 * below; each method updates the screen right away, then confirms with the
 * server (rolling back and showing a toast if that fails). New messages and
 * friends arrive live over /api/events.
 */

export interface State {
  meId: string;
  users: User[];
  friends: string[];
  /** Newest first. */
  posts: Post[];
  /** Oldest first. */
  messages: Message[];
  /** Bumped after the user adds a review so nearby lists refetch. */
  reviewsVersion: number;
}

type Patch = Partial<Pick<User, "name" | "bio" | "hobbies" | "location">>;
type NearbyReviews = { reviews: Review[]; users: User[] };

interface Store {
  state: State;
  me: User;
  userById: (id: string) => User | undefined;
  isFriend: (id: string) => boolean;
  updateProfile: (patch: Patch) => Promise<boolean>;
  addPost: (input: { place: Place; caption: string; photos: Blob[] }) => Promise<boolean>;
  toggleLike: (postId: string) => void;
  addFriend: (user: User) => void;
  sendMessage: (threadId: string, text: string) => void;
  loadThread: (friendId: string) => void;
  addReview: (input: Omit<Review, "id" | "authorId" | "createdAt">) => Promise<boolean>;
  reviewsNear: (center: LatLng) => Promise<NearbyReviews | null>;
  rememberUsers: (users: User[]) => void;
  signOut: () => Promise<void>;
  /** Permanently deletes the account and all its data, then goes to sign-in. Resolves false if it failed. */
  deleteAccount: () => Promise<boolean>;
}

const StoreContext = createContext<Store | null>(null);

const SESSION_ENDED = "Your session ended. Please sign in again.";
const REFRESH_AFTER_MS = 30_000;

function fromSnapshot(s: Snapshot): State {
  return { meId: s.me.id, users: s.users, friends: s.friends, posts: s.posts, messages: s.messages, reviewsVersion: 0 };
}

function mergeUsers(current: User[], incoming: User[]): User[] {
  if (incoming.length === 0) return current;
  const byId = new Map(current.map((u) => [u.id, u]));
  for (const u of incoming) byId.set(u.id, u);
  return [...byId.values()];
}

function mergeMessages(current: Message[], incoming: Message[], drop?: string): Message[] {
  const byId = new Map(current.filter((m) => m.id !== drop).map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
}

let tempSeq = 0;
const tempId = (prefix: string) => `${prefix}_pending_${++tempSeq}`;

async function uploadPhoto(photo: Blob): Promise<string> {
  const form = new FormData();
  form.append("photo", photo, "photo.jpg");
  const res = await fetch("/api/uploads", { method: "POST", body: form });
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !body.url) throw new Error(body.error ?? "Couldn't upload that photo");
  return body.url;
}

export function StoreProvider({ initial, children }: { initial: Snapshot; children: React.ReactNode }) {
  const [state, setState] = useState<State>(() => fromSnapshot(initial));
  const stateRef = useRef(state);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /** Unwraps an action result, reporting failures. Returns undefined on failure. */
  const settle = useCallback(
    <T,>(result: actions.Result<T>): T | undefined => {
      if (result.ok) return result.data;
      toast(result.error);
      if (result.error === SESSION_ENDED) router.replace("/sign-in");
      return undefined;
    },
    [toast, router],
  );

  const refresh = useCallback(async () => {
    const res = await actions.getSnapshotAction().catch(() => null);
    if (!res?.ok) return;
    const snap = res.data;
    setState((s) => ({
      ...s,
      users: mergeUsers(s.users, snap.users),
      friends: snap.friends,
      posts: snap.posts,
      messages: mergeMessages(s.messages, snap.messages),
    }));
  }, []);

  const rememberUsers = useCallback((users: User[]) => setState((s) => ({ ...s, users: mergeUsers(s.users, users) })), []);

  // Live updates. EventSource reconnects by itself; every reconnect resyncs to cover the gap.
  useEffect(() => {
    const es = new EventSource("/api/events");
    let readyOnce = false;
    es.addEventListener("ready", () => {
      if (readyOnce) void refresh();
      readyOnce = true;
    });
    es.onmessage = (e: MessageEvent<string>) => {
      let event: RealtimeEvent;
      try {
        event = JSON.parse(e.data);
      } catch {
        return;
      }
      const meId = stateRef.current.meId;
      if (event.type === "message") {
        const m = event.message;
        const message: Message = {
          id: m.id,
          threadId: m.senderId === meId ? m.recipientId : m.senderId,
          fromId: m.senderId,
          text: m.text,
          createdAt: m.createdAt,
        };
        setState((s) => ({ ...s, messages: mergeMessages(s.messages, [message]) }));
      } else if (event.type === "friend") {
        const id = event.friendId;
        setState((s) => (s.friends.includes(id) ? s : { ...s, friends: [id, ...s.friends] }));
        if (!stateRef.current.users.some((u) => u.id === id)) {
          void actions.getUsersAction([id]).then((r) => r.ok && rememberUsers(r.data));
        }
      }
    };
    return () => es.close();
  }, [refresh, rememberUsers]);

  // The wall isn't live; catch up when the user comes back to the tab.
  useEffect(() => {
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < REFRESH_AFTER_MS) return;
      last = Date.now();
      void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const methods = useMemo(() => {
    const patchPost = (postId: string, patch: Partial<Post>) =>
      setState((s) => ({ ...s, posts: s.posts.map((p) => (p.id === postId ? { ...p, ...patch } : p)) }));

    return {
      rememberUsers,

      async updateProfile(patch: Patch) {
        const before = stateRef.current.users.find((u) => u.id === stateRef.current.meId)!;
        rememberUsers([{ ...before, ...patch }]);
        const saved = settle(await actions.updateProfileAction(patch));
        rememberUsers([saved ?? before]);
        return !!saved;
      },

      async addPost({ place, caption, photos }: { place: Place; caption: string; photos: Blob[] }) {
        let urls: string[];
        try {
          urls = await Promise.all(photos.map(uploadPhoto));
        } catch (e) {
          toast((e as Error).message);
          return false;
        }
        const post = settle(await actions.createPostAction({ place, caption, photos: urls }));
        if (post) setState((s) => ({ ...s, posts: [post, ...s.posts.filter((p) => p.id !== post.id)] }));
        return !!post;
      },

      toggleLike(postId: string) {
        const before = stateRef.current.posts.find((p) => p.id === postId);
        if (!before) return;
        const liked = !before.likedByMe;
        patchPost(postId, { likedByMe: liked, likeCount: Math.max(0, before.likeCount + (liked ? 1 : -1)) });
        void actions.setLikeAction(postId, liked).then((r) => {
          const confirmed = settle(r);
          patchPost(postId, confirmed ?? { likedByMe: before.likedByMe, likeCount: before.likeCount });
        });
      },

      addFriend(user: User) {
        rememberUsers([user]);
        setState((s) => (s.friends.includes(user.id) ? s : { ...s, friends: [user.id, ...s.friends] }));
        void actions.addFriendAction(user.id).then((r) => {
          if (settle(r)) return;
          setState((s) => ({ ...s, friends: s.friends.filter((id) => id !== user.id) }));
        });
      },

      sendMessage(threadId: string, text: string) {
        const { meId } = stateRef.current;
        const pending: Message = { id: tempId("m"), threadId, fromId: meId, text, createdAt: Date.now() };
        setState((s) => ({ ...s, messages: mergeMessages(s.messages, [pending]) }));
        void actions.sendMessageAction({ friendId: threadId, text }).then((r) => {
          const sent = settle(r);
          setState((s) => ({ ...s, messages: mergeMessages(s.messages, sent ? [sent] : [], pending.id) }));
        });
      },

      loadThread(friendId: string) {
        void actions.loadThreadAction(friendId).then((r) => {
          if (r.ok) setState((s) => ({ ...s, messages: mergeMessages(s.messages, r.data) }));
        });
      },

      async addReview(input: Omit<Review, "id" | "authorId" | "createdAt">) {
        const review = settle(await actions.createReviewAction(input));
        if (review) setState((s) => ({ ...s, reviewsVersion: s.reviewsVersion + 1 }));
        return !!review;
      },

      async reviewsNear(center: LatLng) {
        const found = settle(await actions.reviewsNearAction({ lat: center.lat, lng: center.lng }));
        if (!found) return null;
        rememberUsers(found.users);
        return found;
      },

      async signOut() {
        await authClient.signOut();
        router.replace("/sign-in");
        router.refresh();
      },

      async deleteAccount() {
        const done = settle(await actions.deleteAccountAction());
        if (done === undefined) return false;
        router.replace("/sign-in");
        router.refresh();
        return true;
      },
    };
  }, [rememberUsers, settle, toast, router]);

  const store = useMemo<Store>(() => {
    const usersById = new Map(state.users.map((u) => [u.id, u]));
    const friendSet = new Set(state.friends);
    return {
      state,
      me: usersById.get(state.meId)!,
      userById: (id) => usersById.get(id),
      isFriend: (id) => friendSet.has(id),
      ...methods,
    };
  }, [state, methods]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

/** Everyone's reviews inside the 500m circle around `center`, refetched when the user adds one. */
export function useNearbyReviews(center: LatLng | null): { reviews: Review[]; loading: boolean } {
  const { reviewsNear, state } = useStore();
  const at = center ? `${center.lat},${center.lng}` : null;
  const version = state.reviewsVersion;
  const [result, setResult] = useState<{ at: string; version: number; reviews: Review[] } | null>(null);

  useEffect(() => {
    if (!at || !center) return;
    let live = true;
    void reviewsNear(center).then((found) => {
      if (live) setResult({ at, version, reviews: found?.reviews ?? [] });
    });
    return () => {
      live = false;
    };
    // `at` captures the center, which is a new object on every pin drop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, version, reviewsNear]);

  // Keep showing the old list while a refetch for the same pin is in flight.
  const current = result && result.at === at ? result : null;
  return { reviews: current?.reviews ?? [], loading: !!at && (!current || current.version !== version) };
}
