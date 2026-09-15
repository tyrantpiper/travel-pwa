## [Decisions]

### 1. 圖形、地圖與 WebGL 架構 (Graphics, MapLibre & WebGL)
- **MapLibre 宣告式圖層拓撲優先原則 (Declarative Layer Precedence)**: 在 React 宣告式渲染中，JSX 必須依物理由底至頂排列（底圖衛星/向量 ➔ 中間彩帶軌跡 ➔ 頂層自訂 Marker Pin）。禁止在前面圖層宣告 `beforeId` 指向尚未宣告的後續同級圖層，避免引發 `Cannot add layer before non-existing layer` 致命白屏；`beforeId` 僅能參照底圖 Base Style 內已預載的圖層。
- **CSP Web Worker 同源靜態管線標準化 (MapLibre CSP Worker Pipeline)**: 堅決不放寬 CSP 安全標頭（不用 `unsafe-eval` 或動態 blob）。透過 `frontend/scripts/copy-maplibre-worker.mjs` 與 npm `prebuild` hook，自動將 `maplibre-gl-csp-worker.js` 同步至 `public/` 目錄，組件宣告 `maplibregl.workerUrl = '/maplibre-gl-csp-worker.js'` 同源派發。
- **WebGL Canvas 與浮動手勢雙向硬體隔離 (Hardware Composite Decoupling)**: 拖曳節點若直接以 CSS `right/bottom` 修改座標，會觸發 Blink/WebKit 主執行緒 Layout Reflow，迫使 GPU 重新繪製整張大尺寸 WebGL Canvas 導致掉幀至 20fps。規範：地圖容器使用 `transform-gpu will-change-transform` 固定為獨立合成層，拖曳節點宣告 `transform-gpu` 並動態切換 `willChange: isDragging ? "right, bottom" : "auto"`，達成 60fps 絲滑拖曳。
- **景點抽屜容器內錨定原則 (Container-Anchored Sheet Decoupling)**: 在全景或總覽地圖中，景點抽屜必須支援 `isInternal={true}` 模式，將容器限制在地圖內部（`absolute bottom-0`）而非視窗層級（`fixed inset-0`），防止抽屜破壞全域導航列與 Header。
- **大圓航線球面線性插值 (Great-Circle Slerp Interpolation)**: 跨天或長途城際移動軌跡禁止在平面上直連線條。透過 `geo-multi-day.ts` 純函數庫進行球面幾何插值，依天數動態映射高對比飽和色彩池（Day 1~5: Emerald, Blue, Violet, Pink, Amber）。
- **雙套件依賴強耦合原子升級鎖 (Coupled Dependency Atomic Lock)**: `react-map-gl` 與 `maplibre-gl` 存在深層私有 API（內部 transform 實例）綁定，嚴禁獨立升級單一套件。未來升級必須視為「原子包 (Atomic Pair)」同步評估與實機雙重核驗。
- **務實穩定勝於盲目追新原則 (Pragmatic Stabilization over Chasing SemVer Major)**: 在核心商業邏輯未受阻且維持 0 安全漏洞前提下，不為了追求版本號承擔生態斷層與 WebGL1 淘汰的代價。
- **本地真機活體驗收守門 (Local Native Probing Gate)**: Node.js / JSDOM 單元測試無法模擬真實 WebGL Context。凡涉及圖形渲染、地圖底圖與事件循環的核心變更，必須在本地真機瀏覽器確認無誤後方可提交。

