import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/auth";
import { AuthForm } from "./AuthForm";

export const metadata: Metadata = { title: "Sign in - Sponty" };

export default async function SignInPage() {
  if (await getSessionUser()) redirect("/");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 animate-fade-in text-center">
        <h1 className="animate-pop text-4xl font-black tracking-tight text-mint-500">sponty</h1>
        <p className="mt-1 text-sm font-semibold text-ink-soft">Trips only. No doomscrolling.</p>
      </div>
      <AuthForm />
    </main>
  );
}
