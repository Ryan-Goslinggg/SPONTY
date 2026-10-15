import Link from "next/link";
import { SITE } from "@/lib/site";
import { BackIcon } from "./icons";

export const LEGAL_LINKS = [
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/refunds", label: "Refunds" },
  { href: "/about", label: "About" },
] as const;

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="animate-fade-in pb-32">
      <header className="sticky top-0 z-10 -mx-4 flex items-center gap-2 bg-mint-50/90 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
        <Link href="/" className="press rounded-full p-1.5 hover:bg-mint-100" aria-label="Back to Home">
          <BackIcon />
        </Link>
        <h1 className="text-2xl font-black tracking-tight">{title}</h1>
      </header>
      <p className="mb-4 text-xs font-semibold text-ink-soft">Last updated {SITE.legalUpdated}</p>
      <div className="legal rounded-[26px] bg-white p-5 shadow-sm">{children}</div>
      <LegalFooter />
    </article>
  );
}

export function LegalFooter() {
  return (
    <nav aria-label="Legal" className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs font-bold text-ink-soft">
      {LEGAL_LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="rounded underline-offset-2 hover:text-ink hover:underline">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