### 2. 狀態持久化、SWR 快取與自癒機制 (State, SWR, Routing & Self-Healing)
- **雙重核驗型別化自癒架構 (Double-Checked Silent Self-Healing)**: 分散式快取自癒嚴禁僅憑單次 HTTP 404 就草率清除快取（避免網路抖動導致正常行程被誤判跳轉）。必須透過「行程總清單存活二次核驗（List Double-Check）」證實死透後，才在 300ms 內完全靜默導正至最新有效行程。
- **SWR 404 立即熔斷機制 (Zero-Retry 404 Guard)**: HTTP 404 屬於明確的客戶端資源不存在，在 SWR `onErrorRetry` 中強制判定 `error.status === 404` 立即終止重試，將無效請求次數由 19 次嚴格降為 0，消除伺服器冷啟動風暴。
- **型別化 HTTP 錯誤傳遞 (Typed HttpError Propagation)**: 原生 fetch 遇 4xx/5xx 不會 reject Promise，底層 Fetcher 必須主動檢查 `!r.ok` 並拋出標準 `HttpError(status, detail)`，防止上層快取引擎將 404 誤當作合法資料寫入快取而使自癒啞火。
- **本地快取雙清原則 (Dual-Storage Coherence)**: 同時使用 Zustand `persist`（`trip-storage`）與舊版 Storage（`active_trip_id`）時，自癒清理必須以 Zustand store action 為單一真實來源並同步清理 legacy 鍵，杜絕重新整理後狀態還原。
- **暫時性目標參數脫敏與防震盪機制 (Ephemeral Target Parameter Cleanup)**: 在完成定位調度後，立即調用 `window.history.replaceState` 將 `expense_id` 從網址列拔除，達成「單次消費即銷毀」的冪等性保護，防止使用者 F5 重新整理時反覆重播定位動畫。
- **深層天數意圖優先於預設天數之階層判定 (Day-Zero Overview Precedence)**: 確立「外部明確意圖（Deep Link URL / Intent Store） > 內部預設落地值（Day 1）」的優先順序模型，成功解鎖推播直達 `day=0` 行程封面總覽卡片。
- **虛擬化清單篩選器穿透機制 (Filter Penetration on Deep Link)**: 虛擬化長清單（React Virtuoso）尋址時，消費端必須具備「前置篩選器自動歸零」的穿透權威，隨後調用虛擬列表內部控制代碼 `virtuosoRef.current.scrollToIndex` 達成 100% 精準尋址，嚴禁調用 DOM 原生選擇器。
- **表現層截斷與資料層無損分離 (Presentation Layer Truncation Separation)**: 資料傳輸與儲存層保持 100% 原始語義完整性，字數截斷完全由前端 CSS (`line-clamp-2`, `truncate`) 控制。
- **天數物理可見性雙向防衛 (Physical Visibility Defense)**: 前端天數分頁以 `Math.max(日期天數, 資料庫景點天數)` 渲染，後端 `save_itinerary` 與 `ai.py` 強制以 `max_day` 動態展延 `end_date`，防止日期字串截斷 UI 顯示。
- **長耗時外部網路請求全域狀態機解耦與 In-Flight 去重 (Decoupled Global Write & Deduplication)**: 在頻繁重繪架構下，非同步長耗時請求（如 Open-Meteo API）嚴禁寫入組件局部 state 或依賴 `isMounted` 閉包；必須由獨立模組寫入全域狀態機（Zustand store），並維護 In-Flight Promise 池避免相同座標重複請求。組件僅在渲染階段以響應式 selector 讀取，杜絕組件因父層 SWR 抖動卸載後誤殺回傳資料。
- **本地時區安全日期鍵規範 (Local Timezone Date Safety)**: 使用 `new Date().toISOString().split("T")[0]` 在 UTC+8 深夜 00:00~08:00 會回傳前一天的 UTC 日期造成快取鍵與本地行程錯位。前端所有快取鍵與日期排程統一採用 `new Date().toLocaleDateString('en-CA')` 對齊客戶端本地時區。
- **骨架屏硬逾時優雅降級 (Hard-Timeout Skeleton Fallback)**: 依賴非同步遠端資料的骨架屏（如 `DailyWeatherStrip`），嚴禁無限期 pulse 閃爍。必須內建 4 秒硬逾時定時器，連線中斷或逾時自動切換至「暫無氣象資料 · 重試」狀態並支援手動重新整理。

### 3. iOS 原生體驗、微動效與 UI 元件架構 (iOS Ergonomics, Motion & Decoupled UI)
- **WebKit 匿名文字節點隔離與 Flex 寬度守護 (Text-Node Isolation Architecture)**: 在 Flex 容器中，裸露文字搭配 `truncate` 會在 WebKit 引擎下產生匿名文字方塊（Anonymous Block Box），在 390px 窄螢幕下壓縮同級 `shrink-0` 標籤。架構上確立動態文本必須封裝於獨立 `<span className="truncate">` 節點中，與同級元素形成明確 DOM 邊界。
- **iOS 原生雙擊鑽取心智模型 (Tap-to-Focus, Tap-again-to-Drilldown)**: 在空間極度受限的行動裝置地圖頂部，杜絕塞入臃腫跳轉按鈕。初次點擊切換天數聚焦軌跡並浮現箭頭（`🟢 Day 1 ➔`），再次點擊已選中項觸發平滑滾動（Smooth Scroll）直達卡片。
- **解耦按鈕 DOM 架構 (Decoupled Button DOM Architecture)**: HTML5 嚴禁 `<button>` 嵌套 `<button>`。卡片容器內部點擊進入與操作列按鈕（PDF、退出、刪除）在 DOM 層級完全解耦為同級 Sibling 節點。
- **無狀態銷毀的視圖動畫架構 (Zero-Remount View Animation Architecture)**: `<motion.div>` 使用靜態標識搭配屬性動畫驅動位移，四大主頁面常駐且永不銷毀，達成 0 重複 API 請求與 100% 滾動位置記憶。
- **iOS Swift 全域雙向滑動轉場與觸控防衛 (Direction-Aware Spring Transitions & Touch Guards)**: `app-shell.tsx` 導入方向感知索引與彈簧滑入 (`x: ±28px`)；全域注入 `select-none` 消除長按選取文字問題，底部導航搭配 `haptic.selection()` 原生震動與 `active:scale-95` 反饋。
- **連續多月份滾動日曆區間選擇器 (Continuous Multi-Month Calendar)**: 採用連續縱向雙向滾動日曆 (`CalendarRangeSheet`) 搭配 Sticky 月份標題與快速跳轉，取代零散前後加減天數按鈕；在 Day 0 建立 `TripMasterOverview` 儀表板。
- **合成點擊與拖曳手勢競態防衛 (Drag-Release Synthetic Click Race-Condition Guard)**: 透過 `hasMovedRef` 追蹤位移並於 `handleDragEnd` 中設置 80ms 延遲釋放閥，徹底杜絕拖曳完放開手指誤開面板的手勢衝突。
- **輸入法組合態攔截與自適應高度防線 (IME Composition Guard & Auto-Growing Textarea)**: 中文（注音/倉頡/拼音）與日文選字時，輸入框全面升級為自適應高度 `<textarea>`（`min-h-9 max-h-32`），並在 `onKeyDown` 嚴格掛載 `if (e.nativeEvent.isComposing) return`，防止提前觸發發送。
- **高密度對話組件原地微創升級原則 (In-Place Surgical Modernization over Premature Component Splitting)**: 對於承載 12+ 項複雜閉包的高密度邏輯組件（如 `chat-widget.tsx`、`ExpenseDialog.tsx`），堅決抵制盲目拆檔，改以原地微創升級保持閉包穩定，取得最高穩定度與安全 ROI。

