# 📅 Tabidachi 開發日誌 (Daily Report) — 2026-08-19

> **紀錄者**: Ryan Su (@architect / @dev)  
> **系統狀態**: 🟢 ALL PASS (pytest 26/26 綠燈, TypeScript 0 錯誤)  
> **核心里程碑**: 全球微氣候空間錨點閉環、多天行程天數防截斷四重防衛、System 2 深度研究 Agent 上線

---

## 1. 🟢 Features & Fixes (今日交付價值)

### 🌍 1.1 全球微氣候與空間錨點繼承 (Universal Dynamic Microclimate & Localization)
- **P0 根因修復 (`ai.py:420`)**：修復 `first_dest.get("country")` 在 Photon 回傳結果中不存在導致 `dest_country` 永遠為 `None` 的長年隱患。改以 `detect_country_from_keywords` 獨立確定性解析母體國碼，徹底消除 `⚠️ No country detected` 警告。
- **五重防護網全開 (`geocode_service.py`)**：
  - `COUNTRY_BOUNDS` 擴充美、英、法、德、意、西、瑞、冰、澳、加、馬、印、菲等 13 國地理疆界。
  - `COUNTRY_NAME_TO_CODE` 補齊 2 位 ISO 國碼自我映射（如 `"jp": "JP"`），支援大小寫無縫直通。
  - 關鍵字級聯判定：依序校驗「景點名稱 ➔ 母體行程標題 ➔ 目標區域」。
  - 區域前綴消歧義（如「北海道 朝市」）。

### 📅 1.2 多天行程天數截斷與季節日期推算 (Multi-Day Itinerary Duration Guarantee)
- **四重立體防衛**：
  1. `ai.py`：AI 生成行程時，自動由 `max_day` 與季節/出發日精準計算 `start_date` 與 `end_date`。
  2. `trips.py`：後端 `save_itinerary` 儲存時，若傳入日期跨度小於景點實際天數，強制以 `max_day` 展延 `end_date`。
  3. `tools-view.tsx`：前端匯入與儲存新行程時，自動由 `result.items` 最大天數計算展延 `endDateStr`，並消除了 `any` lint 錯誤。
  4. `itinerary-view.tsx`：前端頁面渲染時，`totalDays` 採用 `Math.max(日期跨度, 景點最大天數)` 雙保險守衛，徹底解決「生成多天行程只顯示一天、手動按加號才跑出來」的幽靈行程問題。

### 🔬 1.3 System 2 深度研究 Agent 上線 (`agents.py` & `DeepResearchCard.tsx`)
- 新增 `/api/agents/research` 端點，整合 Travelpayouts 即時機票價格數據與 Gemini 3.7 Flash 思考推論模式。
- 前端 Chat 介面整合 🔬 深度研究模式晶片 Toggle、即時狀態輪詢卡片與「一鍵匯入行程」自定義事件轉發。

### 🎨 1.4 UI 空間與微膠囊佈局優化
- 將 `AIStatusButton` 膠囊按鈕微調至 `h-7.5`，固定定位調整至 `top-2`，解決 Header 與通知鈴鐺的重疊衝突。

---

## 2. 🏛️ Architecture Decisions (架構決策)

1. **母體區域繼承原則 (Mother Region Inheritance Doctrine)**：
   單一景點的地理編碼不再孤立猜測，而是以行程母體目的地（如「北海道 5 日遊」➔ 札幌中心點與 JP 國碼）作為 Proximity Bias 空間錨點，確保所有子景點均精準收斂於母體疆域內。
2. **天數物理可見性優先 (Physical Visibility Over Strict Date Field)**：
   前端天數分頁渲染不再單一依賴資料庫日期字串跨度，而是以 `Math.max(日期天數, 資料庫景點天數)` 作為物理底線。只要資料庫存在 Day N 的活動，分頁標籤就絕對保證渲染至 Day N。
3. **高頻對話與重度規劃模型分流 (Quota Partitioning)**：
   日常對話 (`CHAT`) 與記憶萃取 (`SUMMARIZE`) 優先由高吞吐量、15 RPM 的 `gemini-3.1-flash-lite` 承接；長多天行程規劃 (`PLANNING`) 則保留給高算力旗艦 `gemini-3.7-flash`，防止日常對話耗盡 3.7 的預覽額度而觸發 429。

