import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner"

import { LanguageProvider } from "@/lib/LanguageContext"
import { ThemeProvider } from "@/lib/ThemeContext"
import { TripProvider } from "@/lib/trip-context"
import { SplashScreen } from "@/components/ui/splash-screen"
import { SyncManager } from "@/components/sync-manager"
import { HtmlLangSync } from "@/components/ui/html-lang-sync"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { AppClientLayer } from "@/components/app-client-layer"

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#fafaf9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // 🆕 Enables env(safe-area-inset-*) for notch/home-bar devices
  interactiveWidget: "resizes-content", // 🆕 Improves PWA keyboard handling
}

export const metadata: Metadata = {
  title: "Tabidachi | Generative AI Travel Companion",
  description: "Next-generation travel orchestrator powered by Generative AI. Features real-time multi-user collaboration, offline-first maps, and intelligent itinerary synthesis.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tabidachi",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icon.png",
  },
  keywords: ["Generative AI", "Travel AI", "PWA", "Offline Maps", "Itinerary Planner", "AI Agent", "Innovation", "Travel Tech"],
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
        {/* 🚀 Global PWA Install Event Trap (Pre-Hydration) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.promptEvent = null;
              window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                window.promptEvent = e;
              });
            `
          }}
        />
        <ThemeProvider>
          <LanguageProvider>
            <HtmlLangSync />
            <TripProvider>
              <SplashScreen />
              <SyncManager />
              <Suspense fallback={null}>
                {children}
              </Suspense>
              <AppClientLayer />
              <PWAInstallPrompt />
            </TripProvider>
          </LanguageProvider>
        </ThemeProvider>
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  );
}