### 4. 離線架構與 PWA 快取 (Offline, Service Worker & PWA)
- **站在既有巨人肩膀上的輕量化離線原則 (Shoulder-of-Giants Offline Architecture)**: 拒絕盲目引入 PowerSync 或 RxDB 等肥大客戶端複寫引擎，完全立足於專案既有的 `serwist`、`idb-keyval` 與 `SWRConfig provider` 官方標準模式，以最小代碼增量完成離線優先秒開閉環。
- **動脈與靜脈讀寫分流架構 (Arterial/Venous Read-Write Decoupling)**: 在 Service Worker 層將 GET 查詢（SWR 快取）與 POST/PUT/PATCH/DELETE 突變（BackgroundSync 離線重試）物理隔離，杜絕突變請求被快取誤吞或 GET 查詢誤進背景佇列。
- **PWA 帶參冷啟動導航防線 (Ignore-Search Navigation Pipeline)**: 手機 Standalone PWA 啟動或推播跳轉常帶有 `/?source=pwa` 或查詢參數。Service Worker `app-shell-navigation` 必須宣告 `matchOptions: { ignoreSearch: true }`，且導航逾時緊縮至 2s，確保離網冷啟動 100% 命中 App Shell 快取，防止字串嚴格比對失敗拋出瀏覽器小恐龍。
- **行程上下文離線防自我抹殺雙守衛 (Offline Trip Non-Destructive Invariance)**: SWR 在斷網或 API 異常時回傳的空陣列不可作為「使用者無行程」之業務假設；`trip-context.tsx` 強制守衛 `isDefinitelyOnline && !isError`，只有確實在線且無錯誤時才允許清空當前行程，斷網狀態死守本機現存 ID 與 localStorage。
- **SWR ES6 Proxy 防抖硬碟持久化 (L2 IndexedDB Auto-Persistence)**: 透過 `createPersistedCacheMap()` 以 ES6 Proxy 攔截 SWR 成功寫入操作，1500ms 防抖自動序列化持久化至 IndexedDB `tabidachi_swr_persisted_cache`，冷啟動重啟秒出。
- **既有 Client 喚醒與內部事件廣播 (Smart Tab Focus & Push Navigation)**: 推播點擊由暴力 `client.navigate()` 重載升級為 `client.focus()` 喚醒分頁，並透過 `client.postMessage({ type: "TABIDACHI_PUSH_NAVIGATE", url })` 內部廣播，由 `useDeepLinkRouter` 實現無刷新平滑切換，保留當前滾動位置與編輯狀態。
- **以體驗為先解鎖圖片快取容量 (Experience-First Media Cache Unlocking)**: 外部景點圖片上限擴充至 300 張（約 30MB），保障出國離線重度使用體驗，並透過 Cloudflare Worker 反向代理注入 `Access-Control-Allow-Origin: *`，防止 Safari 7~10MB Opaque 填充配額爆炸。
- **離線快取真因釐清與過度工程化及時熔斷 (Over-engineering Circuit Breaker)**: 開發模式 (npm run dev) 預設阻斷 Service Worker 註冊以保護 HMR 免受污染，測試 PWA 離線能力應走標準生產預覽流程 (npm run build && npm start)，嚴禁盲目跨層在 RootLayout 注入 raw HTML/CSS inline splash 等破壞 Next.js 架構純潔性的補丁。

### 5. 後端高併發、資料庫與健康架構 (Backend Concurrency, Supabase & Health Probes)
- **純記憶體存活探針與獨立保活解耦架構 (Zero-Blocking Health & Keep-Alive Decoupling)**: `/health` 端點堅持 0ms 純記憶體計算（單一職責原則），完全不觸發任何外部網路 I/O 或資料庫查詢；Supabase 7 天防休眠保活由 Lifespan 獨立非同步背景定時循環（每 6 小時一次）靜默守護，達成極限並發安全與 100% 外部監控免疫。
- **三層健康檢查分流機制 (Tri-Tier Health Probe Hierarchy)**: `/health` 作為 Liveness Probe 提供 0ms 純記憶體快速探針；`/health/deep` 作為 Readiness/Diagnostics Probe 提供帶 2.5s 硬熔斷的非同步 Supabase 深度檢查。
- **後端時間處理時區原子一致性 (Timezone-Aware Atomicity)**: 伺服器啟動時間與每次請求計算必須同步採用 `timezone.utc`，杜絕因 naive/aware 混用導致的 TypeError 致命崩潰。
- **AI 座標直出 + 動態 Fallback 雙層保障 (Inline Coordinates with Dynamic Fallback)**: AI 生成行程時直接輸出經緯度座標（精度小數點後 4 位），後端 `_safe_geocode`（Semaphore 10 + 2.5s 硬熔斷）僅對座標缺失或為 0 的景點進行補查，省去 80%+ 外部 API 網路延遲。
- **母體區域繼承原則 (Mother Region Inheritance)**: 行程景點地理編碼以母體目的地中心點為 Proximity Bias，國碼獨立解析注入，解決 Photon 不含 `country` 欄位導致 `dest_country` 永遠為 `None` 的 P0 隱患。
- **原子日期平移與雙向位移保護 (Atomic Date Range Shift & Protection)**: 後端 `PATCH /api/trips/{trip_id}/dates` 端點，出發日提前採逆序迭代，延後採正序迭代，行程縮短提供 `merge` 與 `delete` 雙重保護。

