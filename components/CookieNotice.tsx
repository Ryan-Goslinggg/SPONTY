"use client";

import Link from "next/link";
import { updateConsent, useConsent } from "@/lib/consent";

/**
 * Sponty only stores what it needs to work, so there is nothing optional to
 * accept or reject. This notice says so plainly instead of showing a fake choice.
 */
export function CookieNotice() {
  const consent = useConsent();
  if (!consent || consent.cookieNoticeAt) return null;

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-24 z-[950] mx-auto max-w-md animate-fade-up px-4"
    >
      <div className="flex items-center gap-3 rounded-2xl bg-ink p-3 pl-4 text-sm text-white shadow-xl">
        <p className="flex-1 leading-snug">
          We only store what Sponty needs to work on this device. No ads or tracking.{" "}
          <Link href="/legal/cookies" className="font-bold underline underline-offset-2">
            Cookie policy
          </Link>
        </p>
        <button
          type="button"
          onClick={() => updateConsent({ cookieNoticeAt: Date.now() })}
          className="press shrink-0 rounded-full bg-white px-4 py-2 font-extrabold text-ink"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

/** Lets someone bring the notice back from the Cookie Policy page. */
export function CookieChoiceReset() {
  const consent = useConsent();
  return (
    <button
      type="button"
      disabled={!consent?.cookieNoticeAt}
      onClick={() => updateConsent({ cookieNoticeAt: null })}
      className="press mt-3 rounded-full bg-mint-100 px-4 py-2 text-sm font-bold text-mint-700 disabled:opacity-60"
    >
      {consent?.cookieNoticeAt ? "Show the cookie notice again" : "Cookie notice is showing"}
    </button>
  );
}
