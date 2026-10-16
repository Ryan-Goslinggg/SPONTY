"use client";

import { useSyncExternalStore } from "react";

/**
 * A tiny reactive value persisted in localStorage under one key.
 * Components read it with `use()`, which returns null during server render.
 */
export function createLocalStore<T extends object>(key: string, initial: T) {
  const listeners = new Set<() => void>();
  let cache: T | null = null;

  function get(): T {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(key);
      cache = raw ? ({ ...initial, ...(JSON.parse(raw) as Partial<T>) } as T) : initial;
    } catch {
      cache = initial;
    }
    return cache;
  }

  function update(patch: Partial<T>) {
    cache = { ...get(), ...patch };
    try {
      localStorage.setItem(key, JSON.stringify(cache));
    } catch {
      // Storage unavailable: the value still applies for this visit.
    }
    listeners.forEach((l) => l());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) {
        cache = null;
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  function use(): T | null {
    return useSyncExternalStore<T | null>(subscribe, get, () => null);
  }

  return { get, update, use };
}