### 6. CI/CD、工程化守門與自動化 (DevOps, Quality Gates & Tooling)
- **PowerShell 確定性熔斷守門架構 (Fail-Fast PowerShell Execution Harness)**: 在 Windows 環境下，嚴禁依賴非熔斷的 `;` 或無效的 `&&` 串接指令。所有工作流與守門腳本必須明確宣告 `$LASTEXITCODE` 檢查（`if ($LASTEXITCODE -ne 0) { exit 1 }`），確保任何一級（TypeScript、ESLint、Vitest、Pytest）失敗時能立即物理中斷，杜絕偽綠燈提交。
- **雙模 AST/正則防禦架構 (Dual-Mode AST/Regex Audit Pipeline)**: 對於 JSX 樹狀結構複雜的樣式反模式（如 Flex Truncate 匿名區塊、Virtuoso 直接 DOM 操作），放棄過度工程化的單一 AST 比對，採 AST 節點鎖定搭配正則約束，兼顧精確度與零偽陽性。
- **三重活體驗收防線 (Tri-Layer Verification Protocol)**: 底層依賴與編譯鏈更新時，驗收絕不能僅停留在靜態型別層（tsc），必須串聯 npm audit、vitest 與 next build 進行真實驗收。
- **overrides 原地安全合併原則 (In-Place Override Merging)**: 在既有 package.json 配置依賴覆蓋時，嚴禁盲目新增重複鍵，必須採增量原地合併以保留既有修復，杜絕 JSON 語法解析錯誤。
- **基礎設施宣告權威性原則 (Infra-as-Code Authority)**: 雲端資源參數（如 Cloud Run `--timeout 600s`）必須在 `.github/workflows/deploy-backend.yml` 宣告，杜絕 Console 手動設定被 CI/CD 無預警洗回。
- **Tiered Memory 架構與神經重組 (Auto Dream & AI Recombination)**: 大腦記憶維護採用分層神經壓縮模式，以原生 Antigravity CLI 驅動，新舊日誌無縫融合並保留歷史脈絡與技術債。

---

## [Failed Paths]

### 1. 圖形與地圖渲染踩坑
- **MapLibre v6 內部相機屬性移除 (`Unbound Transform Trap`)**: MapLibre v6 移除了 `map.transform`，而 `react-map-gl@8.1.0` 在 `transformToViewState` 中強依賴此屬性，造成執行時拋出 `TypeError: Cannot read properties of undefined (reading 'center')` 致命白屏。教訓：涉及包裝層（Wrapper Lib）的底層核心函式庫 Major 升級，不能只看 TypeScript 定義，必須深入檢查包裝層是否已對內部重構提供完整適配。
- **動態 Blob Worker 遭 CSP 攔截 (`Worker Blob CSP Trap`)**: 直接在客戶端使用 `new Worker(URL.createObjectURL(blob))`，在嚴格 CSP 標頭下遭瀏覽器拋出 `Refused to create a worker from 'blob:...'` 阻擋。教訓：第三方函式庫 Web Worker 必須走同源靜態檔案管道（`copy-maplibre-worker.mjs`）派發。
- **未宣告圖層指定 beforeId 引發崩潰 (`Premature beforeId Reference Trap`)**: 在 JSX 中宣告底層衛星影像時指定 `beforeId="day-trajectories-layer"`，但該圖層在 JSX 代碼中寫在衛星之後，MapLibre 依序解析引發 `Cannot add layer before non-existing layer` 致命錯誤。教訓：React-map-gl 圖層宣告應善用自然 JSX 階層排列，切忌跨越宣告順序參考不存在的圖層 ID。
- **拖曳手勢誘發 WebGL Canvas 重排掉幀 (`Unisolated WebGL Reflow Trap`)**: 拖曳以 `right/bottom` 定位的浮動圓球，未開啟硬體加速時會誘發主執行緒重新計算佈局並重繪大型地圖 WebGL Canvas，導致拖曳掉幀至 20fps。教訓：包含 WebGL 地圖的複雜視圖中，浮動動態節點必須明確宣告 `transform-gpu` 與動態 `will-change`，建立獨立 GPU 合成層。
- **JSDOM / SSR 建置通過帶來的偽陽性安全感 (`WebGL Canvas Testing Blind Spot`)**: `tsc --noEmit` 與 `vitest` 在 Node.js / JSDOM 環境下無法模擬真實 WebGL 上下文與 Canvas 交互，誤導做出「升級通過」的斷言。教訓：WebGL 與 Canvas 相關改動必須以瀏覽器真實繪製為唯一驗收標準。

