# 📅 Tabidachi 開發日誌 (Daily Report) — 2026-08-20

> **紀錄者**: Ryan Su (@architect / @dev)  
> **系統狀態**: 🟢 ALL PASS (pytest 26/26 通過 (23 passed, 3 skipped), TypeScript 0 錯誤, ESLint 0 錯誤)  
> **核心里程碑**: AI 生成行程座標直出閉環、Cloud Run 600s 逾時防線建立、偽 CORS 504 根因拔除、描述層級無損保留

---

## 1. 🟢 Features & Fixes (今日交付價值)

### 1.1 AI 行程經緯度座標直出 (Direct Inlined Coordinates)
* **背景與痛點**：以往 AI 生成行程時僅輸出 `place_name`，後端需對 30+ 景點逐一執行外部 Geocoding API 解析，即便具備並發熔斷仍需耗費額外 3~5 秒。
* **交付方案**：
  * 在 `backend/routers/ai.py` 的 System Instruction 中注入精確座標輸出規範（規則 5：`lat`/`lng` 為 float，精度至少小數點後 4 位）。
  * 在 Strict JSON Schema 範例中補齊各活動點之座標與母體 `destination`。
  * 後端維持 `_safe_geocode`（Semaphore 10 + 2.5s 單點熔斷）作為動態 Fallback 防線，僅對缺失座標或為 0 的景點進行補查，省去 80%+ 的外部網路請求。

### 1.2 景點描述無損保留 (Lossless Description Pipeline)
* **交付方案**：
  * 移除後端 `ai.py` 中將描述硬砍至 57 字元的破壞性截斷邏輯。
  * 前端 `TimelineCardOverlay.tsx` 已具備 CSS `line-clamp-2` 視覺防溢出能力，卡片點開後可完整查看豐富的歷史背景、排隊攻略與推薦料理。

### 1.3 Cloud Run 逾時時間升級至 600s 與偽 CORS 拔除
* **交付方案**：
  * 深入分析發現「No Access-Control-Allow-Origin」與 `ERR_FAILED` 乃 Google Front End (GFE) 在 60 秒逾時物理掐斷連線所回傳之 Headerless 504 HTML。
  * 於 `.github/workflows/deploy-backend.yml` 寫入 `--timeout 600s`，徹底杜絕手動於 GCP Console 設定後被 CI/CD 覆蓋回 60 秒的陷阱。
  * 將 FastAPI `CORSMiddleware` 調至洋蔥模型最外層，保證任何內部 4xx/5xx 例外均能攜帶完整 CORS 標頭。

---

## 2. 🏛️ Architecture Decisions (架構決策)

* **AI 座標直出 + 動態 Fallback 雙層保障架構 (Inline Coordinates with Dynamic Fallback)**: 
  確立「AI 先行預估座標、後端精確補漏」的雙軌架構。兼具極速生成體驗與冷門地點的高可用性。
* **表現層截斷與資料層無損分離 (Presentation Layer Truncation Separation)**: 
  資料傳輸層（API/Database）保持 100% 原始語義完整性，字數長度與溢出隱藏完全交由前端 CSS (`line-clamp-2`, `truncate`) 表現層控制。
* **基礎設施宣告權威性原則 (Infra-as-Code Authority)**: 
  雲端資源（Cloud Run / Supabase）的執行時配置必須優先於 CI/CD 配置檔中顯式宣告，避免手動 Console 操作遭自動化管線無預警洗回。

---

## 3. 🛡️ Failed Paths (經驗教訓與防禦)

* **GFE 逾時引發的偽性 CORS 誤診**: 
  連線若在到達 FastAPI Middleware Stack 前即被 Google Front End (GFE) 依據 60s 逾時強制斷開，瀏覽器只會收到不帶 CORS Headers 的 504 頁面並拋出 CORS 錯誤。修改代碼層 CORS Middleware 毫無作用，根因在於基礎設施層逾時配置。
* **CI/CD 覆寫雲端手動設定**: 
  在 GCP Console Web UI 調整參數（如 Request Timeout）會在下一次包含 `backend/**` 的 Git Push 觸發 GitHub Actions 時被 `gcloud run deploy` 覆寫回 YAML 預設值。所有基礎設施調優必須於 Workflow 檔案中同步落地。

---

## 4. 🔴 Technical Debt (技術債務追蹤)

* **AI 預估座標精準度觀測**: 
  需持續觀察 AI 在冷門、新建景點所給出經緯度之偏差值，評估是否需要在 DB 新增 `is_ai_inferred` 標籤以利後續使用者校正。
* **Nominatim 呼叫前置守衛**: 
  當 Photon 或 LANDMARKS 已取得高置信度結果時，完全略過 Nominatim 網路請求以減少控制台 Warning 與網路延遲。
* **Radix DialogContent 無障礙警告**: 
  修復瀏覽器控制台對 `DialogContent` 缺少 `Description` 或 `aria-describedby` 的 Accessibility Warning。

---

## 5. 🎯 Next Steps & Evolution Roadmap (下一階段演進)

1. **全景行程總覽與多天鳥瞰儀表板 (Full-Trip Master Overview)**：
   * 在行程視圖天數分頁新增「全部 (ALL) / 行程總覽」模式。
   * 整合多天點燈全景地圖軌跡、每日摘要卡片與總開銷統計。
2. **Local-First 離線地圖與 PWA 快取強化**：
   * 利用 IndexedDB 針對行程座標與 Map Tiles 進行離線快取，保障跨國漫遊弱網環境下的流暢性。
