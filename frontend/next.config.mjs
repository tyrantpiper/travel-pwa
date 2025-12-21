/** @type {import('next').NextConfig} */
import withPWA from 'next-pwa';

const config = {
    reactStrictMode: true,
    // 👇 強制顯示開發指示器
    devIndicators: {
        appIsrStatus: true,
        buildActivity: true,
        buildActivityPosition: 'bottom-right',
    },
    // 👇 PWA 設定
    ...withPWA({
        dest: 'public', // Service Worker 輸出到 public 資料夾
        register: true, // 自動註冊
        skipWaiting: true, // 更新時自動接管
        disable: process.env.NODE_ENV === 'development', // 開發模式下不啟用 (避免快取太強導致開發困擾)
    }),
};

export default config;