### 2. 狀態持久化、快取與自癒踩坑
- **原生 fetch 吞沒 404 引發 SWR 假成功 (`Raw Fetch 404 Swallowing Trap`)**: 在 fetcher 中直接使用 `fetch().then(r => r.json())` 未檢查 `r.ok`。後端回傳 404 時 Promise 依然正常 resolve，SWR 將 `{ detail: "Trip not found" }` 判定為成功資料寫入快取，導致 `error` 永遠為 `undefined`，SWR 的 `onErrorRetry` 與自癒完全啞火。教訓：所有底層 Fetcher 必須嚴格檢驗 `!r.ok` 並主動拋出標準 `HttpError`。
- **未經二次核驗草率清除快取 (`Unverified 404 Eviction Trap`)**: 僅憑一次 GET 404 就直接清除本地快取並切換行程，在行動網路偶發抖動或 CDN 節點異常時，使用者正在看的合法行程會被誤切換。教訓：自癒機制必須搭配「清單總表二次核驗（List Double-Check）」，確認清單中也查無此人時才允許執行破壞性清除。
- **Zustand 與 legacy localStorage 雙重持久化漂移 (`Dual Persistence Drift Trap`)**: 僅透過 `localStorage.removeItem('active_trip_id')` 清理快取，忽略了 Zustand 的 `persist` 中介軟體仍將舊 ID 儲存在 `trip-storage`，重新整理後死 ID 再次復發。教訓：具備多重持久化機制時，必須以 Zustand store action 為單一真實來源並同步清理 legacy 鍵。
- **傳統 DOM scrollIntoView 在虛擬化清單下的無效陷阱 (`Virtual List Null DOM Trap`)**: 嘗試使用 `document.getElementById('expense-' + id)?.scrollIntoView()` 尋找目標項目。在項目數量超過可視區域時，Virtuoso 尚未將其渲染至 DOM 樹中，`document.getElementById` 必為 `null`。教訓：虛擬化滾動引擎必須使用虛擬庫提供的 Ref Handle（`virtuosoRef.current.scrollToIndex`）進行索引計算與滾動。
- **行程切換無腦重置天數抹除外部深層意圖 (`Blind Day-1 Overwrite Trap`)**: 在 `itinerary-view.tsx` 中監聽 `[activeTripId]` 並直接調用 `setDay(1)`，導致推播傳入的 `day=0` 總覽參數被瞬間覆寫回第一天。教訓：在多狀態驅動視圖中，狀態重置必須檢查當前全域 Store 是否已有高優先順序的顯式指定值。
- **父層 SWR 抖動引發 isMounted 誤殺非同步回傳 (`isMounted Weather Drop Trap`)**: 總覽天氣卡片在 `useEffect` 中發起耗時 1 秒的 Open-Meteo 請求。首次點入時父層 SWR revalidate 觸發 `setDailyLocs`，引發 Effect cleanup（`isMounted = false`），導致氣象回傳時被 `if (!isMounted) return` 丟棄，卡在骨架屏。教訓：長耗時資料抓取應委託全域 Store，回寫全域狀態而非組件局部 state。
- **Zustand 非同步 IDB 靜態取值未響應 (`Zustand Async IDB Silent Trap`)**: `weatherStore` 使用非同步 `idbStorage`，若組件僅呼叫靜態 getter，IndexedDB 完成 rehydrate 後組件無法感知。教訓：組件頂層必須以 `useWeatherStore((s) => s.fiveDayCache)` 響應式訂閱。

### 3. iOS 原生與 UI 元件踩坑
- **Flex 容器未封裝文字直用 truncate 引發擠壓 (`WebKit Anonymous Flex Truncation Trap`)**: 在 Header 直接使用 `className="flex items-center min-w-0 truncate"` 包覆文字與 `<Badge>`，在 WebKit/iOS 渲染引擎下裸文字包入 Anonymous Block，計算寬度時強制將同級 `shrink-0` 徽章壓縮或推出可視範圍。教訓：Flex 容器內的文本溢出截斷，務必單獨由子 `<span className="truncate">` 承擔。
- **推倒式拆檔引發的閉包斷裂與 SWR 快取丟失 (`Premature Component Decomposition Trap`)**: 曾嘗試將 `chat-widget.tsx` 暴力解耦拆分至 3 個獨立組件，導致 `useDynamicPolling`、`prevTripIdRef` 雙清閉包、`textareaRef` 焦點控制以及多個自癒狀態遺失，引發大量測試報錯與死循環震盪。教訓：在缺乏完整抽象層保護前，高耦合高密度邏輯組件應優先採原地微創增強，嚴禁過度工程化的推倒重來。
- **Framer Motion 動態 Key 引發元件重新掛載與重複請求 (`Dynamic Key Remount Trap`)**: 在 `app-shell.tsx` 中為四大視圖外層加上 `key={`view-${activeView}`}` 時，導致換頁時 React 銷毀重新掛載引發 API 重複發送。教訓：常駐型主頁面切換動效嚴禁使用動態 `key`，應使用靜態標識搭配屬性動畫。
- **React 19 在 useEffect 內同步 setState 觸發 cascading renders (`React 19 Cascading Renders Trap`)**: 在 `DailyWeatherStrip` 的 `useEffect` 內若同步呼叫 `setIsTimedOut(false)`，會被 React Compiler 判定為串聯重新渲染引發 Linter 報錯。教訓：改用衍生狀態 `const showTimeoutFallback = isTimedOut && !hasData && !isLoading`，`useEffect` 僅負責逾時定時器生命週期。
- **試圖在 React RootLayout 內嵌 Raw HTML 假裝原生 Splash (`Inline Splash Over-Engineering Trap`)**: 在 Next.js App Router 體系下硬塞 90 行 inline `<style>`、`id="pwa-native-splash"` 與原生 DOM 操作腳本，破壞現代架構純潔性，忽視了真實 PWA 在安裝後會由 OS (iOS/Android) 依據 `manifest.json` 自動渲染原生啟動畫面的基本事實。

