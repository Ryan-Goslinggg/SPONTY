"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatIcon, CompassIcon, HomeIcon } from "./icons";

const TABS = [
  { href: "/chat", label: "Chat", Icon: ChatIcon },
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/find", label: "Find", Icon: CompassIcon },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function BottomNav() {
  const pathname = usePathname();
  // Hide inside a conversation so the message box can sit at the bottom.
  if (/^\/chat\/.+/.test(pathname)) return null;

  const activeIndex = TABS.findIndex((t) => isActive(pathname, t.href));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[900] flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      aria-label="Main"
    >
      <div className="relative grid w-full max-w-sm grid-cols-3 rounded-full border border-mint-200 bg-white/90 p-1.5 shadow-[0_8px_30px_rgb(31_58_43/0.12)] backdrop-blur">
        {activeIndex >= 0 && (
          <span
            className="absolute inset-y-1.5 left-1.5 rounded-full bg-mint-500 transition-transform duration-500 ease-[var(--ease-bounce)]"
            style={{ width: "calc((100% - 0.75rem) / 3)", transform: `translateX(${activeIndex * 100}%)` }}
            aria-hidden="true"
          />
        )}
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`press relative z-10 flex items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-bold ${active ? "text-white" : "text-ink-soft hover:text-mint-700"}`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
