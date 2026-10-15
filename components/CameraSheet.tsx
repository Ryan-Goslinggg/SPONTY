"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { pushLayer } from "@/lib/layers";
import { CloseIcon } from "./icons";

/**
 * Full-screen in-app camera. The stream only runs while this is open and is
 * stopped the moment it closes. Calls onDone(photo) when a picture is taken,
 * onDone(null) on close, and onDone(null, true) if the browser blocks the camera.
 */
export function CameraSheet({ onDone }: { onDone: (photo: Blob | null, denied?: boolean) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch((e: DOMException) => {
        if (cancelled) return;
        if (e.name === "NotAllowedError" || e.name === "SecurityError") onDone(null, true);
        else setError("We couldn't start the camera. Is another app using it?");
      });
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      setReady(false);
    };
  }, [facing, onDone]);

  useEffect(() => {
    const layer = pushLayer();
    const onKey = (e: KeyboardEvent) => {
      if (layer.isTop() && e.key === "Escape") onDone(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      layer.release();
    };
  }, [onDone]);

  function snap() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    setFlash((f) => f + 1);
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Selfies are previewed mirrored, so save them the way the user saw them.
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0);
    canvas.toBlob((b) => b && onDone(b), "image/jpeg", 0.9);
  }

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex animate-fade-in flex-col bg-black" role="dialog" aria-modal="true" aria-label="Camera">
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          onLoadedData={() => setReady(true)}
          className={`h-full w-full object-cover transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"} ${facing === "user" ? "-scale-x-100" : ""}`}
        />
        {!ready && !error && (
          <p className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white/80">
            Waking up the camera...
          </p>
        )}
        {error && <p className="absolute inset-x-6 top-1/2 text-center text-sm font-bold text-white">{error}</p>}
        {flash > 0 && <span key={flash} className="pointer-events-none absolute inset-0 animate-[flash_0.35s_ease-out_both] bg-white" />}
        <button
          type="button"
          onClick={() => onDone(null)}
          aria-label="Close camera"
          className="press absolute left-4 top-[max(1rem,env(safe-area-inset-top))] rounded-full bg-black/40 p-2.5 text-white backdrop-blur"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="flex items-center justify-around bg-black px-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
        <span className="w-12" aria-hidden="true" />
        <button
          type="button"
          onClick={snap}
          disabled={!ready}
          aria-label="Take photo"
          className="press flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-4 border-white disabled:opacity-40"
        >
          <span className="h-14 w-14 rounded-full bg-mint-200" />
        </button>
        <button
          type="button"
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          aria-label="Switch camera"
          className="press flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-xl text-white"
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>
    </div>,
    document.body,
  );
}
