"use client";

/** Every key Sponty writes to browser storage starts with this prefix. */
const PREFIX = "sponty:";

function spontyKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  return keys;
}

/** Everything Sponty stores about the user on this device, as a downloadable JSON file. */
export function downloadMyData() {
  const data: Record<string, unknown> = { exportedAt: new Date().toISOString() };
  for (const k of spontyKeys()) {
    const raw = localStorage.getItem(k);
    try {
      data[k] = raw ? JSON.parse(raw) : null;
    } catch {
      data[k] = raw;
    }
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `sponty-data-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Erase every Sponty key on this device, including consent choices, then start fresh. */
export function deleteMyData() {
  for (const k of spontyKeys()) localStorage.removeItem(k);
  // A full reload (not client navigation) so no deleted data stays in memory.
  window.location.replace(window.location.origin);
}

/** Round coordinates to ~1km so a saved profile area can't pinpoint someone's home. */
export function coarsen(value: number): number {
  return Math.round(value * 100) / 100;
}
