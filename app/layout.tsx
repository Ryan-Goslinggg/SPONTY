import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { ToastProvider } from "@/components/Toast";
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
        <ToastProvider>
          <StoreProvider>
            <main className="mx-auto min-h-dvh w-full max-w-md px-4">{children}</main>
            <BottomNav />
          </StoreProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
