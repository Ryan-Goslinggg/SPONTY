"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { getCurrentPosition, PermissionDeniedError } from "@/lib/geocode";
import { PermissionCancelledError, permissionStatus, type PermissionKind } from "@/lib/permissions";
import type { LatLng } from "@/lib/types";
import { CameraSheet } from "./CameraSheet";
import { Sheet } from "./Sheet";

/**
 * Asks for location and camera access the friendly way: explain why first
 * ("soft ask"), and only then trigger the browser's own prompt. If access is
 * blocked, show how to turn it back on instead of failing silently.
 */

interface Permissions {
  /** Resolves with the user's position. Rejects with PermissionCancelledError if they back out. */
  requestLocation: () => Promise<LatLng>;
  /** Resolves with a photo, or null if they closed the camera. "unsupported" means use a file input instead. */
  takePhoto: () => Promise<Blob | null | "unsupported">;
}

const PermissionContext = createContext<Permissions | null>(null);

type Prompt = { kind: PermissionKind; mode: "ask" | "blocked" };

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  // Settles the promise of whoever is waiting on the open prompt.
  const pending = useRef<{ allow: () => void; cancel: () => void } | null>(null);
  const cameraResult = useRef<((b: Blob | null) => void) | null>(null);

  /** Show the soft ask (or blocked help) and wait for the user's choice. */
  const ask = useCallback(
    (kind: PermissionKind, mode: Prompt["mode"]) =>
      new Promise<void>((resolve, reject) => {
        pending.current = {
          allow: () => resolve(),
          cancel: () => reject(new PermissionCancelledError()),
        };
        setPrompt({ kind, mode });
      }),
    [],
  );

  const close = useCallback(() => {
    setPrompt(null);
    pending.current?.cancel();
    pending.current = null;
  }, []);

  const requestLocation = useCallback(async (): Promise<LatLng> => {
    const status = await permissionStatus("location");
    if (status === "unsupported") throw new Error("Location isn't available on this device");
    if (status === "denied") {
      await ask("location", "blocked");
      // "Try again" from the blocked screen: fall through and ask the browser.
    } else if (status === "prompt") {
      await ask("location", "ask");
    }
    try {
      return await getCurrentPosition();
    } catch (e) {
      if (e instanceof PermissionDeniedError) {
        await ask("location", "blocked");
        return getCurrentPosition();
      }
      throw e;
    }
  }, [ask]);

  const takePhoto = useCallback(async (): Promise<Blob | null | "unsupported"> => {
    const status = await permissionStatus("camera");
    if (status === "unsupported") return "unsupported";
    if (status === "denied") await ask("camera", "blocked");
    else if (status === "prompt") await ask("camera", "ask");
    return new Promise((resolve) => {
      cameraResult.current = resolve;
      setCameraOpen(true);
    });
  }, [ask]);

  const finishCamera = useCallback(
    (photo: Blob | null, denied = false) => {
      setCameraOpen(false);
      const done = cameraResult.current;
      cameraResult.current = null;
      if (!denied) return done?.(photo);
      // The browser blocked the camera: explain how to fix it, then reopen on "Try again".
      ask("camera", "blocked").then(
        () => {
          cameraResult.current = done;
          setCameraOpen(true);
        },
        () => done?.(null),
      );
    },
    [ask],
  );

  return (
    <PermissionContext.Provider value={{ requestLocation, takePhoto }}>
      {children}
      <Sheet open={!!prompt} onClose={close} title={prompt?.kind === "camera" ? "Camera access" : "Location access"}>
        {prompt && (
          <PermissionCard
            prompt={prompt}
            onAllow={() => {
              setPrompt(null);
              pending.current?.allow();
              pending.current = null;
            }}
            onCancel={close}
          />
        )}
      </Sheet>
      {cameraOpen && <CameraSheet onDone={finishCamera} />}
    </PermissionContext.Provider>
  );
}

export function usePermissions(): Permissions {
  const ctx = useContext(PermissionContext);
  if (!ctx) throw new Error("usePermissions must be used inside <PermissionProvider>");
  return ctx;
}

const COPY = {
  location: {
    emoji: "📍",
    title: "Can Sponty see where you are?",
    reasons: [
      ["🗺️", "Drop your pin right where you're standing"],
      ["🍜", "Find hidden gems around you"],
      ["🔒", "Only when you tap. Your profile keeps it rounded to about 1 km"],
    ],
    allow: "Allow location",
    blockedTitle: "Location is turned off",
  },
  camera: {
    emoji: "📸",
    title: "Snap your trip right here?",
    reasons: [
      ["✨", "Take photos without leaving Sponty"],
      ["🧭", "Hidden location data is removed from every photo"],
      ["🔒", "The camera is only on while this screen is open"],
    ],
    allow: "Allow camera",
    blockedTitle: "Camera is turned off",
  },
} as const;

function PermissionCard({ prompt, onAllow, onCancel }: { prompt: Prompt; onAllow: () => void; onCancel: () => void }) {
  const c = COPY[prompt.kind];
  const blocked = prompt.mode === "blocked";

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative mb-4 mt-1 flex h-24 w-24 items-center justify-center" aria-hidden="true">
        <span className="absolute inset-0 animate-ping rounded-full bg-mint-200/70 [animation-duration:2.4s]" />
        <span className="absolute inset-2 rounded-full bg-mint-100" />
        <span className="relative animate-[float_2.6s_ease-in-out_infinite] text-5xl">{blocked ? "🙈" : c.emoji}</span>
      </div>

      <h3 className="text-xl font-black">{blocked ? c.blockedTitle : c.title}</h3>

      {blocked ? (
        <div className="mt-3 w-full space-y-2 text-left text-sm">
          <p className="text-ink-soft">Your browser is blocking it. To turn it back on:</p>
          <ol className="list-decimal space-y-1.5 rounded-2xl bg-mint-50 py-3 pl-8 pr-3">
            <li>Tap the 🔒 or ⓘ icon next to the web address.</li>
            <li>
              Find <strong>{prompt.kind === "camera" ? "Camera" : "Location"}</strong> and choose <strong>Allow</strong>.
            </li>
            <li>Come back and tap Try again.</li>
          </ol>
          <p className="text-xs text-ink-soft">
            On iPhone, also check Settings → Privacy &amp; Security → {prompt.kind === "camera" ? "Camera" : "Location Services"}.
          </p>
        </div>
      ) : (
        <ul className="mt-4 w-full space-y-2 text-left">
          {c.reasons.map(([icon, text], i) => (
            <li
              key={text}
              className="flex animate-fade-up items-center gap-3 rounded-2xl bg-mint-50 px-3 py-2.5 text-sm"
              style={{ animationDelay: `${80 + i * 70}ms` }}
            >
              <span className="text-lg" aria-hidden="true">
                {icon}
              </span>
              {text}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 grid w-full gap-2">
        <button
          type="button"
          onClick={onAllow}
          className="press w-full rounded-2xl bg-mint-500 py-3 font-extrabold text-white shadow-md shadow-mint-500/30 hover:bg-mint-600"
        >
          {blocked ? "Try again" : c.allow}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="press w-full rounded-2xl border border-mint-200 py-3 font-bold text-ink hover:bg-mint-50"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
