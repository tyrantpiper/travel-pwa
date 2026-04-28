import { fileURLToPath } from 'url';
import path from 'path';
import { withSerwist } from '@serwist/turbopack';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    reactCompiler: true,      // 自動 Memoization
    outputFileTracingRoot: __dirname, // 與 turbopack.root 統一，消除 Vercel 警告
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

export default withSerwist(nextConfig);
