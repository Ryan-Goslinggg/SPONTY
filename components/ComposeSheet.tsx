"use client";

import { useEffect, useRef, useState } from "react";
import { compressPhoto } from "@/lib/image";
import { useStore } from "@/lib/store";
import type { Place } from "@/lib/types";
import { CameraIcon, CloseIcon, ImageIcon } from "./icons";
import { usePermissions } from "./PermissionProvider";
import { PlacePicker } from "./PlacePicker";
import { Field } from "./ProfileSheet";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";

const MAX_PHOTOS = 4;

type Photo = { blob: Blob; preview: string };

export function ComposeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Share a trip">
      {open && <ComposeForm onDone={onClose} />}
    </Sheet>
  );
}

function ComposeForm({ onDone }: { onDone: () => void }) {
  const { addPost } = useStore();
  const toast = useToast();
  const [place, setPlace] = useState<Place | null>(null);
  const [caption, setCaption] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const { takePhoto } = usePermissions();

  // Free preview URLs when photos are removed or the sheet closes.
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const set = previews.current;
    return () => set.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  function removePhoto(i: number) {
    const url = photos[i].preview;
    URL.revokeObjectURL(url);
    previews.current.delete(url);
    setPhotos(photos.filter((_, j) => j !== i));
  }

  async function onCamera() {
    try {
      const photo = await takePhoto();
      // No in-browser camera (e.g. an older browser): let the phone's own camera app do it.
      if (photo === "unsupported") return captureRef.current?.click();
      if (photo) await addPhotos([photo]);
    } catch {
      // The user chose "Not now".
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    await addPhotos([...files]);
  }

  async function addPhotos(files: Blob[]) {
    setBusy(true);
    try {
      const room = MAX_PHOTOS - photos.length;
      const blobs = await Promise.all(files.slice(0, room).map((f) => compressPhoto(f)));
      const next = blobs.map((blob) => ({ blob, preview: URL.createObjectURL(blob) }));
      next.forEach((p) => previews.current.add(p.preview));
      setPhotos((p) => [...p, ...next]);
    } catch {
      toast("Couldn't read that photo");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
      if (captureRef.current) captureRef.current.value = "";
    }
  }

  const canPost = !!place && (caption.trim().length > 0 || photos.length > 0) && !busy && !posting;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!place || !canPost) return;
        setPosting(true);
        const ok = await addPost({ place, caption: caption.trim(), photos: photos.map((p) => p.blob) });
        setPosting(false);
        if (!ok) return;
        toast("Trip shared");
        onDone();
      }}
    >
      <Field label="Where did you go?">
        <PlacePicker value={place} onChange={setPlace} />
      </Field>
      <Field label="Photos" hint={`Up to ${MAX_PHOTOS}`}>
        <div className="flex flex-wrap gap-2">
          {photos.map(({ preview }, i) => (
            <div key={preview} className="relative h-20 w-20 animate-pop overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt={`Photo ${i + 1} to share`} className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                disabled={posting}
                onClick={() => removePhoto(i)}
                className="press absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-ink"
              >
                <CloseIcon size={14} />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <>
              <button
                type="button"
                disabled={busy || posting}
                onClick={onCamera}
                className="press flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-mint-300 text-xs font-bold text-mint-700 hover:bg-mint-50"
              >
                <CameraIcon size={20} />
                {busy ? "..." : "Camera"}
              </button>
              <button
                type="button"
                disabled={busy || posting}
                onClick={() => fileRef.current?.click()}
                className="press flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-mint-300 text-xs font-bold text-mint-700 hover:bg-mint-50"
              >
                <ImageIcon size={20} />
                {busy ? "..." : "Gallery"}
              </button>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        <input
          ref={captureRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
      </Field>
      <Field label="What happened?">
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="The unplanned part is always the best part..."
          className="input resize-none"
        />
      </Field>
      <p className="text-xs text-ink-soft">
        Everyone on Sponty can see this trip. Photo location data is removed before saving.
      </p>
      <button
        type="submit"
        disabled={!canPost}
        className="press w-full rounded-2xl bg-mint-500 py-3 font-extrabold text-white shadow-md shadow-mint-500/30 hover:bg-mint-600 disabled:bg-mint-200 disabled:shadow-none"
      >
        {posting ? "Sharing..." : "Post trip"}
      </button>
    </form>
  );
}
