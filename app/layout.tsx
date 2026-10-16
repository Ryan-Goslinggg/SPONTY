import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { connection } from "next/server";
import { CookieNotice } from "@/components/CookieNotice";
import { PermissionProvider } from "@/components/PermissionProvider";
import { ToastProvider } from "@/components/Toast";
import { WelcomeGate } from "@/components/WelcomeGate";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", weight: ["400", "600", "700", "800", "900"] });

export const metadata: Metadata = {
  title: "Sponty",
  description: "Share spontaneous trips with friends and find hidden gems nearby.",
};

export const viewport: Viewport = {
  themeColor: "#f4faf6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Render every page per request: Next.js stamps the CSP nonce from proxy.ts
  // onto its scripts, which a page prerendered at build time can't carry.
  await connection();
  return (
    <html lang="en" className={nunito.variable}>
      <body className="min-h-dvh font-sans antialiased">
        <a
          href="#main"
          className="fixed left-4 top-4 z-[1200] -translate-y-24 rounded-full bg-ink px-4 py-2 text-sm font-bold text-white transition-transform focus:translate-y-0"
        >
          Skip to content
        </a>
        <ToastProvider>
          <WelcomeGate>
            <PermissionProvider>
              {children}
              <CookieNotice />
            </PermissionProvider>
          </WelcomeGate>
        </ToastProvider>
      </body>
    </html>
  );
}
