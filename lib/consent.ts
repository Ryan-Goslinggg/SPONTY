"use client";

import { createLocalStore } from "./localStore";

/**
 * The user's privacy and legal choices, kept on this device.
 * Separate from app data so every choice keeps its own timestamp.
 */
export interface Consent {
  /** When the user confirmed they meet the minimum age and accepted the Terms and Privacy Policy. */
  acceptedAt: number | null;
  /** Opt-in: send profile details to Claude for better friend suggestions. Off by default. */
  aiMatching: boolean;
  /** When the user said "no thanks" to the AI matching offer, so we don't ask again. */
  aiPromptDismissedAt: number | null;
  /** When the user dismissed the storage notice. */
  cookieNoticeAt: number | null;
}

const store = createLocalStore<Consent>("sponty:consent:v1", {
  acceptedAt: null,
  aiMatching: false,
  aiPromptDismissedAt: null,
  cookieNoticeAt: null,
});

export const updateConsent = store.update;
/** Returns null during server render, before the device's choices are known. */
export const useConsent = store.use;
