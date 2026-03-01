import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner"

import { LanguageProvider } from "@/lib/LanguageContext"
import { ThemeProvider } from "@/lib/ThemeContext"
import { TripProvider } from "@/lib/trip-context"
import { SplashScreen } from "@/components/ui/splash-screen"
import ChatWidget from "@/components/chat-widget"
import { SyncManager } from "@/components/sync-manager"
import { HtmlLangSync } from "@/components/ui/html-lang-sync"

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#fafaf9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content", // 🆕 Improves PWA keyboard handling
}

export const metadata: Metadata = {
  title: "Tabidachi - AI Travel Planner",
  description: "AI-powered travel planner with offline support, real-time collaboration, and smart itinerary generation.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tabidachi",
  },
  keywords: ["travel", "AI", "planner", "PWA", "offline", "itinerary"],
  authors: [{ name: "Ryan Su" }],
  openGraph: {
    title: "Tabidachi - AI Travel Planner",
    description: "Plan your trips with AI-powered itinerary generation, offline maps, and real-time collaboration.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider>
          <LanguageProvider>
            <HtmlLangSync />
            <TripProvider>
              <SplashScreen />
              <SyncManager />
              {children}
              <ChatWidget />
            </TripProvider>
          </LanguageProvider>
        </ThemeProvider>
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  );
}