### 4. 離線架構與 PWA 踩坑
- **Service Worker 嚴格路徑比對導致帶參冷啟動白屏 (`Strict Navigation URL Mismatch Trap`)**: PWA 從桌面圖示啟動時常攜帶 `?source=pwa`，若 Service Worker 宣告 `navigateFallback` 未開啟 `ignoreSearch: true`，比對失敗直接由瀏覽器發起真實網路請求，在斷網情境下拋出小恐龍死白屏。教訓：離線 App Shell 導航快取必須宣告 `matchOptions: { ignoreSearch: true }`。
- **斷網時誤信 SWR 空清單抹殺本機行程 (`Offline Empty-Array Wipe Trap`)**: 斷網冷啟動時 SWR 請求 `/api/trips` 失敗回退為空陣列，`trip-context.tsx` 誤判使用者無行程而調用 `setActiveTripId(null)` 並清空 localStorage，使整個 App 癱瘓。教訓：斷網時 SWR 狀態不可信，必須嚴格捍衛本機快取與 activeTripId。
- **直接將未過濾的 SWR 快取 Map 序列化至 IndexedDB (`DataCloneError Trap`)**: SWR 內部的 `cacheMap` 包含未決的 Promise、變異調度器與閉包函式，若未經過濾直接對其執行 IndexedDB `set()` 會觸發瀏覽器 `DataCloneError: could not clone` 致命崩潰。教訓：SWR 持久化必須將資料層（Data Snapshot）與排程/Promise 狀態解耦，由 `idb-storage.ts` 定向寫入純乾淨的 JSON 快照。
- **盲目 npm audit fix --force 引發的破壞性降級 (`Serwist Destructive Downgrade Trap`)**: `npm audit fix --force` 試圖將 `@serwist/turbopack` 降級至骨董版本 9.5.2 破壞 Next.js 16 打包。教訓：間接依賴漏洞治理應優先採用 npm 原生 overrides 原地鎖定，杜絕向後降級。

### 5. 後端高併發、資料庫與健康探針踩坑
- **多線程背景調用非 Thread-Safe 的 Supabase Client (`Supabase Client Deadlock`)**: 在 `/health` 每次請求中透過 `asyncio.to_thread` 調用 `supabase.Client`，當 UptimeRobot 多節點併發打入時觸發 `httpcore` 連線池內部死鎖 (Deadlock)，導致全域線程池耗盡、請求掛起 30s 並由 GFE 拋出 500。教訓：禁止在多線程中調用非 Thread-Safe 的同步 SDK，應使用原生非同步 `httpx.AsyncClient` 或將保活與請求完全解耦。
- **健康檢查端點攜帶副作用 (`Health Check Side-Effects Trap`)**: 將資料庫保活或連線預熱強行掛在健康檢查端點上，一旦外部網路波動或連線鎖爭搶，健康檢查連帶失敗導致整台伺服器被誤判死亡。教訓：健康檢查必須保持 Idempotent 與無副作用。
- **後端時間處理時區不一致性 (`Timezone Mismatch Trap`)**: 伺服器啟動時間與請求時間混用 naive/aware，引發 `TypeError: can't subtract offset-naive and offset-aware datetimes`。教訓：全域時間運算統一強制帶有 `timezone.utc` 標籤。
- **Photon 回傳結構盲區 (`Photon Missing Country Trap`)**: 錯誤假設 Photon/Nominatim 的回傳結果包含 `country` 欄位，導致 `dest_country` 永遠為 `None`。教訓：取用欄位前必須直接檢驗 API 回傳原始結構。
- **OSM Nominatim 併發限速衝突 (`Nominatim Concurrency Limit Trap`)**: OpenStreetMap Nominatim 官方限速 1 req/s，AI 批次 5 並發查詢觸發 429 或 ReadTimeout。第三方免費用量受限服務必須有前置命中跳過條件。

