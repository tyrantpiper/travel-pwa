# 📅 Daily Report - 2026-09-16

> **系統狀態**：🟢 Production Stable, P0 Offline Cold-Start Hardened, Optimistic Sync Badges (E4), Smart Tab Focus (E5), Supabase Realtime Collaboration (E6), Overview Weather Zero-Freeze Fixed, 162 Vitest + 43 Pytest Passed (100%), 0 Type Errors, 0 Lint Warnings  
> **今日關鍵提交**：
> - [`64f4c7b`](https://github.com/tyrantpiper/travel-pwa/commit/64f4c7b) `feat(pwa): harden offline cold-start, add optimistic sync badges, smart tab focus, and realtime collaboration`
> - [`9b0a372`](https://github.com/tyrantpiper/travel-pwa/commit/9b0a372) `fix(weather): resolve overview weather cold-start freeze and add request deduplication`
> - [`54e6470`](https://github.com/tyrantpiper/travel-pwa/commit/54e6470) `docs(specs): add overview weather cold-start spec and update agent memory`

---

## 🟢 1. Features & Fixes (今日交付價值)

### 1.1 P0 離線冷啟動修復 (Offline Cold-Start Zero-Failure)
1. **Service Worker 導航快取忽略參數 (`ignoreSearch: true`)**：
   - 手機安裝 PWA 後，點擊桌面圖示啟動時常攜帶 `/?source=pwa` 或系統查詢參數。舊版 Service Worker 因嚴格字串比對失敗直接判定斷網拋出小恐龍。
   - 在 `frontend/app/sw.ts` 為 `app-shell-navigation` 宣告 `matchOptions: { ignoreSearch: true }`，確保帶參冷啟動 100% 命中核心快取；導航逾時由 3s 緊縮至 2s。
2. **行程上下文斷網防自我抹殺雙守衛 (`isDefinitelyOnline && !isError`)**：
   - 舊版 `trip-context.tsx:188` 在斷網冷啟動時，因 SWR 請求 `/api/trips` 失敗回退為空陣列，錯誤判定使用者名下無行程，調用 `setActiveTripId(null)` 並抹除 `localStorage`，導致 App 進入死白屏。
   - 增加嚴格守衛：只有在確實在線且 API 無錯誤時，才允許清空當前行程；斷網時死守本機現有行程。
3. **SWR Proxy 防抖自動持久化儲存 (L2 IndexedDB Sync)**：
   - 舊版 `idb-swr-provider.tsx` 只有讀取邏輯但無回寫邏輯，導致快取無法存入硬碟。
   - 重構為工廠模式 `createPersistedCacheMap()`，以 ES6 Proxy 攔截 SWR 成功寫入操作，1500ms 防抖自動序列化持久化至 IndexedDB `tabidachi_swr_persisted_cache`，冷啟動重啟秒出。

### 1.2 E4 離線突變樂觀 UI 狀態提示 (Optimistic Mutation Badges)
1. **Zustand 全域離線同步狀態機 (`syncStatusStore.ts`)**：
   - 建立狀態機追蹤突變四態：`pending`（琥珀色微光脈衝）、`syncing`（藍色旋轉）、`synced`（綠色打勾，2.5s 淡出）、`failed`（紅色驚嘆號手動重試）。
2. **微型狀態徽章與全域膠囊 (`SyncStatusBadge.tsx` & `SyncStatusCapsule.tsx`)**：
   - 在行程景點卡片（`timeline-card.tsx`）與費用記帳卡片（`tools-view.tsx`）掛載微型徽章，離線編輯一目了然。
   - 頂部導航列掛載動態膠囊，隨時顯示「☁️ 離線暫存 (N)」，點擊即時手動重試同步。

### 1.3 E5 Service Worker 點擊智慧聚焦既有分頁 (Smart Tab Focus & Smooth Navigation)
1. **既有 Client 喚醒與內部廣播 (`sw.ts`)**：
   - 推播點擊由暴力 `client.navigate()` 重載，升級為 `client.focus()` 喚醒分頁，並透過 `client.postMessage({ type: "TABIDACHI_PUSH_NAVIGATE", url })` 發布內部事件。
2. **平滑無刷新路由切換 (`useDeepLinkRouter.ts`)**：
   - 前端接收 SW 訊息後平滑切換視圖與行程日期，保留使用者當前滾動位置與編輯狀態，不打斷操作。

### 1.4 E6 Supabase Realtime 跨裝置即時協同 (Multi-Device Collaboration)
1. **PostgreSQL CDC 即時訂閱 (`useTripRealtime.ts`)**：
   - 前端透過 Supabase Realtime WebSocket 通道訂閱 `itineraries` 與 `expenses` 資料表異動。
   - 收到變更後 300ms 內自動靜默調用 SWR `mutate(..., { revalidate: true })`，同行程多人/跨裝置編輯零延遲無感同步。

### 1.5 總覽天氣首次進入顯示修復與 In-Flight 去重 (Overview Weather Cold-Start Freeze Fix)
1. **生命週期與請求解耦 (`weatherStore.ts`)**：
   - 實作 `fetchFiveDayForecastWithDedup(lat, lng, todayStr)`，內建 `inFlightFiveDayRequests` Promise 記憶體池，多卡片同座標去重。
   - 請求成功保證寫入全域 Zustand store，徹底擺脫原組件因父層 SWR 抖動觸發 `isMounted = false` 丟棄天氣資料之核心缺陷。
2. **響應式快取綁定與座標指紋 (`TripMasterOverview.tsx`)**：
   - 頂層直接綁定 `const fiveDayCache = useWeatherStore((s) => s.fiveDayCache)`，廢除脆弱的局部 state。
   - 採用座標字串指紋 `clusterFingerprint` 作為 Effect 依賴，杜絕重複觸發。
   - 本地時區安全鍵 `new Date().toLocaleDateString('en-CA')`，防禦深夜 0~8 點 UTC 跨日時區漂移。
3. **4 秒逾時優雅降級 (`DailyWeatherStrip.tsx`)**：
   - 逾時自動停止骨架屏閃爍，平滑轉換為「暫無氣象資料 · 重試」狀態，支援一鍵手動重新整理。

---

## 🏛️ 2. Architecture Decisions (今日架構決策)

1. **[AD-2026-09-16-01] 外部網路請求必須與 React 組件生命週期解耦 (Decoupled Global Write)**：
   - 在 React 19 與頻繁重繪的 App 架構下，非同步長耗時請求（如 Open-Meteo API）嚴禁在組件內部 state 與 `isMounted` 閉包中回寫；必須由獨立模組寫入全域狀態機，組件僅在渲染階段以 selector 讀取，防止「資料已回傳但畫面作廢」。
2. **[AD-2026-09-16-02] PWA App-Shell 導航必須開啟 `ignoreSearch: true`**：
   - 桌面 Standalone PWA 啟動帶參是常態，若 Service Worker 採嚴格 URL 比對會直接造成斷網白屏。`ignoreSearch: true` 是離線體驗的第一道絕對防線。
3. **[AD-2026-09-16-03] 離線狀態下行程清單的不可抹除性 (Offline Trip Non-Destructive Invariance)**：
   - 斷網或 API 異常時 SWR 回傳的空陣列不可作為「使用者無行程」之業務假設，系統必須嚴格捍衛本機現存 ID 與 LocalStorage。

---

## 🔴 3. Technical Debt (技術債與後續追蹤)

1. **離線照片二進位暫存隊列 (Offline Photo Blob Persistence)**：
   - 目前離線隊列對 `FormData`（如現場收據拍照上傳）採取跳過並彈出 Toast 提示的保守策略。未來需支援將照片轉為 IndexedDB Blob 本機排程隊列，待連網時自動重播二進位上傳。
2. **氣象 API 伺服器端邊緣快取 (Open-Meteo Edge Cache)**：
   - 目前客戶端直連 Open-Meteo。未來使用者量增長時，應在 FastAPI 後端透過 Redis 實作城市級反向代理快取，減少對第三方服務的依賴。

---

## 🛡️ 4. Failed Paths (今日踩坑紀錄與排錯經驗)

1. **React 19 / React Compiler 的 `react-hooks/set-state-in-effect` 嚴格規則**：
   - 在 `DailyWeatherStrip.tsx` 的 `useEffect` 內若同步調用 `setIsTimedOut(false)`，會被 React Compiler 判定為串聯重新渲染 (cascading renders) 引發 Linter 報錯。
   - **解法**：改用衍生狀態 `const showTimeoutFallback = isTimedOut && !hasData && !isLoading`，`useEffect` 僅專注於非同步定時器排程，完全符合純函數單向資料流原則。
2. **Zustand 非同步 IndexedDB Storage 的未感知延遲**：
   - `weatherStore` 使用非同步 `idbStorage`，若組件僅呼叫靜態 getter `getFiveDayData`，組件不會訂閱 store 變更，IndexedDB 讀取完畢後不會自動觸發 re-render。
   - **解法**：在組件頂層直接訂閱 `useWeatherStore((s) => s.fiveDayCache)`，資料只要就緒即瞬間響應。
3. **UTC 跨日 8 小時時差穿透**：
   - `new Date().toISOString().split("T")[0]` 在台灣/日本時間 00:00~08:00 會回傳前一天的 UTC 日期，造成快取鍵與本地行程排程日期錯位。
   - **解法**：全面改用 `new Date().toLocaleDateString('en-CA')` 對齊客戶端本地時區。

---

## 🚀 5. Next Steps (後續行動)

1. **真機離線冷啟動手動驗收**：在實體行動裝置與飛航模式下實測點開 PWA，體驗 0 網路秒開與連續 5 天天氣快取呈現。
2. **收據相片離線暫存架構規劃**：啟動離線 FormData Blob 儲存規格設計，打通記帳拍照離線全流程。
3. **架構演進清單同步更新**：同步更新 `architecture-evolution-backlog-spec.md`，將 E4, E5, E6 標記為已上線。
