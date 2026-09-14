# 📅 Daily Report - 2026-09-13

> **系統狀態**：🟢 Production Stable, 5-Day Live Weather Forecast Strip, Destination-Based Currency Resolution, Touch Target Modernization, CI/CD Node 24 Migration & MapLibre GL Dependency Research  
> **今日關鍵提交**：
> - [`35ed021`](https://github.com/tyrantpiper/travel-pwa/commit/35ed021) `feat(weather): add 5-day live forecast strip to trip master overview`
> - [`a585159`](https://github.com/tyrantpiper/travel-pwa/commit/a585159) `feat(currency): dynamically resolve legal currency by trip destination`
> - [`0206912`](https://github.com/tyrantpiper/travel-pwa/commit/0206912) `style(ui): standardize tailwind v4 tokens and harden touch targets`
> - [`fe7406a`](https://github.com/tyrantpiper/travel-pwa/commit/fe7406a) `ci: upgrade GitHub Actions to Node 24 and disable orphaned usage report workflow`
> - **專題研討斷點**：`Conversation 7f699e2b-baa2-49b5-9bc0-f8bfcc9e66c4 (Bump MapLibre GL Dependency)`

---

## 🟢 1. Features & Fixes (今日交付價值)

### 1.1 行程總覽 5 天即時氣象帶狀視圖 (DailyWeatherStrip)
1. **Open-Meteo 即時氣象串接**：
   - 建立 `frontend/lib/weather-api.ts` 與 `frontend/lib/stores/weatherStore.ts`，介接高精度 Open-Meteo 免費氣象 API，支援晴雨、氣溫區間、降雨機率與紫外線指數。
   - 實作 `frontend/lib/location-resolver.ts`，具備智慧解析能力：從行程主標題、目的地字串或首日景點中自動推導主要城市經緯度，並對外提供帶有快取防護的座標解析。
2. **總覽卡片深度整合**：
   - 於 `TripMasterOverview.tsx` 整合 `DailyWeatherStrip.tsx`，橫向水平捲動呈現 5 日動態天氣卡，並支援 `zh-TW` 與 `en` 多語系氣象文案（`frontend/lib/i18n/weather.ts`）。
   - 建立完備的單元測試 `frontend/__tests__/five-day-weather.test.ts`（7 項測試全綠）。

### 1.2 依行程目的地動態推導法定幣別 (Dynamic Currency Resolution)
1. **後端地理編碼服務升級**：
   - 在 `backend/services/geocode_service.py` 與 `backend/routers/trips.py` 中擴充目的地幣別對照矩陣（如日本 ➔ JPY、南韓 ➔ KRW、泰國 ➔ THB、美國/全球 ➔ USD、台灣 ➔ TWD 等）。
   - 行程建立與更新時，若使用者未手動指定幣別，系統自動依國碼或城市推導並綁定預設貨幣，免去過往每次記帳皆需反覆手動切換的繁瑣操作。
2. **前端資料介面同步**：
   - `frontend/components/itinerary/TripDialogs.tsx`、`frontend/lib/itinerary-types.ts` 及 `frontend/lib/api.ts` 完整同步該欄位，維持端到端型別一致。

### 1.3 Tailwind CSS v4 樣式標準化與觸控目標（Touch Target）強化
1. **行動端操作人體工學強化**：
   - 審查 `EditableDailyTips.tsx`、`EditableDailyChecklist.tsx`、`timeline-card.tsx`、`FlightCard.tsx` 與 `info-view.tsx`。
   - 將關鍵按鈕與點擊熱區全面升級為符合 WCAG 標準之 `min-h-[44px]` 與 `min-w-[44px]`，杜絕行動裝置誤觸。
   - 清理所有非標準的 Tailwind 任意字串類別，全數轉換為 Tailwind CSS v4 原生 tokens。

### 1.4 CI/CD 基礎設施升級與 Node 24 支援
1. **GitHub Actions 現代化**：
   - 更新 `.github/workflows/ci.yml` 與 `.github/workflows/deploy-backend.yml`，全面升級至 Node 24 執行環境，消除 GitHub Actions 即將棄用舊版 Node 的警告。
   - 將孤立無依賴的 `usage-report.yml` 重新命名並安全禁用（`.disabled`），簡化自動化流水線負擔。

---

## 🏛️ 2. Architecture Decisions (架構級決策)

- **氣象資料與城市地理編碼解耦 (Location Resolver Separation)**：
  行程總覽通常缺乏精確單一點座標。建立獨立的 `location-resolver.ts`，採取階梯式回退查找策略（`Trip Destination ➔ Day 1 First Spot ➔ Country Capital`），避免氣象元件直接侵入底層行程資料模型，確保表現層組件的純粹性。
- **幣別推導單一真實來源 (Destination-Currency SSOT)**：
  後端於行程創建時即決定預設幣別並持久化至資料庫，前端僅負責讀取並呈現推薦值。既保證了離線時的資料穩定性，又賦予使用者事後自由覆寫的能力。
- **MapLibre GL 升級策略研討斷點 (CSP Web Worker vs blob: URL)**：
  在 `Bump MapLibre GL Dependency` 專題研討中，深入排查 MapLibre GL v3/v4 至 v5+ 的演進：
  - 核心發現：MapLibre GL 內部使用的 Web Worker 預設會動態生成 `blob:` URL 載入代碼，這在具備嚴格內容安全策略（CSP）的 PWA 環境中會直接引發安全性阻擋。
  - 決策方向：不採用不安全的 `unsafe-eval` 或寬鬆 CSP，決定在後續建置管線中引入專屬的 Worker 複製腳本（`copy-maplibre-worker.mjs`），將 Worker 作為同源靜態檔案派發。

---

## 🔴 3. Technical Debt (技術債與後續追蹤)

- **MapLibre CSP Worker 建置管線自動化**：
  9/13 研討出的靜態 Worker 方案尚未正式落實為 npm scripts 鉤子（留至 9/14 實作）。
- **後端 POI 計算潛在 NoneType 隱患**：
  在特定邊際情況下（外部 API 缺少經緯度），後端 POI 距離計算有拋出異常的潛在風險，需進行防禦性型別加固。

---

## 🛡️ 4. Failed Paths (踩坑與反思)

- **直接在客戶端使用動態 `new Worker(URL.createObjectURL(blob))` 的 CSP 阻擋**：
  嘗試在瀏覽器端動態包裝 MapLibre Web Worker 腳本，在開發模式運作正常，但在嚴格 CSP 標頭下立即遭瀏覽器安全策略攔截。教訓：任何涉及 Web Worker 載入的第三方函式庫，必須走標準同源靜態檔案管道派發，不可走動態 blob 捷徑。

---

## 📊 5. Verification & Quality Gates (品質關卡數據)

| 檢驗項目 | 執行指令 | 檢驗結果 | 狀態 |
| :--- | :--- | :--- | :--- |
| **TypeScript 型別檢查** | `npx tsc --noEmit` | Exit Code: 0 (0 errors) | 🟢 PASS |
| **ESLint 靜態分析** | `npm run lint` | Exit Code: 0 (0 errors, 0 warnings) | 🟢 PASS |
| **氣象單元測試** | `npx vitest run five-day-weather` | 7 passed (7 tests) | 🟢 PASS |
| **遠端版本控制同步** | `git push origin main` | Commit `fe7406a` pushed to origin/main | 🟢 PASS |

---

## 🎯 6. Next Steps (後續方向)

1. **落實 MapLibre CSP Worker 複製腳本**：建立 `copy-maplibre-worker.mjs` 並加入 prebuild 與 dev 生命週期。
2. **後端 POI 服務加固**：修復經緯度缺失引發的異常並優化延遲。
3. **AI 對話助理能力擴充**：支援景點批次加入與日曆時鐘選取器。
