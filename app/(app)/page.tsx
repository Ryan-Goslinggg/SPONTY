"use client";

import { useState } from "react";
import { ComposeSheet } from "@/components/ComposeSheet";
import { PlusIcon } from "@/components/icons";
import { PostCard } from "@/components/PostCard";
import { TopBar } from "@/components/TopBar";
import { useStore } from "@/lib/store";

export default function HomePage() {
  const { state, me } = useStore();
  const [composing, setComposing] = useState(false);
  const posts = [...state.posts].sort((a, b) => b.createdAt - a.createdAt);
  const firstName = me.name === "You" ? "explorer" : me.name.split(" ")[0];

  return (
    <div className="animate-fade-in pb-32">
      <TopBar title="sponty" subtitle="Trips only. No doomscrolling." />

      <button
        type="button"
        onClick={() => setComposing(true)}
        className="press mb-5 flex w-full items-center gap-3 rounded-[22px] border border-mint-200 bg-white p-3 text-left shadow-sm hover:border-mint-300"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mint-500 text-white">
          <PlusIcon size={20} />
        </span>
        <span className="text-sm font-semibold text-ink-soft">Where did you wander off to, {firstName}?</span>
      </button>

      <div className="space-y-5">
        {posts.map((p, i) => (
          <PostCard key={p.id} post={p} index={i} />
        ))}
      </div>

      <div className="mt-10 flex flex-col items-center gap-2 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mint-100 text-2xl" aria-hidden="true">
          🌿
        </span>
        <p className="font-extrabold">You&apos;re all caught up</p>
        <p className="max-w-[16rem] text-sm text-ink-soft">
          That&apos;s every trip for now. Close the app and go make your own.
        </p>
      </div>

      <ComposeSheet open={composing} onClose={() => setComposing(false)} />
    </div>
  );
}