### 6. CI/CD、工程化守門踩坑
- **PowerShell 分號串接導致錯誤吞噬與假性放行 (`PowerShell Unhalted Chain Trap`)**: 在 Windows PowerShell 中使用 `cmd1; cmd2; cmd3` 串接指令時，即使 `cmd1` 噴錯，PowerShell 依然會繼續執行後續指令；使用 `&&` 則直接報錯 `The token '&&' is not a valid statement separator`。教訓：Windows 終端工作流必須顯式包裝 `if ($LASTEXITCODE -ne 0) { exit 1 }` 實施嚴格熔斷。
- **粗糙 AST Pattern 比對引發的偽陽性爆發 (`AST Pattern Overmatching Trap`)**: 企圖以單一寬鬆 AST Pattern 比對包含特定 CSS 類別的動態文字標籤，若未指定確切約束，會把全站所有 JSX 文字節點全部誤判。教訓：語法審核必須採約束性 AST 規則（Constraints & Regex）。
- **JSON 重複鍵盲區 (`Duplicate Key Trap`)**: 在已有 overrides 的 package.json 粗暴追加新區塊產生重複鍵語法錯誤。教訓：工程修改前必須嚴格確認既有代碼結構，堅持原地增量合併。
- **GFE 逾時引發的偽性 CORS 誤診 (`GFE 60s Timeout False CORS Trap`)**: 連線在到達 FastAPI Middleware Stack 前被 Google Front End 依據 60s 逾時強制斷開回傳不帶 CORS Headers 的 504 頁面。修改程式碼層 CORS Middleware 無效，根因在於基礎設施層逾時配置。

---

## [Technical Debt]

- **多天總覽 POI Pin 碰撞聚合 (Clustering)**: 當多天行程累積超過 20+ 密集景點時，地圖 Pin 存在重疊遮蔽，待規劃導入 MapLibre 原生向量聚合圓圈或 Zoom Level 動態展延機制。
- **MapLibre 實例與記憶體生命週期監控 (WebGL Context Lifecycle)**: 切換視圖頻繁時需持續監測 WebGL 上下文釋放情況，確保地圖卸載時完整執行 `map.remove()`，杜絕行動端 Safari 報錯 `Too many active WebGL contexts`。
- **離線照片二進位暫存隊列 (Offline Photo Blob Persistence)**: 目前離線隊列對 `FormData`（如現場收據拍照上傳）採取跳過並彈出 Toast 提示的保守策略。未來需支援將照片轉為 IndexedDB Blob 本機排程隊列，待連網時自動重播二進位上傳。
- **氣象 API 伺服器端邊緣快取 (Open-Meteo Edge Cache)**: 目前客戶端直連 Open-Meteo。未來使用者量增長時，應在 FastAPI 後端透過 Redis 實作城市級反向代理快取，減少對第三方服務的依賴。
- **Dependabot #83 安全依賴修復**: Default branch 存在 1 個 Moderate severity 安全漏洞（Dependabot #83），需排程安全升級。
- **Radix DialogContent a11y 補充**: 部分彈窗缺少 `aria-describedby` 或 `Description` 產生 Accessibility Warning，需補齊 `<DialogDescription>`。
- **FastAPI ORJSONResponse 遷移評估**: FastAPI 新版本提出 `FastAPIDeprecationWarning: ORJSONResponse is deprecated`，後續可評估直接交由 Pydantic response_model 序列化。
- **BackgroundSync iOS Safari 降級機制強化**: iOS Safari 原生不支援 W3C Background Sync API，目前依賴 Service Worker 被動重啟。後續可評估在 `SyncManager` 前端組件中監聽 `window.addEventListener('online')` 作為主動觸發保險。

---

## [Vocabulary]

### 1. 圖形與地圖領域
- **Declarative Layer Precedence**: 宣告式圖層順序優先，利用 JSX 物理順序定義 MapLibre 圖層層次而非無效跨層 beforeId。
- **MapLibre CSP Worker Pipeline**: MapLibre 內容安全策略 Worker 建置管線，將 Web Worker 同源靜態化之架構方案。
- **Hardware Composite Decoupling**: 雙向硬體合成層解耦，透過 GPU 合成層隔離浮動節點拖曳與底層 WebGL 重繪。
- **Container-Anchored Sheet Decoupling**: 容器錨定抽屜解耦，將抽屜限制於地圖容器內部避免竄出覆蓋全站 Header。
- **Great-Circle Slerp Interpolation**: 大圓航線球面線性插值，在 2D/3D 平面上以球面幾何學平滑渲染長途跨城軌跡。
- **Coupled Dependency Atomic Lock**: 雙套件依賴強耦合原子升級鎖，將具有深層內部 API 依賴的跨函式庫綁定為單一原子升級單元。
- **Local Native Probing Gate**: 本地真機活體驗收守門，要求涉及圖形渲染與原生 Web API 的重大變更必須通過本機瀏覽器實地驗收。

### 2. 狀態持久化與自癒領域
- **Double-Checked Silent Self-Healing**: 雙重核驗完全靜默自癒，結合 SWR 404 立即熔斷與清單二度核驗，達成 <300ms 無感導正與零誤判防禦。
- **Zero-Retry 404 Guard**: SWR 404 立即熔斷守衛，遇到客戶端資源不存在時重試次數強制歸零，杜絕伺服器冷啟動風暴。
- **Dual-Storage Coherence**: 雙重持久化存儲一致性，跨 Zustand 與 localStorage 雙清以防幽靈 ID 還原。
- **Typed HttpError Propagation**: 型別化 HTTP 錯誤傳遞，強制底層 Fetcher 檢驗 !r.ok 並向外拋出狀態碼。
- **Filter Penetration on Deep Link**: 深度連結篩選器穿透機制，在尋址前自動重置 UI 篩選器以避免目標被遮蔽。
- **Day-Zero Overview Precedence**: 零天總覽優先順序，外部深度連結指定天數優先於預設第 1 天的狀態調度原則。
- **Ephemeral Target Parameter Cleanup**: 暫時性目標參數脫敏，消費完成後立即自 URL 抹除參數以達冪等性。
- **Decoupled Global Write**: 請求生命週期全域解耦寫入，將外部 API 請求由組件局部 state 升級為全域 Store 寫入，避免組件卸載誤殺回傳資料。
- **In-Flight Request Deduplication**: 飛航中請求池去重，以座標/參數為 Key 快取進行中的 Promise，避免多卡片並發重複發送相同請求。
- **Local Timezone Date Safety**: 本地時區安全日期，採用 `toLocaleDateString('en-CA')` 杜絕 UTC 跨日時區漂移。
- **Hard-Timeout Skeleton Fallback**: 骨架屏硬逾時優雅降級，定時終止 pulse 動效並展示友善重試介面。

