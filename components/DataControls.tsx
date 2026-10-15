"use client";

import { useState } from "react";
import { deleteMyData, downloadMyData } from "@/lib/privacy";

export function DataControls() {
  const [confirming, setConfirming] = useState(false);

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
            This permanently erases your profile, posts, messages, reviews, and choices from this device. It can&apos;t be
            undone.
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
            <button type="button" onClick={deleteMyData} className="press rounded-xl bg-rose-700 py-2.5 text-sm font-bold text-white">
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
