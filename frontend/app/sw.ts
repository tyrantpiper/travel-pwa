/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { SerwistGlobalConfig } from "serwist";
import { Serwist, CacheFirst, NetworkFirst, NetworkOnly, ExpirationPlugin } from "serwist";

declare const self: ServiceWorkerGlobalScope & SerwistGlobalConfig;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // 🏝️ 本地地理編碼資料 (離線優先)
      matcher: /\/data\/.*\.json$/,
      handler: new CacheFirst({
        cacheName: "local-data",
        plugins: [
          new ExpirationPlugin({
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          }),
        ],
      }),
    },
    {
      // 🗺️ 地圖圖磚快取 (網路優先，離線備援)
      matcher: /^https:\/\/tiles\.openfreemap\.org\/.*/,
      handler: new NetworkFirst({
        cacheName: "map-tiles",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 500,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
          }),
        ],
      }),
    },
    {
      // 🛰️ 衛星圖層快取
      matcher: /^https:\/\/server\.arcgisonline\.com\/.*/,
      handler: new CacheFirst({
        cacheName: "satellite-tiles",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 14, // 14 days
          }),
        ],
      }),
    },
    {
      // 🔒 排除 Supabase 認證與高敏感 API (NetworkOnly)
      matcher: ({ url }) => {
        const isSupabaseAuth = url.hostname.includes("supabase.co") && url.pathname.includes("/auth/v1/");
        const isSensitiveApi = url.pathname.startsWith("/api/sign-cloudinary") || url.pathname.startsWith("/api/parse-receipt");
        return isSupabaseAuth || isSensitiveApi;
      },
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

// === Web Push Notification Handler (Ported from legacy sw.js) ===
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Tabidachi";
  const options = {
    body: data.body || "",
    icon: "/icon.png",
    badge: "/icon.png",
    tag: data.tag || "default",
    data: { link: data.link || "/" },
    vibrate: [100, 50, 100],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// === Notification Click Handler (Ported from legacy sw.js) ===
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          return (client as WindowClient).navigate(link);
        }
      }
      return self.clients.openWindow(link);
    })
  );
});
