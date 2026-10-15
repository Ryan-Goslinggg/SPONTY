import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { CookieNotice } from "@/components/CookieNotice";
import { PermissionProvider } from "@/components/PermissionProvider";
import { ToastProvider } from "@/components/Toast";
import { WelcomeGate } from "@/components/WelcomeGate";
import { StoreProvider } from "@/lib/store";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
            <StoreProvider>
              <PermissionProvider>
                <main id="main" className="mx-auto min-h-dvh w-full max-w-md px-4">
                  {children}
                </main>
                <BottomNav />
                <CookieNotice />
              </PermissionProvider>
            </StoreProvider>
          </WelcomeGate>
        </ToastProvider>
      </body>
    </html>
  );
}
