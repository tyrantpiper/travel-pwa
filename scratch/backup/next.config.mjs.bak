import { fileURLToPath } from 'url';
import path from 'path';
import withPWA from '@ducanh2912/next-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    reactCompiler: true,      // 自動 Memoization
    turbopack: {
        root: __dirname,      // 物理座標鎖定
    },
    cacheComponents: true,       // 🚀 [2026 Stable] 開啟組件級緩存與局部預渲染 (PPR)
    experimental: {
        viewTransition: true,     // 原生頁面過場動畫 (2026 穩定版)
        optimizePackageImports: [
            "lucide-react",
            "maplibre-gl",
            "jspdf",
            "react-virtuoso",
            "@dnd-kit/core",
            "framer-motion",
            "sonner"
        ],
    },
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'res.cloudinary.com' },
            { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
            { protocol: 'https', hostname: 'lh5.googleusercontent.com' },
            { protocol: 'https', hostname: 'maps.googleapis.com' },
            { protocol: 'https', hostname: 'images.unsplash.com' },
            { protocol: 'https', hostname: 'plus.unsplash.com' },
            { protocol: 'https', hostname: 'flagcdn.com' },
        ],
    },
    // 👇 強制顯示開發指示器
    devIndicators: {
        appIsrStatus: true,
        buildActivity: true,
        buildActivityPosition: 'bottom-right',
    },
};

// 👇 PWA 設定 (使用 @ducanh2912/next-pwa)
const config = withPWA({
    dest: 'public', // Service Worker 輸出到 public 資料夾
    register: true, // 自動註冊
    skipWaiting: true, // 更新時自動接管
    disable: process.env.NODE_ENV === 'development', // 開發模式下不啟用
    // 🆕 Phase 2: 自定義快取規則
    runtimeCaching: [
        {
            // 🏝️ 本地地理編碼資料 (離線優先)
            urlPattern: /^\/data\/.*\.json$/,
            handler: 'CacheFirst',
            options: {
                cacheName: 'local-geocode-data',
                expiration: {
                    maxAgeSeconds: 60 * 60 * 24 * 30, // 30 天
                },
            },
        },
        {
            // 🗺️ 地圖圖磚快取 (網路優先，離線備援)
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/,
            handler: 'NetworkFirst',
            options: {
                cacheName: 'map-tiles',
                expiration: {
                    maxEntries: 200,
                    maxAgeSeconds: 60 * 60 * 24 * 7, // 7 天
                },
            },
        },
        {
            // 🛰️ 衛星圖層快取
            urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*/,
            handler: 'CacheFirst',
            options: {
                cacheName: 'satellite-tiles',
                expiration: {
                    maxEntries: 100,
                    maxAgeSeconds: 60 * 60 * 24 * 14, // 14 天
                },
            },
        },
    ],
})(nextConfig);

export default config;