---

## 3. 🛡️ Failed Paths (踩坑記錄與教訓)

1. **回傳物件結構盲區假設**：
   原先假設 `smart_geocode_logic` 回傳的 results 包含 `country` 欄位，但實際上 Photon 與 Nominatim 只封裝了 `lat, lng, name, address, type, source`。**教訓**：取用下游欄位前必須檢閱資料來源的實際 Return Dict，不可依賴直覺假設。
2. **預設兜底覆蓋後端推算**：
   前端在 `tools-view.tsx` 中把未定義的 `end_date` 盲目兜底為 `today`，導致後端收到有效字串而跳過 `elif request.items:` 的天數自動推算。**教訓**：前後端協同防禦時，前端應計算精確值，後端應具備覆寫無效跨度的權威修正力。
3. **OSM Nominatim 併發限速衝突**：
   Nominatim 官方嚴格限制 1 req/sec，在 5 個景點並行呼叫時若同時進入 Nominatim 降級路徑會觸發 429 或 ReadTimeout。**教訓**：第三方免費用量受限 API 必須有前置條件（如 Photon 已命中則跳過），避免無謂的網路風暴。

---

## 4. 🔴 Technical Debt (技術債務追蹤)

- [ ] **Nominatim 呼叫前置守衛**：當 Photon 或 LANDMARKS 已取得高置信度結果（`score > 0.8`）時，完全略過 Nominatim 網路請求以減少控制台 Warning 與網路延遲。
- [ ] **Metrics/Timeout 測試補齊**：`test_poi_lifespan.py` 中被 `@pytest.mark.skip` 的邊界測試。
- [ ] **Radix DialogContent aria-describedby**：修復瀏覽器控制台對 `DialogContent` 缺少 `Description` 的無障礙 Accessibility 警告。

---

## 5. 🔭 深度思考：下一次的架構演進方向 (Next Roadmap)

### 🎯 方向一：智慧行程動態微氣候整合 (Real-time Weather & Microclimate Fusion)
* **目標**：利用已完成的全球城市坐標與時區庫，在行程視圖（`ItineraryView`）與各天活動卡片上，自動整合 Open-Meteo 免費氣象 API，提供「每日出發地降雨機率、早晚溫差提示與雨天備案觸發」。
* **價值**：讓行程從「靜態清單」升級為「具備即時情境感知 (Context-Aware) 的智慧導遊」。

### 🎯 方向二：深度研究成果結構化直通匯入 (Deep Research ➔ Visual Itinerary Pipeline)
* **目標**：打通 `DeepResearchCard` 產出的 Markdown 深度研究報告與 `parse-md`，讓使用者在聊天室看到的研究方案（例如「札幌-小樽-富良野 7 天深度方案」）能一鍵無縫解析成帶座標、帶時間、帶地圖 Pin 的視覺化行程。
* **價值**：真正實現 System 2 深度思考與前端視覺化編輯器的完全閉環。

### 🎯 方向三：全景行程總覽與多天鳥瞰儀表板 (Full-Trip Master Overview & Bird's-Eye Dashboard)
* **目標**：在行程視圖（`ItineraryView`）天數分頁新增 **「全部 (ALL) / 行程總覽 (Overview)」** 模式。
* **功能特色**：
  1. **全景地圖點燈 (Full-Trip Map Mesh)**：一次在全螢幕地圖上以不同色系/軌跡連線標記 Day 1 到 Day N 的所有景點與跨城移動動線。
  2. **每日精華總覽卡 (Daily Digest Cards)**：一目了然展示每一天的主要城市、代表性亮點、當日開銷與重點備忘。
  3. **旅程全局統計 (Trip Analytics)**：自動統計總景點數、總里程/交通次數、總預算與每日體力節奏分析。
* **價值**：徹底解決旅人必須頻繁切換單日分頁才能掌握全局的痛點，實現「一秒俯瞰整趟旅程」的旗艦級體驗。

### 🎯 方向四：離線地圖與 PWA Local-First 強化
* **目標**：利用 IndexedDB 對使用者已儲存行程的座標與地圖瓦片（Map Tiles）進行本地快取，在出國旅遊無網路/漫遊訊號微弱時依然能順暢查看每日時間軸與離線點燈地圖。
