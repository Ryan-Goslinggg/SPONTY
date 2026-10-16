"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { updateConsent, useConsent } from "@/lib/consent";
import { SITE } from "@/lib/site";

/** Pages anyone can read before agreeing to anything. */
const OPEN_PATHS = ["/legal", "/about"];

/**
 * First-run screen: confirm the minimum age and accept the Terms and Privacy
 * Policy before any of the app (and its data) loads.
 */
export function WelcomeGate({ children }: { children: React.ReactNode }) {
  const state = useGateState();
  if (state === "loading") return null;
  if (state === "open") return <>{children}</>;
  return (
    <main id="main" className="mx-auto w-full max-w-md px-4">
      <Welcome />
    </main>
  );
}

function useGateState(): "loading" | "open" | "closed" {
  const consent = useConsent();
  const pathname = usePathname();
  if (OPEN_PATHS.some((p) => pathname.startsWith(p))) return "open";
  if (!consent) return "loading";
  return consent.acceptedAt ? "open" : "closed";
}

function Welcome() {
  const [isOldEnough, setIsOldEnough] = useState(false);
  const [accepts, setAccepts] = useState(false);
  const [tooYoung, setTooYoung] = useState(false);

  if (tooYoung) {
    return (
      <div className="flex min-h-dvh animate-fade-in flex-col items-center justify-center gap-3 px-2 text-center">
        <span className="text-4xl" aria-hidden="true">
          🌱
        </span>
        <h1 className="text-xl font-black">Come back when you&apos;re {SITE.minimumAge}</h1>
        <p className="max-w-xs text-sm text-ink-soft">
          {SITE.name} is only for people aged {SITE.minimumAge} and over. We haven&apos;t saved anything about you.
        </p>
        <button type="button" onClick={() => setTooYoung(false)} className="press mt-2 text-sm font-bold text-mint-700 underline">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh animate-fade-in flex-col justify-center py-10">
      <p className="text-4xl font-black tracking-tight text-mint-700">sponty</p>
      <h1 className="mt-2 text-xl font-extrabold">Share spontaneous trips. Find hidden gems.</h1>
      <p className="mt-2 text-sm text-ink-soft">Before you start, please confirm two things.</p>

      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (isOldEnough && accepts) updateConsent({ acceptedAt: Date.now() });
        }}
      >
        <Check checked={isOldEnough} onChange={setIsOldEnough}>
          I am {SITE.minimumAge} or older.
        </Check>
        <Check checked={accepts} onChange={setAccepts}>
          I agree to the{" "}
          <Link href="/legal/terms" className="font-bold text-mint-700 underline">
            Terms of Service
          </Link>{" "}
          and have read the{" "}
          <Link href="/legal/privacy" className="font-bold text-mint-700 underline">
            Privacy Policy
          </Link>
          .
        </Check>
        <button
          type="submit"
          disabled={!isOldEnough || !accepts}
          className="press !mt-6 w-full rounded-2xl bg-mint-500 py-3 font-extrabold text-white shadow-md shadow-mint-500/30 hover:bg-mint-600 disabled:bg-mint-200 disabled:text-ink-soft disabled:shadow-none"
        >
          Continue
        </button>
        <button type="button" onClick={() => setTooYoung(true)} className="w-full py-2 text-sm font-bold text-ink-soft hover:text-ink">
          I&apos;m under {SITE.minimumAge}
        </button>
      </form>
    </div>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-mint-200 bg-white p-4 text-sm leading-snug has-[:checked]:border-mint-500">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-mint-500"
      />
      <span>{children}</span>
    </label>
  );
}
