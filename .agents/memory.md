## [Decisions]
- **AI 座標直出 + 動態 Fallback 雙層保障 (Inline Coordinates with Dynamic Fallback)**: AI 生成行程時直接輸出經緯度座標（精度小數點後 4 位），後端 `_safe_geocode`（Semaphore 10 + 2.5s 硬熔斷）僅對座標缺失或為 0 的景點進行補查，省去 80%+ 外部 API 網路延遲。
- **表現層截斷與資料層無損分離 (Presentation Layer Truncation Separation)**: 資料傳輸與儲存層保持 100% 原始語義完整性，字數截斷完全由前端 CSS (`line-clamp-2`, `truncate`) 控制。
- **基礎設施宣告權威性原則 (Infra-as-Code Authority)**: 雲端資源參數（如 Cloud Run `--timeout 600s`）必須在 `.github/workflows/deploy-backend.yml` 宣告，杜絕 Console 手動設定被 CI/CD 無預警洗回。
- **全景行程總覽模式 (Full-Trip Master Overview)**: 確立「全部 (ALL) / 行程總覽」為核心演進目標，支援多天軌跡地圖疊加、每日摘要卡片與總預算/體力智慧分析。
- **iOS Swift 風格日曆區間選擇器與行程總覽 (Continuous Multi-Month Calendar & Master Overview)**: 採用連續縱向雙向滾動日曆 (`CalendarRangeSheet`) 搭配 Sticky 月份標題與快速跳轉，取代零散前後加減天數按鈕；在 Day 0 建立 `TripMasterOverview` 儀表板。
- **iOS Swift 全域雙向滑動轉場與極致觸控體驗 (Direction-Aware Spring Transitions & Touch Guards)**: `app-shell.tsx` 導入方向感知索引與彈簧滑入 (`x: ±28px`)；全域注入 `select-none` 消除長按選取文字問題，底部導航搭配 `haptic.selection()` 原生震動與 `active:scale-95` 反饋。
- **無狀態銷毀的視圖動畫架構 (Zero-Remount View Animation Architecture)**: `<motion.div>` 使用靜態標識搭配屬性動畫驅動位移，四大主頁面常駐且永不銷毀，達成 0 重複 API 請求與 100% 滾動位置記憶。
- **多模態行程匯入與 5 步 Grill-Me 嚮導 (Multimodal Import & 5-Step Grill-Me Wizard)**: `AiImportTripWizard` 支援純文字、筆記、圖片上傳與 `Ctrl+V` 截圖直貼，搭配即時靈感範本與 Gemini 3.x Multimodal 解析；`AiGrillMeWizard` 實作「目的地 ➔ 旅伴 ➔ 節奏 ➔ 預算 ➔ 喜好」5 步嚮導並自動構建 XML 提示詞。
- **工具頁 3-Way 原地現代化分段器與雙向儲存分流 (3-Way In-Place Switcher & Dual Save Engine)**: 原地內嵌 `智能引導` ✕ `多模態匯入` ✕ `自由輸入`，完整保留卡片與分帳資料流；透過 `tripsApi.importToTrip` 支援 AI 解析結果建立為新行程或合併至現有行程。
- **避免高風險重寫，採取精準微拋光 (Pragmatic Stabilization over Over-Execution)**: 對於承載 20+ 項高密度邏輯的 `ExpenseDialog`，停止推倒式重構，專注於 Tailwind v4 樣式標準化與全域動效，取得最高穩定度與安全 ROI。
- **原子日期平移與雙向位移引擎 (Atomic Date Range Shift & Protection)**: 後端 `PATCH /api/trips/{trip_id}/dates` 端點，出發日提前採逆序迭代，延後採正序迭代，行程縮短提供 `merge` 與 `delete` 雙重保護。
- **HTML5 標籤語意合法性與按鈕解耦 (Decoupled Button DOM Architecture)**: 卡片容器內部點擊進入與操作列按鈕（PDF、退出、刪除）在 DOM 層級完全解耦為同級 Sibling，徹底根除 `<button>` 嵌套違規。
- **Playwright 獨立 E2E 守門套件 (Isolated E2E Playwright Suite)**: 透過 `playwright.config.ts` 將測試隔離至 `./tests`，並新增 `create_trip_flow` 與 `tools_view_flow` 覆蓋 6 大測試套件。
- **母體區域繼承原則 (Mother Region Inheritance)**: 行程景點地理編碼以母體目的地中心點為 Proximity Bias，國碼獨立解析注入，解決 Photon 不含 `country` 欄位導致 `dest_country` 永遠為 `None` 的 P0 隱患。
- **天數物理可見性雙向防衛 (Physical Visibility Defense)**: 前端天數分頁以 `Math.max(日期天數, 資料庫景點天數)` 渲染，後端 `save_itinerary` 與 `ai.py` 強制以 `max_day` 動態展延 `end_date`。
- **System 2 深度研究 Agent 上線**: 整合 Travelpayouts 即時票價數據與 Gemini 3.7 Flash 思考推論模式，前端支援非同步輪詢進度卡片與一鍵轉入行程匯入器。
- **Tiered Memory 架構與原生 CLI 轉移**: 改用原生 Antigravity CLI (`agy`) 作為神經壓縮引擎，非同步 Daemon 採用非阻塞 `asyncio.create_subprocess_exec` 呼叫 `agy`（含 `%LOCALAPPDATA%\agy\bin\agy.exe` 動態尋址），防止 Event Loop 阻塞。
- **AI Recombination 神經融合機制**: 記憶壓縮採用 AI 重組融合模式取代傳統覆寫 (Overwrite)，無縫整合新舊日誌並確保 `[Technical Debt]` 區塊持續累積追蹤。
- **神經注入與跨平台極限防呆**: 實作 `argparse` 支援高層級工作流實體報告注入；使用 `safe_print` 包裹 `sys.stdout` 避免 Windows 背景服務崩潰；修復 Python 3.11 f-string 語法相容性與 `TrustedHostMiddleware` 白名單 (加入 `testserver`)。

