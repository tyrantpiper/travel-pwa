# 📅 Daily Report - 2026-09-10

> **系統狀態**：🟢 Production Stable & Offline-First Hardened (`Serwist BackgroundSync`, `IdbSwrProvider`, All 127 Tests Passed, 0 Type Errors, 0 Lint Warnings)  
> **今日關鍵提交**：
> - [`c61ec47`](https://github.com/tyrantpiper/travel-pwa/commit/c61ec47) `feat(pwa): implement offline-first instant boot and background mutation sync`

---

## 🟢 1. Features & Fixes (今日交付價值)

1. **離線優先與微秒級秒開全景架構實裝 (Offline-First & Instant Boot)**：
   - 建立並落地 `docs/specs/offline-first-instant-boot-spec.md` 規格文件，並於 Google NotebookLM 建立專屬研究筆記本（UUID: `df7b08bd-66d2-48f0-9cac-eabeeba57869`），沉澱 8 篇高密度架構調研。
   - 建立 `frontend/lib/idb-swr-provider.tsx`，透過同步記憶體 `Map` 接管全域 SWR，保障 React 19 首幀 0ms 零骨架屏秒開；自動呼叫 `navigator.storage.persist()` 守護 Safari 7 天免清除權限。
   - 在 `frontend/app/layout.tsx` 中將 `<IdbSwrProvider>` 注入 Provider 樹外層，全數保留原先 11 個層級組件與自癒管線，無侵入式升級。
2. **行程清單同步快取與秒開 (Trips List 0ms Snapshot)**：
   - 擴充 `frontend/lib/idb-storage.ts` 新增 `getTripsListSnapshotSync` 與 `saveTripsListSnapshot`，保留既有 4 層自癒清除閉環。
   - 更新 `frontend/lib/hooks.ts` 的 `useTrips` 注入 `fallbackData` 與 `onSuccess` 儲存，達成清單頁面斷網秒開。
3. **背景突變同步佇列 (Serwist BackgroundSync Integration)**：
   - 於 `frontend/app/sw.ts` 整合 W3C 標準 `BackgroundSyncPlugin("tabidachi-offline-mutations")`，行程與費用相關之離線寫入（POST / PUT / PATCH / DELETE）失敗時自動排入 IndexedDB 佇列，最長保留 24 小時，網路恢復時依序自動重送。
4. **外部景點圖片 300 張全量解鎖與 App Shell 導航降級**：
   - 依據使用者體驗優先方針，解鎖外部景點圖片快取上限至 300 張（約 30MB），完整支援 Next.js `/_next/image` 與 CDN（Cloudflare Worker 代理、Cloudinary、Unsplash、Google 等），徹底杜絕離線破圖。
   - 實作地圖樣式、字型與雪碧圖（`map-styles-and-assets`）30 天長效快取。
   - 配置 App Shell 導航降級（3 秒超時回退本地快取 Shell），並以 `!url.searchParams.has("_rsc")` 與 `!url.pathname.startsWith("/api/")` 杜絕 React Server Components 二進位資料水合撕裂。
5. **品質守門與測試套件擴充**：
   - 於 `frontend/__tests__/instant-boot-storage.test.ts` 新增 TC-6 驗證清單同步直出與 L2 持久化。
   - 靜態型別 (`tsc`) 0 錯誤、ESLint 0 警告、Vitest 16/16 測試檔 127/127 測試全數通過、Next.js 16 Turbopack 生產編譯零錯誤完成。

---

## 🏛️ 2. Architecture Decisions (架構級決策)

- **站在既有巨人肩膀上的輕量化原則 (Shoulder-of-Giants Lightweight Architecture)**：
  堅決拒絕盲目引入 PowerSync 或 RxDB 等肥大客戶端複寫引擎（節省 ~200KB bundle 與複雜 schema 遷移風險），完全立足於專案既有的 `serwist`、`idb-keyval` 與 `SWRConfig provider` 官方標準模式，以極小代碼增量完成離線優先秒開閉環。
- **以體驗為先解鎖圖片快取容量 (Experience-First Media Cache Unlocking)**：
  遵循使用者明確指示「不需要在乎國外漫遊流量」，將外部景點圖片上限擴充至 300 張（約 30MB），保障出國離線重度使用體驗，並透過 Cloudflare Worker 反向代理注入 `Access-Control-Allow-Origin: *`，防止 Safari 7~10MB Opaque 填充配額爆炸。
- **動脈與靜脈讀寫分流架構 (Arterial/Venous Read-Write Decoupling)**：
  在 Service Worker 層將 GET 查詢（SWR 快取）與 POST/PUT/PATCH/DELETE 突變（BackgroundSync 離線重試）物理隔離，杜絕突變請求被快取誤吞或 GET 查詢誤進背景佇列。
- **React 19 RSC 水合防衛鐵律 (Hydration-Safe App Shell Fallback)**：
  導航快取 Matcher 嚴格排除 `_rsc` 二進位參數與 `/api/` 路由，防止 Service Worker 將 HTML App Shell 誤回給 RSC 串流導致客戶端發生致命水合撕裂。

---

## 🔴 3. Technical Debt (技術債務追蹤)

- **BackgroundSync iOS Safari 降級機制強化**: iOS Safari 原生不支援 W3C Background Sync API，目前依賴 Service Worker 重新啟動與連線 fetch 事件被動觸發。後續可評估在 `SyncManager` 前端組件中監聽 `window.addEventListener('online')` 作為雙重主動觸發保險。
- **離線突變樂觀 UI 狀態提示 (Optimistic UI Badge)**: 當使用者於離線狀態新增費用或筆記時，可於 UI 卡片旁標註「等待連線同步中...」的微章，提升使用者心理安全感。
- **Dependabot 漏洞修補**: Default branch 存在 1 個 Critical 與 1 個 Moderate 安全漏洞，需排程依賴升級。

---

## 🛡️ 4. Failed Paths (踩坑與失敗教訓)

- **直接將未過濾的 SWR 快取 Map 序列化至 IndexedDB 的複製陷阱 (`DataCloneError Trap`)**：
  SWR 內部的 cacheMap 包含未決的 Promise、變異調度器與閉包函式，若未經過濾直接對其執行 IndexedDB `set()` 會觸發瀏覽器 `DataCloneError: could not clone` 致命崩潰。**教訓**：SWR 持久化必須將資料層（Data Snapshot）與排程/Promise 狀態解耦，由 `idb-storage.ts` 定向寫入純乾淨的 JSON 快照。
- **忽略 Next.js `/_next/image` 轉址路徑引發的圖片快取未命中 (`Next.js Image Proxy Bypass Trap`)**：
  初版圖片快取僅針對外部 CDN host (如 cloudinary.com)，但 Next.js `<Image />` 組件會將圖片重寫為本地 `/_next/image?url=...` 路由。**教訓**：圖片快取 Matcher 必須將 `/_next/image` 與外部 CDN 列為聯集比對。

---

## 🎯 5. Next Steps (後續規劃)

1. 本地實機以手機連線測試 PWA 飛航模式下的離線突變與連線自動補送功能。
2. 評估在費用與筆記卡片上實作離線待同步徽章 (Optimistic UI Badge)。
3. 排程處理 GitHub Dependabot 回報之相依性安全修補。
