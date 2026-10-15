"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field } from "@/components/ProfileSheet";
import { authClient } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error } =
      mode === "sign-up"
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      setError(error.status === 429 ? "Too many attempts. Wait a minute and try again." : (error.message ?? "Something went wrong."));
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="animate-fade-up rounded-[26px] border border-mint-100 bg-white p-5 shadow-[0_4px_20px_rgb(31_58_43/0.06)]">
      <div className="relative mb-5 grid grid-cols-2 rounded-full bg-mint-50 p-1">
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-mint-500 transition-transform duration-500 ease-[var(--ease-bounce)]"
          style={{ transform: mode === "sign-up" ? "translateX(100%)" : "translateX(0)" }}
        />
        {(
          [
            ["sign-in", "Sign in"],
            ["sign-up", "Create account"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            aria-pressed={mode === m}
            className={`press relative z-10 rounded-full py-2 text-sm font-extrabold ${mode === m ? "text-white" : "text-ink-soft"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <form className="space-y-4" onSubmit={submit}>
        {mode === "sign-up" && (
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoComplete="name" aria-label="Name" className="input" />
          </Field>
        )}
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" aria-label="Email" className="input" />
        </Field>
        <Field label="Password" hint={mode === "sign-up" ? "At least 8 characters" : undefined}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            maxLength={128}
            aria-label="Password"
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            className="input"
          />
        </Field>
        {error && (
          <p role="alert" className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="press w-full rounded-2xl bg-mint-500 py-3 font-extrabold text-white shadow-md shadow-mint-500/30 hover:bg-mint-600 disabled:bg-mint-200 disabled:shadow-none"
        >
          {busy ? "One sec..." : mode === "sign-up" ? "Create account" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
