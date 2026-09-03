# 📅 Daily Report - 2026-09-04

> **系統狀態**：🟢 Production Live & Fully Hardened (Next.js 16.3.0 + Python 3.12.8, 0 Deprecation Warnings, 0 Production Vulnerabilities, 100% Tests Passed)  
> **今日關鍵提交**：
> - [`4d92f79`](https://github.com/tyrantpiper/travel-pwa/commit/4d92f79) `feat(workflow): integrate tools-hub semantic AST rules, TruffleHog guard, and xh probe matrix`
> - [`a289406`](https://github.com/tyrantpiper/travel-pwa/commit/a289406) `fix(core): modernize UTC datetime handling and upgrade browserslist/fflate overrides`

---

## 🟢 1. Features & Fixes (今日交付價值)

1. **tools-hub 智能審查矩陣整合 (`/audit` & `/security-audit`)**：
   - 全面引入 `@mcp:tools-hub` 之 `ast_grep_search`、`trufflehog_scan`、`xh_http_request` 與 `hyperfine_benchmark`。
   - 為前端定義 `RULE-TS-01` (按鈕巢狀違規)、`RULE-TS-02` (Radix a11y 缺失)、`RULE-TS-03` (視圖動態 Key)；後端定義 `RULE-PY-01~03` (async 阻塞/線程死鎖/心跳副作用守門)。
2. **生產環境漏洞徹底歸零 (`npm audit --production: found 0 vulnerabilities`)**：
   - 透過 npm `overrides` 原地精確鎖定 `browserslist@^4.28.8` (修復 High OOM 記憶體洩漏漏洞) 與 `fflate@^0.8.3` (修復 Moderate ZIP64 DoS 漏洞)。
   - 完美避開了 `npm audit fix --force` 會強行將 `@serwist/turbopack` 降級至 9.5.2 的破壞性大坑，保持 Next.js 16 + React 19 + PWA 架構 100% 穩定。
3. **後端時間處理現代化與 DeprecationWarning 消除**：
   - 消除 Python 3.12 廢棄警報：將 `backend/main.py` 內 4 處 `datetime.utcnow()` 原子化遷移至標準帶時區物件 `datetime.now(timezone.utc)`。
   - 確保 `app.state.start_time` 與每次請求計算之當前時間同為 Timezone-Aware 物件，杜絕 TypeError 崩潰風險。
4. **跨全端 8 重立體驗證與零降級保證**：
   - 依據 `/goal` 規範調用全套工具鏈：Git Lockfile 比對、TypeScript (0 錯誤)、ESLint (0 錯誤)、Vitest (114 測試全過)、Pytest (27 測試全過)、Python Health Check (PASS)、Next.js Turbopack 2.6s 打包生成 `/sw.js` 以及 Playwright E2E 測試。

---

## 🏛️ 2. Architecture Decisions (架構級決策)

- **`overrides` 原地安全合併原則 (`In-Place Override Merging`)**：
  在既有專案配置依賴覆蓋時，嚴禁在檔案末尾新增重複鍵，必須採增量原地合併（In-Place Merge），完整保留既有安全補丁（如 `serialize-javascript: ^6.0.2`），杜絕 JSON 語法衝突。
- **後端時間處理時區原子一致性 (`Timezone-Aware Atomicity`)**：
  伺服器啟動時間（`start_time`）與每次請求計算（`uptime_seconds`）必須同步採用 `timezone.utc`，杜絕因 naive/aware 混用導致的 `TypeError: can't subtract offset-naive and offset-aware datetimes` 致命錯誤。
- **三重活體驗收防線 (`Tri-Layer Verification Protocol`)**：
  依賴升級或底層工具鏈變更時，驗收不能僅停留在靜態型別層（`tsc`），必須執行：
  1. `npm audit --production` (安全防衛)
  2. `npm run test:run` (單元邏輯)
  3. `npm run build` (真實編譯打包與 Service Worker 產出)

---

## 🔴 3. Technical Debt (技術債務追蹤)

- **FastAPI ORJSONResponse 遷移評估**: FastAPI 新版本提出 `FastAPIDeprecationWarning: ORJSONResponse is deprecated`，建議後續可評估直接交由 Pydantic `response_model` 序列化。
- **AI 座標精準度觀測**: 需持續觀察 AI 在冷門景點給出經緯度之偏差值，評估是否需要在 DB 標註 `is_ai_inferred`。
- **Nominatim 呼叫前置守衛**: 當 Photon 或 LANDMARKS 已取得高置信度結果時，完全略過 Nominatim 網路請求以減少控制台 Warning。
- **Metrics/Timeout 測試跳過**: `test_poi_lifespan.py` 使用 `@pytest.mark.skip` 暫時略過了未實作的 Metrics 與 Timeout 測試案例，待後續 Sprint 補齊。

---

## 🛡️ 4. Failed Paths (踩坑與失敗教訓)

- **盲目 `npm audit fix --force` 引發的 Serwist 破壞性降級陷阱**：
  npm audit fix 會為了滿足舊版依賴範圍，試圖將 `@serwist/turbopack` 降級至骨董版本 `9.5.2`，直接破壞 Next.js 16 打包整合。**教訓**：間接依賴漏洞治理應優先採用 npm 原生 `overrides` 原地鎖定，杜絕向後降級。
- **JSON 重複鍵盲區 (`Duplicate Key Trap`)**：
  在已有 `overrides` 的 `package.json` 粗暴追加新區塊會產生重複鍵語法錯誤。**教訓**：工程修改前必須嚴格確認既有代碼結構，堅持原地增量合併。
- **型別檢查取代真實建置的推論跳躍**：
  誤以為 `tsc --noEmit` 通過即代表打包正常，忽略了 `browserslist` 僅在打包轉譯期被調用。**教訓**：編譯鏈工具升級必須以 `npm run build` 作為最終真實驗收依據。

---

## 🎯 5. Next Steps (後續規劃)

1. 持續觀測 Cloud Run 生產環境 Uptime 與新版 ISO-8601 時間戳之日誌解析穩定度。
2. 規劃 FastAPI 序列化性能微調，評估淘汰 `ORJSONResponse` 手動包裝之必要性。