## [Failed Paths]
- **Framer Motion 動態 Key 引發元件重新掛載與重複請求**: 在 `app-shell.tsx` 中為四大視圖外層加上 `key={`view-${activeView}`}` 時，導致換頁時 React 銷毀重新掛載引發 API 重複發送。教訓：常駐型主頁面切換動效嚴禁使用動態 `key`，應使用靜態標識搭配屬性動畫。
- **測試選擇器依賴特定 Tailwind 類別字串 (`z-[100]` vs `z-100`)**: Tailwind v4 utility token 升級時， Playwright 測試選擇器若以 `.z-\\[100\\]` 尋找元素會導致測試失敗。教訓：測試選擇器應優先使用角色 (`role`)、`aria-label` 或組合選擇器（如 `.fixed.z-100, .fixed.z-\\[100\\]`）。
- **Language Server 記憶體緩存落後引發的假性紅字 (In-Flight Document Buffer De-sync)**: AI 工具在毫秒級寫檔時，IDE Language Server 捕獲中間狀態會產生假性紅字。遇到此狀況絕對不要點 Overwrite，應關閉分頁或執行 Revert File。
- **Playwright 預設掃描目錄與 Vitest 單元測試衝突**: Playwright 預設遞迴掃描專案內所有 `*.test.ts` 誤載 Vitest CommonJS 測試檔導致報錯。必須透過配置檔明確劃分測試範圍。
- **GFE 逾時引發的偽性 CORS 誤診**: 連線在到達 FastAPI Middleware Stack 前被 Google Front End 依據 60s 逾時強制斷開回傳不帶 CORS Headers 的 504 頁面。修改程式碼層 CORS Middleware 無效，根因在於基礎設施層逾時配置。
- **CI/CD 覆寫雲端手動設定**: Console Web UI 調整參數會在 Git Push 觸發 `gcloud run deploy` 時被 YAML 覆寫。所有基礎設施調優必須於 Workflow 中同步落地。
- **Photon 回傳結構盲區**: 錯誤假設 Photon/Nominatim 的回傳結果包含 `country` 欄位。取用欄位前必須直接檢驗 API 回傳原始結構。
- **前端預設值覆蓋後端推算**: 前端在儲存行程時盲目將 `end_date` 兜底為 `today`，導致後端跳過多天數自動推算邏輯。
- **OSM Nominatim 併發限速衝突**: OpenStreetMap Nominatim 官方限速 1 req/s，AI 批次 5 並發查詢觸發 429 或 ReadTimeout。第三方免費用量受限服務必須有前置命中跳過條件。
- **「看見黑影就開槍」的過度工程陷阱**: 未經驗證誤判 SDK 回傳 `FunctionCall` 警告為 `thought_signature` 遺失，進而撰寫龐大無效的序列化補丁導致 CI 崩潰。架構修改前必須執行活體實驗 (Live Probing)。

