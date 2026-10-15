"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Avatar } from "./Avatar";
import { ProfileSheet } from "./ProfileSheet";

export function TopBar({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const { me } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-[800] -mx-4 mb-3 flex items-center justify-between bg-mint-50/85 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="text-xs font-semibold text-ink-soft">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {right}
        <button type="button" onClick={() => setOpen(true)} className="press rounded-full" aria-label="Edit your profile">
          <Avatar user={me} size={38} ring />
        </button>
      </div>
      <ProfileSheet open={open} onClose={() => setOpen(false)} />
    </header>
  );
}
