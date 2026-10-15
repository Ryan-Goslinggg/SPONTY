"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./icons";

/**
 * Bottom sheet with a soft backdrop. Closes on backdrop tap or Escape.
 * Portaled to <body> so page-level animations can't trap it under the nav.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 animate-fade-in bg-ink/30 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative max-h-[90dvh] w-full max-w-md animate-sheet-up overflow-y-auto rounded-t-[28px] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-mint-200" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} className="press rounded-full p-2 text-ink-soft hover:bg-mint-100" aria-label="Close">
            <CloseIcon size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
