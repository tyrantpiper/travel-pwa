# 📅 Daily Report - 2026-08-30

> **系統狀態**：🟢 Production Ready (All 114 Unit Tests, 25 Backend Tests, 6/6 Playwright E2E Suites Passed)  
> **今日關鍵提交**：
> - [`cff9adf`](https://github.com/tyrantpiper/travel-pwa/commit/cff9adf) `feat(itinerary): add iOS Swift calendar range picker, master overview, and atomic date engine`
> - [`167f565`](https://github.com/tyrantpiper/travel-pwa/commit/167f565) `feat(ui): add iOS Swift native navigation transitions, sub-views, and minimalist back buttons`
> - [`53eabaf`](https://github.com/tyrantpiper/travel-pwa/commit/53eabaf) `feat(ui): elevate ai itinerary wizards, ios swift motion transitions, and touch guards`

---

## 🟢 1. Features & Fixes (今日交付價值)

1. **多模態行程匯入精靈 (`AiImportTripWizard.tsx`)**：
   - 支援純文字、旅遊筆記、拖曳/點擊圖片上傳、以及剪貼簿 `Ctrl+V` 截圖直貼。
   - 整合即時靈感範本膠囊（東京 5 日遊、關西美食、北海道自駕等），點擊自動帶入測試範本。
   - 後端 Gemini 3.x Multimodal 解析圖片並自動結構化為標準 `TripPlan`。
2. **5 步 Grill-Me 智慧問答嚮導 (`AiGrillMeWizard.tsx`)**：
   - 實作「目的地 ➔ 旅伴 ➔ 節奏 ➔ 預算 ➔ 喜好」5 步分段互動嚮導。
   - 動態計算進度條，並自動生成嚴格 XML 提示詞發送給 AI 生成行程。
3. **雙向儲存目標選擇器 (`TripDialogs.tsx` & `tools-view.tsx`)**：
   - AI 解析/生成完成後，提供雙向選擇：🌟 **建立為全新行程** vs 📥 **合併至現有行程**（依天數智慧追加）。
4. **工具頁 3-Way 原地現代化分段器 (`tools-view.tsx`)**：
   - 淘汰舊版彈窗與死代碼，原地內嵌 `🧙‍♂️ 智能引導` ✕ `📝 多模態匯入` ✕ `✍️ 自由輸入`。
   - 完整保留信用卡管理（`cards`）與記帳分帳總覽（`expense`）所有資料流與圖表。
5. **iOS Swift 全域雙向滑動轉場 (`app-shell.tsx`)**：
   - 導入方向感知索引計算 (`TAB_INDICES: 0 ➔ 1 ➔ 2 ➔ 3`)，往右往左切換自動匹配 iOS 原生彈簧滑入（`x: ±28px`）。
   - **消除動態 Key**：四個主畫面實例永不銷毀，達成 **0 重複 API 請求** 與 **滾動位置 100% 記憶**。
6. **全域長按防文字選取保護 (`globals.css` & `bottom-nav.tsx`)**：
   - 注入 iOS Native 觸控規範，所有按鈕、導航列與標籤強制 `select-none`，徹底消除手機長按文字反藍問題。
   - 底部導航加入 `haptic.selection()` 原生震動與 `active:scale-95` 彈性點擊反饋。
7. **記帳彈窗 Tailwind v4 標準化 (`expense-dialog.tsx`)**：
   - 遵循「避免過度工程」決策，零破壞保留 20+ 項核心記帳業務邏輯，僅修復樣式語法達到 0 警告。
8. **全套自動化端到端測試套件 (Playwright 6 大套件全數通過)**：
   - 新增 `create_trip_flow.spec.ts` 與 `tools_view_flow.spec.ts`，全自動守護行程建立、工具箱與帳號設定。

---

## 🏛️ 2. Architecture Decisions (架構級決策)

- **避免高風險重寫，採取精準微拋光 (Pragmatic Stabilization over Over-Execution)**：
  對於承載 20+ 項高密度邏輯的 `ExpenseDialog`（AI 收據 OCR、多幣別匯率、明細拆帳、診斷狀態機），果斷停止推倒式重構，專注於樣式標準化與全域動效，取得最高的穩定度與安全 ROI。
- **無狀態銷毀的視圖動畫架構 (Zero-Remount View Animation Architecture)**：
  在 `<motion.div>` 實作切換動畫時，絕對不可在常駐視圖上使用動態 `key`。必須使用靜態標識並透過 `animate` 屬性驅動視覺位移，保證 React 元件生命週期穩定與 0 重複網路請求。
- **雙向儲存目標分流引擎 (Dual Save Destination Engine)**：
  AI 解析結果不再預設僅能建立新行程，而是透過 `tripsApi.importToTrip` 支援合併至現有行程，形成完整的旅遊資訊收集閉環。

---

## 🔴 3. Technical Debt (技術債務追蹤)

- **Radix DialogContent a11y 補充**: 部分彈窗缺少 `aria-describedby`，後續可補齊 `<DialogDescription>`。
- **AI 座標精準度觀測**: 需持續觀察 AI 在冷門景點給出經緯度之偏差值，評估是否需要在 DB 標註 `is_ai_inferred`。
- **Nominatim 呼叫前置守衛**: 當 Photon 或 LANDMARKS 已取得高置信度結果時，完全略過 Nominatim 網路請求以減少控制台 Warning。

---

## 🛡️ 4. Failed Paths (踩坑與失敗教訓)

- **Framer Motion 動態 Key 引發元件重新掛載與重複請求**：
  在 `app-shell.tsx` 中為四大視圖外層加上 `key={`view-${activeView}`}` 時，導致換頁時 React 判定為新元件而銷毀重新掛載，引發 `fetchProfileData` 重複發送。**教訓**：常駐型主頁面切換動效嚴禁使用動態 `key`，應使用靜態標識搭配屬性動畫。
- **測試選擇器依賴特定 Tailwind 類別字串 (`z-[100]` vs `z-100`)**：
  在升級 Tailwind v4 utility token 時，若 Playwright 測試選擇器以 `.z-\\[100\\]` 尋找元素會導致測試失敗。**教訓**：測試選擇器應優先使用角色 (`role`)、`aria-label` 或組合選擇器（如 `.fixed.z-100, .fixed.z-\\[100\\]`）以保持彈性。

---

## 🚀 5. Next Steps (後續規劃)

1. 持續監控生產環境在 PWA 離線模式下的快取命中率與 Core Web Vitals (INP / LCP / CLS) 表現。
2. 規劃行程總覽 (Day 0) 中的「多天軌跡地圖疊加渲染」，讓旅人在地圖上一鍵看清全趟旅行的地理移動軌跡。
