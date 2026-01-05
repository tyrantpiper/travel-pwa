/** @type {import('next').NextConfig} */
const nextConfig = {
    /* 原有配置保持不變 */

    // 🚀 Phase 3: React Compiler (自動 memo 優化)
    experimental: {
        reactCompiler: true,
    },
};

module.exports = nextConfig;