### 3. iOS 原生體驗與 UI 元件領域
- **Text-Node Isolation Architecture**: 文本節點隔離架構，Flex 容器內將文字單獨封裝於子 span 避免 WebKit 匿名文字區塊破壞同級排版。
- **Tap-to-Focus, Tap-again-to-Drilldown**: iOS 鑽取心智模型，首次點擊聚焦軌跡，再次點擊深入平滑滾動至詳情卡片。
- **Decoupled Button DOM Architecture**: 解耦按鈕 DOM 架構，避免按鈕巢狀包覆造成 HTML5 規格衝突。
- **Zero-Remount View Animation Architecture**: 無狀態銷毀的視圖動畫架構，靜態標識搭配 animate 屬性驅動位移，確保 0 重複 API 請求與生命週期穩定。
- **Direction-Aware Spring Transition**: 方向感知彈簧滑入轉場，依據 Tab 索引動態計算方向並驅動 iOS 原生彈簧滑入動畫。
- **Continuous Multi-Month Calendar**: iOS Swift 風格連續縱向多月份滾動日曆區間選擇器。
- **IME Composition Guard**: 輸入法組合態守衛，在 onKeyDown 檢查 isComposing 防止 CJK 選字誤觸送出。

### 4. 離線架構與 PWA 領域
- **Shoulder-of-Giants Offline Architecture**: 站在既有巨人肩膀上的輕量化離線架構，立足既有 Serwist、idb-keyval 與 SWR 快取規範，達成零冗餘體積的離線優先秒開。
- **Arterial/Venous Read-Write Decoupling**: 動脈與靜脈讀寫分流架構，將 GET 離線讀取與 POST/PUT/PATCH/DELETE 突變寫入在 Service Worker 層物理分離。
- **Ignore-Search Navigation Pipeline**: 忽略查詢參數的離線導航管線，透過 `matchOptions: { ignoreSearch: true }` 保障帶參啟動 PWA 100% 命中 App Shell。
- **Offline Trip Non-Destructive Invariance**: 離線行程不可抹除性，在網路中斷或 API 報錯時守護本地行程資料與選定狀態。
- **Smart Tab Focus & Push Navigation**: 智慧分頁聚焦與無刷新推播導航，喚醒既有 Client 並透過 postMessage 內部事件平滑切換視圖。
- **Hydration-Safe App Shell Fallback**: 水合安全 App Shell 導航降級，導航快取精確排除 _rsc 與 /api/ 以維護 React 19 RSC 水合安全。

### 5. 後端高併發與健康探針領域
- **Zero-Blocking Health Probe**: 零阻塞健康探針，僅依據伺服器內存狀態秒回 200 OK，杜絕外部依賴污染。
- **Isolated Keep-Alive Task**: 隔離保活任務，在 Lifespan 背景獨立循環運行的資料庫保活定時器。
- **Timezone-Aware Atomicity**: 時區原子一致性，全域時間運算統一強制帶有時區標籤以防 TypeError。
- **Inline Coordinates with Dynamic Fallback**: AI 直出座標伴隨動態補漏，兼顧極速生成與邊緣景點高可用性的坐標解析架構。
- **Mother Region Inheritance**: 母體區域繼承，以行程整體目的地中心點作為所有子景點 Proximity Bias 錨點的空間收斂架構。
- **Atomic Date Range Shift**: 原子日期平移，出發日與結束日平移時同步將所有子項目天數逆序/正序移動並保障截斷資料。

### 6. CI/CD 與工程化守門領域
- **Fail-Fast PowerShell Execution Harness**: 確定性熔斷 PowerShell 執行架構，透過 `$LASTEXITCODE` 即刻中止失敗連鎖。
- **Dual-Mode AST/Regex Audit Pipeline**: 雙模 AST/正則審核管線，結合語法樹與模式約束消除誤報。
- **Tri-Layer Verification Protocol**: 三重活體驗收協議，結合靜態安全、單元邏輯與真實生產打包的三重驗收標準。
- **In-Place Override Merging**: 原地覆蓋合併，在既有 package.json overrides 區塊增量注入而不破壞既有補丁。
- **Infra-as-Code Authority**: 基礎設施程式碼權威，雲端執行時配置以 CI/CD Workflow 定義為唯一真實來源。
- **AI Recombination**: 大腦記憶壓縮重組模式，使新舊日誌無縫融合並保留歷史脈絡與技術債。