"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Place } from "@/lib/types";
import { CloseIcon } from "./icons";
import { PlacePicker } from "./PlacePicker";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";

export function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Your profile">
      {/* Mounting the form only while open resets the draft every time it opens. */}
      {open && <ProfileForm onDone={onClose} />}
    </Sheet>
  );
}

function ProfileForm({ onDone }: { onDone: () => void }) {
  const { me, updateProfile, signOut } = useStore();
  const toast = useToast();
  const [name, setName] = useState(me.name);
  const [bio, setBio] = useState(me.bio);
  const [hobbies, setHobbies] = useState(me.hobbies);
  const [hobbyDraft, setHobbyDraft] = useState("");
  const [location, setLocation] = useState<Place>(me.location);
  const [busy, setBusy] = useState(false);

  function addHobby() {
    const h = hobbyDraft.trim();
    if (h && !hobbies.some((x) => x.toLowerCase() === h.toLowerCase())) setHobbies([...hobbies, h]);
    setHobbyDraft("");
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        const ok = await updateProfile({ name: name.trim() || me.name, bio: bio.trim(), hobbies, location });
        setBusy(false);
        if (!ok) return;
        toast("Profile saved");
        onDone();
      }}
    >
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="input" />
      </Field>
      <Field label="Bio" hint="The AI uses this to find people you'll click with">
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3} className="input resize-none" />
      </Field>
      <Field label="Hobbies">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {hobbies.map((h) => (
            <span key={h} className="flex animate-pop items-center gap-1 rounded-full bg-mint-100 py-1 pl-3 pr-1.5 text-sm font-semibold text-mint-700">
              {h}
              <button type="button" aria-label={`Remove ${h}`} onClick={() => setHobbies(hobbies.filter((x) => x !== h))} className="press rounded-full p-0.5 hover:bg-mint-200">
                <CloseIcon size={14} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={hobbyDraft}
            onChange={(e) => setHobbyDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addHobby();
              }
            }}
            maxLength={40}
            placeholder="e.g. Street food"
            className="input"
          />
          <button type="button" onClick={addHobby} className="press rounded-2xl bg-mint-100 px-4 text-sm font-bold text-mint-700 hover:bg-mint-200">
            Add
          </button>
        </div>
      </Field>
      <Field label="Where you are">
        <PlacePicker value={location} onChange={setLocation} />
      </Field>
      <button
        type="submit"
        disabled={busy}
        className="press w-full rounded-2xl bg-mint-500 py-3 font-extrabold text-white shadow-md shadow-mint-500/30 hover:bg-mint-600 disabled:bg-mint-200 disabled:shadow-none"
      >
        {busy ? "Saving..." : "Save"}
      </button>
      <button type="button" onClick={() => void signOut()} className="w-full py-2 text-xs font-semibold text-ink-soft hover:text-ink">
        Sign out
      </button>
    </form>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold">{label}</span>
        {hint && <span className="text-right text-[11px] text-ink-soft">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
