"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { deleteMyData, downloadMyData } from "@/lib/privacy";
import { deleteAccountAction } from "@/lib/server/actions";

export function DataControls() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteEverything() {
    setBusy(true);
    setError(null);
    // Signed out means there's no account to delete; this device's data is still cleared.
    const { data: session } = await authClient.getSession();
    if (session) {
      const res = await deleteAccountAction();
      if (!res.ok) {
        setBusy(false);
        setError(res.error);
        return;
      }
    }
    deleteMyData();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={downloadMyData}
        className="press w-full rounded-2xl bg-mint-100 py-3 text-sm font-extrabold text-mint-700 hover:bg-mint-200"
      >
        Download my data
      </button>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="press w-full rounded-2xl border border-rose-200 py-3 text-sm font-extrabold text-rose-700 hover:bg-rose-50"
        >
          Delete my data
        </button>
      ) : (
        <div role="alertdialog" aria-labelledby="delete-title" className="animate-pop rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p id="delete-title" className="font-extrabold text-rose-800">
            Delete everything?
          </p>
          <p className="mt-1 text-sm text-rose-900">
            This permanently deletes your account, profile, photos, posts, messages, reviews, and friendships, and clears
            this device. It can&apos;t be undone.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              autoFocus
              onClick={() => setConfirming(false)}
              className="press rounded-xl bg-white py-2.5 text-sm font-bold text-ink"
            >
              Keep my data
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={deleteEverything}
              className="press rounded-xl bg-rose-700 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? "Deleting..." : "Delete"}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm font-semibold text-rose-800">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
