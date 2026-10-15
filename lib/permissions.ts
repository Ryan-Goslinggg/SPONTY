"use client";

export type PermissionKind = "location" | "camera";
export type PermissionStatus = "granted" | "denied" | "prompt" | "unsupported";

const API_NAME: Record<PermissionKind, string> = { location: "geolocation", camera: "camera" };

/**
 * What the browser will do if we ask now. Some browsers (older Safari, Firefox
 * for camera) can't report this, so "prompt" is the safe default there.
 */
export async function permissionStatus(kind: PermissionKind): Promise<PermissionStatus> {
  if (kind === "location" && !("geolocation" in navigator)) return "unsupported";
  if (kind === "camera" && !navigator.mediaDevices?.getUserMedia) return "unsupported";
  try {
    const result = await navigator.permissions.query({ name: API_NAME[kind] as PermissionName });
    return result.state;
  } catch {
    return "prompt";
  }
}

/** Thrown when the user closes a permission prompt without allowing it. */
export class PermissionCancelledError extends Error {
  constructor() {
    super("Permission request was cancelled");
    this.name = "PermissionCancelledError";
  }
}

export const isCancelled = (e: unknown) => e instanceof PermissionCancelledError;
