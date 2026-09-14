# 📅 Daily Report - 2026-09-14

> **系統狀態**：🟢 Production Stable, Full-Chain Deep Linking Engine, Virtuoso Virtual Scroll & Pulse Highlight, Trip Countdown & Travel Buddy Overview Routing (Day=0), AI Chat Batch POI & Custom Pickers, MapLibre CSP Asset Pipeline, 154 Tests Passed (100%), 0 Type Errors, 0 Lint Warnings  
> **今日關鍵提交**：
> - [`a1948fd`](https://github.com/tyrantpiper/travel-pwa/commit/a1948fd) `chore(build): setup MapLibre CSP worker asset pipeline and npm prebuild hooks`
> - [`3f57e26`](https://github.com/tyrantpiper/travel-pwa/commit/3f57e26) `fix(backend): resolve POI distance crash, optimize query RTT, and harden error passthrough`
> - [`01bd76d`](https://github.com/tyrantpiper/travel-pwa/commit/01bd76d) `feat(chat): add batch POI preview, calendar/clock pickers, and itinerary removal tool`
> - [`28859ce`](https://github.com/tyrantpiper/travel-pwa/commit/28859ce) `feat(map): enhance fullscreen modal and route rendering with test coverage`
> - [`209bf22`](https://github.com/tyrantpiper/travel-pwa/commit/209bf22) `feat(notifications): add deep linking for expenses and trip countdown with virtual scroll`

---

## 🟢 1. Features & Fixes (今日交付價值)

### 1.1 全鏈路推播深層導航與記帳精準定位 (Deep Linking & Virtual Scroll Engine)
1. **全域深層連結調度器 (`useDeepLinkRouter.ts`)**：
   - 統一解析 `trip`, `tab`, `day`, `expense_id` 等 URL 參數，集中同步至全域 Zustand `tripStore`。
   - 支援原生瀏覽器前進/後退（`popstate`）、站內事件（`tabidachi-deep-link`）以及未登入暫存（`sessionStorage('pending_deep_link')`），訪客登入後無縫續接導航。
   - 定位完成後立即執行 `window.history.replaceState` 清理 URL 臨時參數，徹底根除重新整理重複定位的死循環。
2. **Virtuoso 虛擬列表穿透重置與發光尋址 (`tools-view.tsx`)**：
   - 掛載 `virtuosoRef: VirtuosoHandle`，在接收到 `targetExpenseId` 時自動強制穿透篩選條件（付款人設為全部、清除分類過濾、切換為明細模式），防止目標項目被篩選器隱藏。
   - 120ms 延遲等待虛擬 DOM 排版就緒後調用 `scrollToIndex({ align: 'center', behavior: 'smooth' })` 平滑置中滾動。
   - 項目掛載 3.5 秒翠綠色呼吸光暈動畫（`ring-2 ring-emerald-500 bg-emerald-50/90`），並於超時或組件卸載時以 `clearTimeout` 嚴格釋放記憶體。
3. **行程總覽優先順序與防覆蓋解鎖 (`itinerary-view.tsx`)**：
   - 解除原本切換行程時無腦執行 `setDay(1)` 的暴力死鎖，升級為「優先讀取外部指定天數（如 deep link `day=0` 總覽），無外部指定才保底落地第 1 天」。
   - 倒數推播（`notify-countdown`）與旅伴加入推播精確落地 `day=0`「行程封面總覽卡片（`TripMasterOverview`）」。
4. **雲端 Edge Functions 同步熱部署**：
   - 本地 Git 完整納管 `supabase/functions/notify-event` 與 `supabase/functions/notify-countdown`。
   - 成功熱部署上線至 Supabase 專案（v5），推播 Payload 全面升級為標準化深層連結。

### 1.2 AI 聊天助理大躍進 (Batch POI, Native Pickers & Smart Removal)
1. **景點批次加入預覽卡片 (`BatchPOIPreviewCard.tsx`)**：
   - 支援 AI 一次性推薦多個景點，使用者可一鍵勾選預覽、批次寫入行程，大幅提升規劃效率。
2. **行動端原生感日曆與時鐘選擇器 (`DateTimePickers.tsx`)**：
   - 打造極致流暢的滾輪時間選取器與連續日曆，取代瀏覽器醜陋的原生日期輸入框。
3. **行程項目智慧刪除 (`RemoveItemPreviewCard.tsx`)**：
   - 聊天室內建智慧刪除意圖卡片，使用者直接在對話中確認刪除特定活動，零跳轉完成行程微調。
4. **意圖路由與模型調度器加固 (`intent_router.py`, `model_manager.py`)**：
   - 實作智慧動態意圖識別，補齊完整的單元測試套件（`test_intent_router.py`、`test_model_manager.py`）。

### 1.3 MapLibre CSP Worker 資產管線落地 (`a1948fd`)
1. **同源靜態 Worker 派發腳本**：
   - 承接 9/13 研討結論，建立 `frontend/scripts/copy-maplibre-worker.mjs`。
   - 在 `package.json` 的 `prebuild` 與 `dev:worker` 自動將 `maplibre-gl-csp-worker.js` 同步至 `public/` 目錄，在嚴格 CSP 標頭下徹底消除 `blob:` 腳本注入阻擋。

### 1.4 後端 POI 距離計算奔潰修復與延遲優化 (`3f57e26`)
1. **NoneType 防禦與查詢 RTT 提升**：
   - 修復當經緯度為空時距離計算引發的 `TypeError`。
   - 強化 Supabase 資料庫查詢快取與錯誤透傳，降低網路來回延遲（RTT）。

---

## 🏛️ 2. Architecture Decisions (架構級決策)

- **虛擬化清單篩選器穿透機制 (Filter Penetration on Deep Link)**：
  在虛擬化長清單（React Virtuoso）中，未渲染於 DOM 的項目無法藉由傳統 DOM API 定位；若使用者當前開著特定的分類或人員篩選，目標項目甚至根本不會存在於計算資料集中。架構上確立：深層連結尋址時，消費端必須具備「前置篩選器自動歸零（Filter Auto-Reset）」的穿透權威，隨後調用虛擬列表內部控制代碼 `scrollToIndex` 達成百分之百精準尋址。
- **深層意圖優先於預設值之階層判定 (Day-Zero Overview Precedence)**：
  打破「換行程 = 看第一天」的慣性假設，確立「外部明確意圖（Deep Link URL / Intent Store） > 內部預設落地值（Day 1）」的優先順序模型，成功解鎖推播直達 `day=0` 總覽儀表板的產品體驗。
- **暫時性目標參數脫敏與防震盪機制 (Ephemeral Target Parameter Cleanup)**：
  為了防止使用者在瀏覽器重新整理（F5）時反覆觸發滾動動畫與狀態覆蓋，在完成定位調度後，系統立即使用 `window.history.replaceState` 將 `expense_id` 從網址列拔除，達成「單次消費即銷毀（One-Time Consumption）」的冪等性保護。
- **CSP Web Worker 同源靜態管線標準化**：
  不為求省事而放寬 CSP 安全標頭（堅決不用 `unsafe-eval`），以建置期（Build-time Hook）自動化腳本將 Web Worker 轉換為同源靜態資產，兼顧安全性與開箱即用體驗。

---

## 🔴 3. Technical Debt (技術債與後續追蹤)

- **Service Worker 點擊直接喚起深層視窗**：
  目前推播通知點擊跳轉依賴網頁開啟後的 `useDeepLinkRouter`。未來可評估在 `sw.js` 的 `notificationclick` 事件中加入 `clients.matchAll({ type: 'window' })` 智慧聚焦已開啟之分頁，減少不必要的重複分頁生成。
- **VAPID 密鑰輪轉與 Supabase Webhook 監控**：
  需持續觀測雲端 Edge Functions 派發推播的延遲與第三方推播伺服器之 410 Gone 回收率。

---

## 🛡️ 4. Failed Paths (踩坑與反思)

- **傳統 DOM `scrollIntoView` 在虛擬化清單下的無效陷阱 (Virtual List Null DOM Trap)**：
  初期嘗試使用 `document.getElementById('expense-' + id)?.scrollIntoView()` 尋找目標項目。在項目數量超過可視區域時，Virtuoso 尚未將其渲染至 DOM 樹中，`document.getElementById` 必然回傳 `null`。教訓：凡使用虛擬化滾動引擎，絕對不能依賴原生 DOM 選擇器，必須使用虛擬庫提供的 Ref Handle 進行索引計算與滾動。
- **行程切換無腦重置天數抹除外部深層意圖 (Blind Day-1 Overwrite Trap)**：
  在 `itinerary-view.tsx` 中監聽 `[activeTripId]` 並直接調用 `setDay(1)`，導致推播傳入的 `day=0` 總覽參數被瞬間覆寫回第一天。教訓：在多狀態驅動的視圖中，狀態重置必須檢查當前全域 Store 是否已有高優先順序的顯式指定值。

---

## 📊 5. Verification & Quality Gates (品質關卡數據)

| 檢驗項目 | 執行指令 | 檢驗結果 | 狀態 |
| :--- | :--- | :--- | :--- |
| **前端測試套件** | `npx vitest run` | 19 passed (19 files), 154 passed (154 tests) | 🟢 PASS |
| **後端測試套件** | `pytest` | 43 passed, 5 skipped (48 items) | 🟢 PASS |
| **前端 TypeScript 靜態檢查** | `npx tsc --noEmit` | Exit Code: 0 (0 errors) | 🟢 PASS |
| **Supabase 邊緣運算型別** | `npx tsc --project ../supabase/tsconfig.json --noEmit` | Exit Code: 0 (0 errors) | 🟢 PASS |
| **前端 Linter** | `npm run lint` | Exit Code: 0 (0 errors, 0 warnings) | 🟢 PASS |
| **AST 防禦性模式掃描** | `RULE-TS-01` (Nested button) | 0 violations detected | 🟢 PASS |
| **遠端版本控制同步** | `git push origin main` | Commit `209bf22` pushed to origin/main | 🟢 PASS |

---

## 🎯 6. Next Steps (後續方向)

1. **實機推播端對端點擊驗收**：透過行動裝置（iOS PWA / Android Chrome）進行真機點擊記帳與倒數通知，核驗呼吸發光與平滑滾動質感。
2. **AI 對話助理場景延伸**：將全新之 `DateTimePickers` 與 `BatchPOIPreviewCard` 廣泛推展至自由規劃與快速改期對話場景中。
