"use client";

import Link from "next/link";
import { AddFriendPanel } from "@/components/AddFriendPanel";
import { Avatar } from "@/components/Avatar";
import { TopBar } from "@/components/TopBar";
import { timeAgo } from "@/lib/format";
import { useStore } from "@/lib/store";

export default function ChatListPage() {
  const { state, me, userById } = useStore();

  const threads = state.friends
    .map((id) => {
      const user = userById(id);
      const msgs = state.messages.filter((m) => m.threadId === id);
      return { user, last: msgs.at(-1) };
    })
    .filter((t) => t.user)
    .sort((a, b) => (b.last?.createdAt ?? 0) - (a.last?.createdAt ?? 0));

  return (
    <div className="animate-fade-in pb-32">
      <TopBar title="Chat" subtitle={`${threads.length} ${threads.length === 1 ? "friend" : "friends"}`} />

      {threads.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-soft">No friends yet. Scroll down to find your people.</p>
      ) : (
        <ul className="space-y-2">
          {threads.map(({ user, last }, i) => (
            <li key={user!.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <Link
                href={`/chat/${user!.id}`}
                className="press flex items-center gap-3 rounded-[22px] bg-white p-3 shadow-sm hover:bg-mint-100/60"
              >
                <Avatar user={user!} size={50} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-extrabold">{user!.name}</span>
                    {last && <span className="shrink-0 text-[11px] font-semibold text-ink-soft">{timeAgo(last.createdAt)}</span>}
                  </div>
                  <p className="truncate text-sm text-ink-soft">
                    {last ? `${last.fromId === me.id ? "You: " : ""}${last.text}` : `Say hi to ${user!.name.split(" ")[0]}`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-center text-xs font-semibold text-ink-soft">Looking for more travel buddies?</p>
      <AddFriendPanel />
    </div>
  );
}
