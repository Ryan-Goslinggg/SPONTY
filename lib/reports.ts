"use client";

import { createLocalStore } from "./localStore";

/**
 * Reviews this user reported as fake or abusive. Reported reviews are hidden
 * for the reporter right away. Once there is a server, reports should also go
 * to a moderation queue there.
 */
const store = createLocalStore<{ reviewIds: string[] }>("sponty:reports:v1", { reviewIds: [] });

export function reportReview(id: string) {
  const current = store.get().reviewIds;
  if (!current.includes(id)) store.update({ reviewIds: [...current, id] });
}

export function useReportedReviewIds(): string[] {
  return store.use()?.reviewIds ?? [];
}
