/** @type {import('next').NextConfig} */
import withPWA from '@ducanh2912/next-pwa';

const nextConfig = {
    reactStrictMode: true,
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
})(nextConfig);

export default config;
