## [Decisions]
- **AI 座標直出 + 動態 Fallback 雙層保障 (Inline Coordinates with Dynamic Fallback)**: AI 生成行程時直接輸出經緯度座標（精度小數點後 4 位），後端 `_safe_geocode`（Semaphore 10 + 2.5s 硬熔斷）僅對座標缺失或為 0 的景點進行補查，省去 80%+ 外部 API 網路延遲。
- **表現層截斷與資料層無損分離 (Presentation Layer Truncation Separation)**: 資料傳輸與儲存層保持 100% 原始語義完整性，移除後端硬性 57 字截斷，溢出隱藏完全由前端 CSS (`line-clamp-2`, `truncate`) 控制。
- **基礎設施宣告權威性原則 (Infra-as-Code Authority)**: 雲端資源參數（如 Cloud Run `--timeout 600s`）必須在 `.github/workflows/deploy-backend.yml` 宣告，杜絕手動 Console 調整後被 CI/CD 管線無預警洗回。
- **全景行程總覽模式 (Full-Trip Master Overview)**: 確立「全部 (ALL) / 行程總覽」為核心演進目標，支援多天點燈全景地圖軌跡、每日摘要卡片與總預算/體力智慧分析，讓旅人一秒俯瞰多天全局。
- **母體區域繼承原則 (Mother Region Inheritance)**: 行程景點地理編碼以母體目的地中心點為 Proximity Bias，國碼解析以確定性關鍵字直接獨立解析注入，解決 Photon 回傳結果不含 `country` 欄位導致 `dest_country` 永遠為 `None` 的 P0 隱患。
- **天數物理可見性雙向防衛 (Physical Visibility Defense)**: 前端天數分頁以 `Math.max(日期天數, 資料庫景點天數)` 渲染，後端 `save_itinerary` 與 `ai.py` 強制以 `max_day` 動態展延 `end_date`，徹底解決多天行程被截斷為 1 天且需手動按加號的幽靈行程問題。
- **System 2 深度研究 Agent 上線**: 整合 Travelpayouts 即時票價數據與 Gemini 3.7 Flash 思考推論模式，前端支援非同步輪詢進度卡片與一鍵轉入行程匯入器。
- **Tiered Memory 架構與原生 CLI 轉移**: 放棄外部 MCP CLI 依賴，全面改用原生 Antigravity CLI (`agy`) 作為神經壓縮引擎。在非同步 Daemon 中採用非阻塞 `asyncio.create_subprocess_exec` 呼叫 `agy` (包含 `%LOCALAPPDATA%\agy\bin\agy.exe` 動態尋址)，防止 Event Loop 阻塞。
- **AI Recombination 神經融合機制**: 記憶壓縮採用 AI 重組融合模式取代傳統覆寫 (Overwrite)，無縫整合新舊日誌並確保 `[Technical Debt]` 區塊持續累積追蹤。
- **神經注入與跨平台極限防呆**: 實作 `argparse` 支援高層級工作流實體報告注入；使用 `safe_print` 包裹 `sys.stdout` 避免 Windows 背景服務崩潰；修復 Python 3.11 f-string 語法相容性與 `TrustedHostMiddleware` 白名單 (加入 `testserver`)。

## [Failed Paths]
- **GFE 逾時引發的偽性 CORS 誤診**: 連線若在到達 FastAPI Middleware Stack 前即被 Google Front End (GFE) 依據 60s 逾時強制斷開，瀏覽器只會收到不帶 CORS Headers 的 504 頁面並拋出 CORS 錯誤。修改代碼層 CORS Middleware 毫無作用，根因在於基礎設施層逾時配置。
- **CI/CD 覆寫雲端手動設定**: 在 GCP Console Web UI 調整參數（如 Request Timeout）會在下一次包含 `backend/**` 的 Git Push 觸發 GitHub Actions 時被 `gcloud run deploy` 覆寫回 YAML 預設值。所有基礎設施調優必須於 Workflow 檔案中同步落地。
- **Photon 回傳結構盲區**: 錯誤假設 Photon/Nominatim 的回傳結果物件中包含 `country` 欄位，導致取值永遠為 `None`。核心教訓：取用欄位前必須直接檢驗 API 回傳原始結構，不可依賴直覺假設。
- **前端預設值覆蓋後端推算**: 前端在儲存行程時盲目將 `end_date` 兜底為 `today`，導致後端收到有效字串而跳過 `elif request.items:` 的多天數自動推算。
- **OSM Nominatim 併發限速衝突**: OpenStreetMap Nominatim 官方限速 1 req/s，AI 批次 5 並發查詢時會觸發 429 或 ReadTimeout。第三方免費用量受限服務必須有前置命中跳過條件。
- **「看見黑影就開槍」的過度工程陷阱**: AI 代理看見 SDK 回傳 `FunctionCall` 警告訊息，未經驗證便誤判為 `thought_signature` 遺失所致，進而撰寫龐大無效的序列化補丁導致 CI 崩潰。核心教訓：架構修改前必須利用小腳本執行「活體實驗 (Live Probing)」，禁止憑空想像。

## [Technical Debt]
- **AI 預估座標精準度觀測**: 需持續觀察 AI 在冷門景點給出經緯度之偏差值，評估是否需要在 DB 標註 `is_ai_inferred` 供使用者校對。
- **Nominatim 呼叫前置守衛**: 當 Photon 或 LANDMARKS 已取得高置信度結果時，完全略過 Nominatim 網路請求以減少控制台 Warning 與網路延遲。
- **Radix DialogContent 無障礙警告**: 修復瀏覽器控制台對 `DialogContent` 缺少 `Description` 或 `aria-describedby` 的 Accessibility Warning。
- **Metrics/Timeout 測試跳過**: `test_poi_lifespan.py` 使用 `@pytest.mark.skip` 暫時略過了未實作的 Metrics 與 Timeout 測試案例，待後續 Sprint 補齊。
- **Dependabot 漏洞修補**: Default branch 存在 1 個 Low severity 安全漏洞，需排程升級相依性。

## [Vocabulary]
- **Inline Coordinates with Dynamic Fallback**: AI 直出座標伴隨動態補漏，兼顧極速生成與邊緣景點高可用性的坐標解析架構。
- **Presentation Layer Truncation Separation**: 表現層截斷分離，保持資料層語義完整性，字數截斷完全由 CSS 控制。
- **Infra-as-Code Authority**: 基礎設施程式碼權威，雲端執行時配置以 CI/CD Workflow 定義為唯一真實來源。
- **Mother Region Inheritance**: 母體區域繼承，以行程整體目的地中心點作為所有子景點 Proximity Bias 錨點的空間收斂架構。
- **Physical Visibility Defense**: 物理可見性防衛，天數分頁以資料庫景點實際最大天數為保底，防止日期字串截斷 UI 顯示。
- **Auto Dream**: 負責在背景自動壓縮或手動融合記憶的神經網路服務腳本。
- **AI Recombination**: 大腦記憶壓縮重組模式，使新舊日誌無縫融合並保留歷史脈絡與技術債。