## [Technical Debt]
- **Radix DialogContent a11y 補充**: 部分彈窗缺少 `aria-describedby` 或 `Description` 產生 Accessibility Warning，需補齊 `<DialogDescription>`。
- **AI 座標精準度觀測**: 需持續觀察 AI 在冷門景點給出經緯度之偏差值，評估是否需要在 DB 標註 `is_ai_inferred` 供使用者校對。
- **Nominatim 呼叫前置守衛**: 當 Photon 或 LANDMARKS 已取得高置信度結果時，完全略過 Nominatim 網路請求以減少控制台 Warning 與網路延遲。
- **Metrics/Timeout 測試跳過**: `test_poi_lifespan.py` 使用 `@pytest.mark.skip` 暫時略過了未實作的 Metrics 與 Timeout 測試案例，待後續 Sprint 補齊。
- **Dependabot 漏洞修補**: Default branch 存在 1 個 Low severity 安全漏洞，需排程升級相依性。
- **PWA 快取與 Core Web Vitals 監控**: 監控生產環境在 PWA 離線模式下的快取命中率與 Core Web Vitals (INP / LCP / CLS) 表現。

## [Vocabulary]
- **Continuous Multi-Month Calendar**: iOS Swift 風格連續縱向多月份滾動日曆區間選擇器。
- **Atomic Date Range Shift**: 原子日期平移，出發日與結束日平移時同步將所有子項目天數逆序/正序移動並保障截斷資料。
- **Decoupled Button DOM Architecture**: 解耦按鈕 DOM 架構，避免按鈕巢狀包覆造成 HTML5 規格衝突。
- **Inline Coordinates with Dynamic Fallback**: AI 直出座標伴隨動態補漏，兼顧極速生成與邊緣景點高可用性的坐標解析架構。
- **Presentation Layer Truncation Separation**: 表現層截斷分離，保持資料層語義完整性，字數截斷完全由 CSS 控制。
- **Infra-as-Code Authority**: 基礎設施程式碼權威，雲端執行時配置以 CI/CD Workflow 定義為唯一真實來源。
- **Mother Region Inheritance**: 母體區域繼承，以行程整體目的地中心點作為所有子景點 Proximity Bias 錨點的空間收斂架構。
- **Physical Visibility Defense**: 物理可見性防衛，天數分頁以資料庫景點實際最大天數為保底，防止日期字串截斷 UI 顯示。
- **Auto Dream**: 負責在背景自動壓縮或手動融合記憶的神經網路服務腳本。
- **AI Recombination**: 大腦記憶壓縮重組模式，使新舊日誌無縫融合並保留歷史脈絡與技術債。
- **Zero-Remount View Animation Architecture**: 無狀態銷毀的視圖動畫架構，靜態標識搭配 animate 屬性驅動位移，確保 0 重複 API 請求與生命週期穩定。
- **Pragmatic Stabilization over Over-Execution**: 精準微拋光穩定策略，對於高密度複雜邏輯元件停止推倒重構，專注於樣式標準化與穩定 ROI。
- **Dual Save Destination Engine**: 雙向儲存目標分流引擎，支援 AI 解析結果建立為全新行程或合併至現有行程。
- **Direction-Aware Spring Transition**: 方向感知彈簧滑入轉場，依據 Tab 索引動態計算方向並驅動 iOS 原生彈簧滑入動畫。