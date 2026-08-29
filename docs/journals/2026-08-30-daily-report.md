# 📅 Daily Report - 2026-08-30

> **系統狀態**：🟢 Production Ready (All 114 Unit Tests, 25 Backend Tests, 2 Playwright E2E Tests Passed)  
> **發布提交**：[`cff9adf`](https://github.com/tyrantpiper/travel-pwa/commit/cff9adf) `feat(itinerary): add iOS Swift calendar range picker, master overview, and atomic date engine`

---

## 🟢 1. Features & Fixes (今日交付價值)

1. **iOS Swift 連續縱向日曆區間選擇器 (`CalendarRangeSheet.tsx`)**：
   - 實作連續 12 個月多月份縱向平滑滾動日曆，支援 Sticky 月份頂部懸浮吸頂。
   - 支援兩次點擊選取「出發日」與「結束日」，即時計算「X 天 Y 晚 / 1 天當日來回」日期膠囊。
   - 具備「🔄 跳至今日 (`cal_jump_to_today`)」與「回到行程月份」快捷操作，並適配 `z-120` 遮罩分層與 Tailwind v4 語法。
2. **行程全景脈絡儀表板 (`TripMasterOverview.tsx`)**：
   - 在行程左側頂部新增「全部 (ALL) / 總覽 (Day 0)」Tab，一秒俯瞰多天總天數、景點數、總預算與城市軌跡。
   - 支援點擊任一天數無縫跳轉，並自動適配國際多幣別格式化。
3. **後端原子日期平移引擎 (`PATCH /api/trips/{trip_id}/dates`)**：
   - 實現行程出發日、結束日原子化批次平移。
   - 支援 `itinerary_items.day_number` 自動偏移，以及 `DAY_MAP_FIELDS`（含筆記、花費、票券、AI 評論）雙向安全位移。
   - 具備縮短行程安全對話框：提供「合併至最後一天 (Merge)」與「直接刪除 (Delete)」雙重防禦。
4. **HTML5 按鈕巢狀衝突修復 (`TripList.tsx`)**：
   - 徹底解耦卡片主按鈕與底部動作按鈕列（PDF 下載、退出行程、刪除），消除瀏覽器 `cannot contain a nested <button>` 控制台報錯。
5. **Zod 資料契約深度容錯 (`schemas.ts`)**：
   - 全面為 Supabase 歷史 null 欄位加入 `.nullable().transform(...)` 轉換防禦，杜絕舊行程載入崩潰。
6. **Playwright 現代化 E2E 測試工程化**：
   - 新增 `playwright.config.ts` 隔離測試範圍至 `./tests`，成功建立登入與日曆總覽 2 組端對端自動化測試。

---

## 🏛️ 2. Architecture Decisions (架構級決策)

- **iOS Swift 風格日曆區間選擇器與行程總覽 (Continuous Multi-Month Calendar & Master Overview)**：
  捨棄繁瑣且容易造成幽靈天數的單日增減按鈕，改以連續縱向滾動的雙向日曆區間選擇器為唯一日期變更入口；Day 0 專屬承載全行程指標脈絡。
- **原子日期平移與雙向位移演算法 (Atomic Date Range Shift & Key Directional Movement)**：
  出發日提前（Shift > 0）時，Content 字典必須採用**逆序迭代（Reverse-order shift）**防止鍵值覆蓋；延後（Shift < 0）時採用**正序迭代**前移過期資料。
- **解耦按鈕 DOM 架構 (Decoupled Button DOM Architecture)**：
  在複合卡片中，進入主要頁面的觸發器與內部獨立操作按鈕必須是平級 Sibling，不得互相包裹，確保 100% 符合 HTML5 與 WAI-ARIA 規範。
- **E2E 獨立測試目錄隔離 (Isolated Playwright testDir)**：
  透過 `playwright.config.ts` 明確宣告 `testDir: './tests'`，嚴格與 Vitest 單元測試 `__tests__` 隔離，保障測試管線獨立互不干擾。

---

## 🔴 3. Technical Debt (技術債務追蹤)

- **AI 預估座標精準度觀測**: 需持續觀察 AI 在冷門景點給出經緯度之偏差值，評估是否需要在 DB 標註 `is_ai_inferred` 供使用者校對。
- **Nominatim 呼叫前置守衛**: 當 Photon 或 LANDMARKS 已取得高置信度結果時，完全略過 Nominatim 網路請求以減少控制台 Warning 與網路延遲。
- **Radix DialogContent 無障礙警告**: 修復瀏覽器控制台對 `DialogContent` 缺少 `Description` 或 `aria-describedby` 的 Accessibility Warning。
- **Metrics/Timeout 測試跳過**: `test_poi_lifespan.py` 使用 `@pytest.mark.skip` 暫時略過了未實作的 Metrics 與 Timeout 測試案例，待後續 Sprint 補齊。
- **Dependabot 漏洞修補**: Default branch 存在 1 個 Low severity 安全漏洞，需排程升級相依性。

---

## 🛡️ 4. Failed Paths (踩坑與失敗教訓)

- **Language Server 記憶體緩存落後引發的假性紅字 (In-Flight Document Buffer De-sync)**：
  AI 工具在毫秒級寫入檔案時，IDE Language Server 若恰好在中間狀態捕獲 AST，會產生整排假性紅字。若使用者編輯器此時存檔，會觸發「The content of the file is newer」警告。**教訓**：遇到此狀況絕對不要點 Overwrite，應關閉分頁或執行 Revert File 重新載入磁碟最新版。
- **Playwright 預設掃描目錄與 Vitest 單元測試衝突**：
  Playwright 預設會遞迴掃描專案內所有 `*.test.ts`，進而誤載 Vitest 的 CommonJS 測試檔導致報錯。**教訓**：多測試框架共存時，必須使用配置檔明確劃分測試範圍。

---

## 🚀 5. Next Steps (後續規劃)

1. 針對 `DialogContent` 補齊 `aria-describedby` 與 a11y 標籤，達成 100% 無障礙標準。
2. 規劃行程總覽 (Day 0) 中的「多天軌跡地圖疊加渲染」，讓旅人在地圖上一鍵看清全趟旅行的地理移動軌跡。
3. 持續監控生產環境 Core Web Vitals (INP / LCP / CLS) 表現。
