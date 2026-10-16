"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { DemoBadge } from "@/components/DemoBadge";
import { BackIcon, SendIcon } from "@/components/icons";
import { useStore } from "@/lib/store";

export default function ChatThreadPage() {
  const { id } = useParams<{ id: string }>();
  const { state, me, userById, isFriend, sendMessage, loadThread } = useStore();
  const friend = userById(id);
  const messages = state.messages.filter((m) => m.threadId === id);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const friendsWith = isFriend(id);
  useEffect(() => {
    if (friendsWith) loadThread(id);
  }, [id, friendsWith, loadThread]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  if (!friend || !friendsWith) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-center">
        <p className="font-extrabold">This chat isn&apos;t available</p>
        <Link href="/chat" className="press rounded-full bg-mint-500 px-4 py-2 text-sm font-bold text-white">
          Back to chats
        </Link>
      </div>
    );
  }
  return (
    <div className="flex min-h-dvh animate-fade-in flex-col">
      <header className="sticky top-0 z-10 -mx-4 flex items-center gap-3 bg-mint-50/90 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
        <Link href="/chat" className="press rounded-full p-1.5 text-ink hover:bg-mint-100" aria-label="Back to chats">
          <BackIcon />
        </Link>
        <Avatar user={friend} size={40} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-extrabold">
            <span className="truncate">{friend.name}</span>
            <DemoBadge userId={friend.id} />
          </p>
          <p className="truncate text-xs font-semibold text-ink-soft">{friend.location.name}</p>
        </div>
      </header>

      <div className="flex-1 space-y-2 py-3">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-soft">Plan your next spontaneous trip with {friend.name.split(" ")[0]}.</p>
        )}
        {messages.map((m) => {
          const mine = m.fromId === me.id;
          return (
            <div key={m.id} className={`flex animate-pop ${mine ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[78%] whitespace-pre-wrap break-words rounded-3xl px-4 py-2.5 text-[15px] leading-snug ${mine ? "rounded-br-lg bg-mint-500 text-white" : "rounded-bl-lg bg-white text-ink shadow-sm"}`}
              >
                {m.text}
              </p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-0 -mx-4 flex items-end gap-2 bg-mint-50/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          sendMessage(id, text);
          setDraft("");
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message"
          maxLength={1000}
          className="flex-1 rounded-full border border-mint-200 bg-white px-4 py-3 text-[15px] outline-none transition focus:border-mint-400 focus:ring-4 focus:ring-mint-200/50"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="Send"
          className="press flex h-12 w-12 items-center justify-center rounded-full bg-mint-500 text-white shadow-md shadow-mint-500/30 disabled:bg-mint-200 disabled:shadow-none"
        >
          <SendIcon size={20} />
        </button>
      </form>
    </div>
  );
}
