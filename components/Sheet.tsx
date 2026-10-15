"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { pushLayer } from "@/lib/layers";
import { CloseIcon } from "./icons";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet with a soft backdrop. Closes on backdrop tap or Escape.
 * Portaled to <body> so page-level animations can't trap it under the nav.
 * Keyboard focus moves into the sheet, stays inside while open, and returns
 * to whatever opened it afterwards.
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
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Callers often pass an inline onClose; reading it through a ref keeps the
  // open/close effect from re-running (and re-stacking) on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const layer = pushLayer();
    panel.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (!layer.isTop()) return;
      if (e.key === "Escape") return onCloseRef.current();
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      layer.release();
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div aria-hidden="true" className="absolute inset-0 animate-fade-in bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        className="relative max-h-[90dvh] w-full max-w-md animate-sheet-up overflow-y-auto rounded-t-[28px] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl outline-none"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-mint-200" aria-hidden="true" />
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-extrabold">
            {title}
          </h2>
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
