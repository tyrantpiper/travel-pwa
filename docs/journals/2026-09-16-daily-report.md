# 📅 Daily Report - 2026-09-16

> **系統狀態**：🟢 Production Stable, P0 iOS WebKit PWA Offline Cold-Start Fully Conquered (Zero-Blank, Zero-Crash), Optimistic Sync Badges (E4), Smart Tab Focus (E5), Realtime Collaboration (E6), 170 Vitest + 43 Pytest Passed (100%), 0 Type Errors, 0 Lint Warnings  
> **今日關鍵提交**：
> - [`1a8f8e8`](https://github.com/tyrantpiper/travel-pwa/commit/1a8f8e8) `fix(pwa): eliminate precache 404 broken link and native safari offline error`
> - [`e93e908`](https://github.com/tyrantpiper/travel-pwa/commit/e93e908) `fix(pwa): resolve ios cold-start blank screen with L0 mirror`
> - [`345d926`](https://github.com/tyrantpiper/travel-pwa/commit/345d926) `fix(pwa): precache root document and enforce global sw registration for offline instant reload`
> - [`32a7340`](https://github.com/tyrantpiper/travel-pwa/commit/32a7340) `fix(pwa): shift service worker to build-time static pre-bundle for vercel cdn delivery`
> - [`64f4c7b`](https://github.com/tyrantpiper/travel-pwa/commit/64f4c7b) `feat(pwa): harden offline cold-start, add optimistic sync badges, smart tab focus, and realtime collaboration`
> - [`9b0a372`](https://github.com/tyrantpiper/travel-pwa/commit/9b0a372) `fix(weather): resolve overview weather cold-start freeze and add request deduplication`

---

## 🟢 1. Features & Fixes (今日交付價值與重大歷史突破)

### 1.1 🏆 史詩級突破：iOS WebKit PWA 離線冷啟動徹底攻克 (Offline Instant Boot Mastered)
在 iPhone WebClip / Standalone PWA 環境下，歷經「死白屏」➔「Safari無法打開網頁」的深水區排查，完成閉環修復並於實機驗收通過：
1. **Precache 動態 Chunk 解耦 (`globPatterns: ["public/**/*"]`)**：
   - 徹底排查出斷網「無法打開網頁」真兇：舊版 Precache 包含本地隨機 Hash 的動態 chunks，推至 Vercel 後遠端生成全新 Hash，手機安裝時請求本地 Hash 遭遇 **HTTP 404**。
   - 依據 W3C 規範：**只要 Precache 有 1 項 404，整個 Service Worker 在 install 階段立刻強制銷毀**！
   - 解法：在 `frontend/scripts/build-sw.mjs` 中以 `globPatterns: ["public/**/*"]` 徹底剔除 `.next/static`，僅快取 29 個穩固資產與根 App Shell `/`，Precache 成功率 100%。
2. **動態 JS Chunks 轉交 Runtime Cache (`CacheFirst`)**：
   - Next.js 動態 chunks 轉由 `sw.ts` 的 `runtimeCaching` 以 `CacheFirst` 接管（`maxEntries: 128, maxAgeSeconds: 30 days`），由手機於首次訪問時以真實線上 URL 動態下載並持久化，根絕本地/雲端 Hash 衝突。
3. **Zero-JS 物理硬骨架保底 (消滅 `Response.error()`)**：
   - 舊版 `sw.ts` 的 `handlerDidError` 遇快取落空時拋出 `Response.error()`，向 WebKit 舉白旗觸發 Safari 原生「無法打開網頁」系統報錯。
   - 重構為回傳 500 bytes 內嵌純 HTML/CSS 骨架屏，絕不回傳錯誤，消滅 iOS WebKit 原生中斷彈窗。
4. **切斷 WebKit HTTP 快取毒丸 (`updateViaCache: "none"`)**：
   - 在 `service-worker-register.tsx` 註冊時加入 `{ updateViaCache: "none" }`，強制 iOS Safari 每次檢查更新均直連伺服器，舊版壞死 SW 不再殘留。
5. **實機真實驗收結果**：
   - iPhone 關閉網路、開啟飛航模式、背景滑掉殺進程後冷開機，App Shell 順暢秒開，不再有任何白屏與報錯！

### 1.2 P0 離線冷啟動快取防禦與自癒強化
1. **Service Worker 導航快取忽略參數 (`ignoreSearch: true`)**：
   - 在 `frontend/app/sw.ts` 為 `app-shell-navigation` 宣告 `matchOptions: { ignoreSearch: true }`，確保帶參冷啟動 100% 命中核心快取；導航逾時緊縮至 2s。
2. **行程上下文斷網防自我抹殺雙守衛 (`isDefinitelyOnline && !isError`)**：
   - 守衛 `trip-context.tsx`：只有在確實在線且 API 無錯誤時才允許清空當前行程；斷網時死守本機現有行程與 LocalStorage。
3. **SWR Proxy 防抖自動持久化儲存 (L2 IndexedDB Sync)**：
   - 以 ES6 Proxy 攔截 SWR 成功寫入操作，1500ms 防抖自動序列化持久化至 IndexedDB `tabidachi_swr_persisted_cache`，冷啟動重啟秒出。

### 1.3 E4 離線突變樂觀 UI 狀態提示 (Optimistic Mutation Badges)
1. **Zustand 全域離線同步狀態機 (`syncStatusStore.ts`)**：追蹤突變四態（`pending`, `syncing`, `synced`, `failed`）。
2. **微型狀態徽章與全域膠囊 (`SyncStatusBadge.tsx` & `SyncStatusCapsule.tsx`)**：景點卡片、費用記帳卡片與頂部導航膠囊即時視覺反饋。

### 1.4 E5 Service Worker 點擊智慧聚焦既有分頁 (Smart Tab Focus & Smooth Navigation)
1. **既有 Client 喚醒與內部廣播 (`sw.ts`)**：以 `client.focus()` 喚醒既有分頁，並透過 postMessage 內部廣播事件。
2. **平滑無刷新路由切換 (`useDeepLinkRouter.ts`)**：無重載切換視圖與行程天數，保留使用者滾動位置與編輯狀態。

### 1.5 E6 Supabase Realtime 跨裝置即時協同 (Multi-Device Collaboration)
1. **PostgreSQL CDC 即時訂閱 (`useTripRealtime.ts`)**：WebSocket 訂閱 `itineraries` 與 `expenses` 表異動，300ms 內靜默調用 SWR mutate 無感同步。

### 1.6 總覽天氣首次進入顯示修復與 In-Flight 去重 (Overview Weather Freeze Fix)
1. **生命週期與請求解耦 (`weatherStore.ts`)**：`inFlightFiveDayRequests` Promise 記憶體池同座標去重，全域 Zustand store 保證回寫。
2. **座標指紋與本地時區安全 (`TripMasterOverview.tsx`)**：`clusterFingerprint` 依賴防重複，`toLocaleDateString('en-CA')` 防跨日時區漂移。
3. **4 秒逾時優雅降級 (`DailyWeatherStrip.tsx`)**：逾時切換「暫無氣象資料 · 重試」狀態，支援手動刷新。

---

## 🏛️ 2. Architecture Decisions (今日架構決策)

1. **[AD-2026-09-16-01] Precache 動靜態資產解耦原則 (Precache Dynamic Chunk Decoupling)**：
   - 現代全端 SSR/ISR 框架（Next.js）的動態 Chunks 每次構建皆帶隨機 Hash。**嚴禁將動態 JS Chunks 放入 Service Worker 的 install Precache 清單**。
   - Precache 僅保留 `public/` 穩固資產與根 App Shell `/`；動態 JS/CSS Chunks 100% 交給 `runtimeCaching` 的 `CacheFirst`，在瀏覽器首次請求真實 URL 時動態緩存。
2. **[AD-2026-09-16-02] Service Worker 絕不向瀏覽器舉白旗 (Zero-Response.error Invariance)**：
   - 在 Navigation Fallback 策略中，`handlerDidError` 絕對禁止回傳 `Response.error()`。必須提供內聯 Zero-JS 物理 HTML/CSS 骨架，根絕 WebKit 彈出原生斷網報錯。
3. **[AD-2026-09-16-03] WebKit Service Worker 註冊快取隔離 (`updateViaCache: "none"`)**：
   - 所有現代 PWA 註冊必須顯式指定 `{ updateViaCache: "none" }`，切斷瀏覽器內部 HTTP 緩存對 `sw.js` 檔案的干擾，確保版本迭代即時生效。
4. **[AD-2026-09-16-04] 外部網路請求必須與 React 組件生命週期解耦 (Decoupled Global Write)**：
   - 非同步長耗時請求嚴禁在組件內部 state 與 `isMounted` 閉包中回寫，必須由獨立模組寫入全域狀態機，組件僅以 selector 訂閱。
5. **[AD-2026-09-16-05] PWA App-Shell 導航必須開啟 `ignoreSearch: true`**：
   - Standalone PWA 帶參冷啟動常態，`ignoreSearch: true` 緊縮導航逾時至 2s，為離線第一道防線。

---

## 🔴 3. Technical Debt (技術債與後續追蹤)

1. **離線照片二進位暫存隊列 (Offline Photo Blob Persistence)**：
   - 目前離線隊列對 `FormData` 採取跳過並彈出 Toast 提示。後續規劃將照片轉為 IndexedDB Blob 本機排程隊列，連網時自動重播。
2. **氣象 API 伺服器端邊緣快取 (Open-Meteo Edge Cache)**：
   - 未來在 FastAPI 後端透過 Redis 實作城市級反向代理快取，降低對外部第三方 API 依賴。

---

## 🛡️ 4. Failed Paths (今日踩坑紀錄與排錯經驗)

1. **Precache 動態 Chunk 導致 Service Worker 物理銷毀 (`Precache 404 Poison Pill Trap`)**：
   - 本地編譯生成帶 Hash 的 `sw.js`（含 56 個本地 chunk hash），推送到 Vercel 後雲端 Hash 改變。手機安裝 SW 時請求本地 Hash 回傳 404，觸發 W3C 規範直接銷毀 SW。
   - **教訓**：Precache 清單必須永遠保持 100% 命中率，脆弱的動態編譯產物絕不可放入 Precache。
2. **`Response.error()` 引發 WebKit 原生報錯彈窗 (`Response.error Safari Crash Trap`)**：
   - 當多層快取落空時直接 `return Response.error()`，WebKit 將其視為致命連線失敗，向使用者彈出「Safari無法打開網頁，因為你 iPhone尚未連接網際網路。」
   - **教訓**：PWA 的最底層防線必須是合法的 200 HTML 實體，絕不能向瀏覽器拋出硬錯誤。
3. **WebKit 頑固 HTTP 快取阻礙 SW 更新 (`WebKit sw.js Cache Retention Trap`)**：
   - 未設定 `updateViaCache: "none"`，iOS 常常連續數天使用舊的 Service Worker 檔案，導致新部署的修正無法觸達使用者。
   - **教訓**：`navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })` 是 iOS PWA 的標配。
4. **React 19 / React Compiler 的 `react-hooks/set-state-in-effect` 嚴格規則**：
   - `DailyWeatherStrip.tsx` 的 `useEffect` 內若同步調用 `setIsTimedOut(false)` 引發 cascading renders 報錯。
   - **解法**：改用衍生狀態，`useEffect` 僅負責非同步排程。

---

## 🚀 5. Next Steps (後續行動)

1. **離線全情境長效穩定度監控**：持續觀察 iOS WebClip 長時間處於背景（超過 24 小時）喚醒後的 SW 存活率。
2. **收據相片離線暫存架構規劃**：啟動離線 FormData Blob 儲存規格設計，打通記帳拍照離線全流程。
3. **架構演進清單同步更新**：同步更新 `architecture-evolution-backlog-spec.md`，將 PWA 離線冷啟動標記為完全解決。
