# 📅 Daily Report - 2026-09-14

> **系統狀態**：🟢 Production Stable, Full-Chain Deep Linking Engine, Multi-Day Master Map & Great-Circle Trajectory, WebGL Hardware Compositing, iOS Tap-to-Drilldown Interaction, Virtuoso Virtual Scroll & Pulse Highlight, 161 Tests Passed (100%), 0 Type Errors, 0 Lint Warnings  
> **今日關鍵提交**：
> - [`b445cf5`](https://github.com/tyrantpiper/travel-pwa/commit/b445cf5) `feat(map): decompress header layout and integrate ios-style tab drill-down`
> - [`62d7a5e`](https://github.com/tyrantpiper/travel-pwa/commit/62d7a5e) `feat(itinerary): add multi-day master map, gpu acceleration and modern map controls`
> - [`c52a068`](https://github.com/tyrantpiper/travel-pwa/commit/c52a068) `docs(screenshots): update retina mobile screenshots with genuine device captures`
> - [`4f9f396`](https://github.com/tyrantpiper/travel-pwa/commit/4f9f396) `fix: resolve itinerary navigation deadlock, unify API fallback port to 8008, and polish UI`
> - [`3eac851`](https://github.com/tyrantpiper/travel-pwa/commit/3eac851) `docs(journal): add master daily reports for 2026-09-13 and 2026-09-14 with memory consolidation`
> - [`209bf22`](https://github.com/tyrantpiper/travel-pwa/commit/209bf22) `feat(notifications): add deep linking for expenses and trip countdown with virtual scroll`
> - [`28859ce`](https://github.com/tyrantpiper/travel-pwa/commit/28859ce) `feat(map): enhance fullscreen modal and route rendering with test coverage`
> - [`01bd76d`](https://github.com/tyrantpiper/travel-pwa/commit/01bd76d) `feat(chat): add batch POI preview, calendar/clock pickers, and itinerary removal tool`
> - [`3f57e26`](https://github.com/tyrantpiper/travel-pwa/commit/3f57e26) `fix(backend): resolve POI distance crash, optimize query RTT, and harden error passthrough`
> - [`a1948fd`](https://github.com/tyrantpiper/travel-pwa/commit/a1948fd) `chore(build): setup MapLibre CSP worker asset pipeline and npm prebuild hooks`

---

## 🟢 1. Features & Fixes (今日交付價值)

### 1.1 全景多天軌跡地圖與大圓航線渲染 (`MultiDayMasterMap.tsx`, `geo-multi-day.ts`)
1. **多天跨區彩帶軌跡 (Multi-Day Great-Circle Trajectories)**：
   - 建立 `geo-multi-day.ts` 純地理運算庫，實作球面上大圓航線（Great-Circle Slerp）高階插值，動態繪製跨天或長距離城市轉移的平滑弧線。
   - 依據天數自動映射高對比飽和色彩（Day 1: 翡翠綠 `#10B981`、Day 2: 科技藍 `#3B82F6`、Day 3: 紫羅蘭 `#8B5CF6`、Day 4: 珊瑚粉 `#EC4899`、Day 5: 琥珀金 `#F59E0B`）。
2. **Esri 衛星影像與 OpenFreeMap 雙底圖無縫切換**：
   - 支援一鍵無損切換高解析度 Esri World Imagery 與向量街景底圖，並嚴格保持軌跡圖層與自定義景點 Pin 置於頂層。
3. **景點抽屜容器內錨定 (`isInternal={true}`)**：
   - 修復舊版景點詳情在總覽模式下直接竄升至螢幕頂部、遮蓋全站頂部導航與標題的嚴重 UI 瑕疵。將抽屜定位錨定於地圖內部容器底部，點擊景點時優雅於地圖內向上浮起，點擊背景或關閉按鈕無縫收合。

### 1.2 WebGL 硬體加速隔離與 AssistiveTouch 60fps 拖曳 (`chat-widget.tsx`)
1. **雙向硬體合成層隔離 (GPU Layer Compositing)**：
   - 地圖容器掛載 `transform-gpu will-change-transform` 與 `React.memo`，避免地圖渲染干擾整個 Viewport。
   - `chat-widget.tsx` 浮動按鈕在拖曳時透過動態樣式 `willChange: isDragging ? "right, bottom" : "auto"` 與 `transform-gpu` 建立獨立硬體合成層，徹底阻斷 Blink 引擎在拖曳時重繪底層昂貴 WebGL Canvas，達成穩定 60fps 絲滑拖曳。

### 1.3 頂部 Header 防擠壓排版與 iOS 原生天數鑽取互動 (`b445cf5`)
1. **Header 橫向空間徹底解壓縮**：
   - 針對 iPhone 390px 窄螢幕下「全行程多天軌跡」旁景點數量徽章被右側按鈕遮蔽一半（`3...`）的瑕疵，將標題欄文字放入獨立 `<span className="truncate">` 隔離，景點數量徽章強制 `shrink-0`。
   - 自 Header 拔除 85px 的跳轉按鈕，右側僅保留「置中羅盤」與「衛星切換」兩個緊湊圖示按鈕，徹底根除文字溢出遮蓋。
2. **iOS 原生鑽取互動模型 (Tap-to-Focus, Tap-again-to-Drilldown)**：
   - 將天數跳轉邏輯內嵌於天數膠囊切換列：初次點選天數膠囊聚焦該日軌跡並浮現箭頭（`🟢 Day 1 ➔`）；再次點選已選中膠囊直接平滑滾動（Smooth Scroll）直達對應之每日卡片。

### 1.4 行程地圖 (DayMap) 控制列現代毛玻璃化
1. **Liquid Glass 現代懸浮膠囊**：
   - 交通模式選擇器（步行/駕車/大眾運輸）升級為毛玻璃微距膠囊，自適應深色模式與觸發時物理微縮（`active:scale-95`）。
   - 嚴格遵守使用者指示，保持地圖原始設計高度與定位/街景/導航按鈕之原始絕對座標。

### 1.5 行程導航死鎖解套與埠號回退統一 (`4f9f396`)
1. **解耦本地狀態與全域 Zustand Store**：
   - 消除 `itinerary-view.tsx` 重新整理或切換行程時的強制跳轉迴圈，確保 `activeDay` 與 URL 參數精確同步。
2. **全鏈路 API 埠號統一至 8008**：
   - 統一前端各組件在本地開發模式下的 Fallback 埠號為 `8008`，消除連線不一致性；離線 Fetch 錯誤優雅降級，防止 Turbopack 彈出干擾性 Error Overlay。

### 1.6 全鏈路推播深層導航與記帳精準定位 (`209bf22`)
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
   - 成功熱部署上線至 Supabase 專案，推播 Payload 全面升級為標準化深層連結。

### 1.7 AI 聊天助理大躍進 (Batch POI, Native Pickers & Smart Removal)
1. **景點批次加入預覽卡片 (`BatchPOIPreviewCard.tsx`)**：
   - 支援 AI 一次性推薦多個景點，使用者可一鍵勾選預覽、批次寫入行程，大幅提升規劃效率。
2. **行動端原生感日曆與時鐘選擇器 (`DateTimePickers.tsx`)**：
   - 打造極致流暢的滾輪時間選取器與連續日曆，取代瀏覽器醜陋的原生日期輸入框。
3. **行程項目智慧刪除 (`RemoveItemPreviewCard.tsx`)**：
   - 聊天室內建智慧刪除意圖卡片，使用者直接在對話中確認刪除特定活動，零跳轉完成行程微調。
4. **意圖路由與模型調度器加固 (`intent_router.py`, `model_manager.py`)**：
   - 實作智慧動態意圖識別，補齊完整的單元測試套件（`test_intent_router.py`、`test_model_manager.py`）。

### 1.8 MapLibre CSP Worker 資產管線落地 (`a1948fd`)
1. **同源靜態 Worker 派發腳本**：
   - 承接 9/13 研討結論，建立 `frontend/scripts/copy-maplibre-worker.mjs`。
   - 在 `package.json` 的 `prebuild` 與 `dev:worker` 自動將 `maplibre-gl-csp-worker.js` 同步至 `public/` 目錄，在嚴格 CSP 標頭下徹底消除 `blob:` 腳本注入阻擋。

### 1.9 後端 POI 距離計算奔潰修復與延遲優化 (`3f57e26`)
1. **NoneType 防禦與查詢 RTT 提升**：
   - 修復當經緯度為空時距離計算引發的 `TypeError`。
   - 強化 Supabase 資料庫查詢快取與錯誤透傳，降低網路來回延遲（RTT）。

---

## 🏛️ 2. Architecture Decisions (架構級決策)

- **WebKit 匿名文字節點隔離與 Flex 寬度守護 (Text-Node Isolation Architecture)**：
  在 Flex 容器（`flex items-center`）中，若直接放置裸露文字與 `shrink-0` 標籤，外層父級的 `truncate` 會在 WebKit 引擎下產生匿名文字方塊（Anonymous Block Box），導致同級的徽章被擠壓截斷。架構上確立：所有彈性標題容器內的動態文本必須封裝於獨立的 `<span className="truncate">` 節點中，與 `shrink-0` 元素形成明確的 DOM 邊界。
- **iOS 原生鑽取心智模型 (Tap-to-Focus, Tap-again-to-Drilldown)**：
  在空間極度受限的行動裝置地圖頂部，杜絕塞入臃腫的跳轉功能按鈕。將「切換可見性/聚焦」與「深度進入/滾動鑽取」兩種動作合而為一：第 1 次點擊選中天數聚焦軌跡，第 2 次點擊已選中項觸發平滑滾動。此心智模型大幅精簡介面認知負荷，並釋放 85px 以上的水平版面。
- **WebGL Canvas 與 AssistiveTouch 雙向硬體隔離 (Hardware Composite Decoupling)**：
  高頻拖曳節點若直接以 CSS `right/bottom` 修改座標，會誘發主執行緒的昂貴 Reflow，強迫 GPU 重繪大型 WebGL 地圖 Canvas。架構上確立雙向隔離原則：地圖容器使用 `transform-gpu will-change-transform` 固定為獨立合成層，拖曳節點動態切換 `willChange: isDragging ? "right, bottom" : "auto"`，達成 60fps 零掉幀。
- **MapLibre 圖層宣告順序與 `beforeId` 禁忌 (Declarative Layer Precedence)**：
  在 React 宣告式地圖架構中，`<Layer>` 是依序加入 MapLibre 樣式表的。禁止在前面的圖層宣告 `beforeId` 指向尚未宣告的後續圖層，避免引發 `Cannot add layer before non-existing layer` 崩潰。應直接利用 JSX 宣告順序自然形成「底層衛星 ➔ 中間軌跡 ➔ 頂層 Pin」的三層拓撲。
- **景點抽屜容器內錨定原則 (Container-Anchored Sheet Decoupling)**：
  不同視圖對同一抽屜元件（`POIDetailDrawer`）具有不同的空間訴求。在全螢幕或總覽地圖中，抽屜必須支援 `isInternal` 模式，將容器限制在地圖元件內部（`absolute bottom-0`）而非視窗層級（`fixed inset-0`），防止子元件破壞母體視圖的全局導航層次。
- **虛擬化清單篩選器穿透機制 (Filter Penetration on Deep Link)**：
  在虛擬化長清單（React Virtuoso）中，未渲染於 DOM 的項目無法藉由傳統 DOM API 定位；若使用者當前開著特定篩選器，目標甚至不會出現在計算清單中。架構上確立：深層連結尋址時，消費端必須具備「前置篩選器自動歸零」的穿透權威，隨後調用虛擬列表內部控制代碼 `scrollToIndex` 達成 100% 精準尋址。
- **深層意圖優先於預設天數之階層判定 (Day-Zero Overview Precedence)**：
  打破「換行程 = 看第一天」的慣性假設，確立「外部明確意圖（Deep Link URL / Intent Store） > 內部預設落地值（Day 1）」的優先順序模型，成功解鎖推播直達 `day=0` 總覽儀表板的產品體驗。
- **暫時性目標參數脫敏與防震盪機制 (Ephemeral Target Parameter Cleanup)**：
  在完成定位調度後，立即使用 `window.history.replaceState` 將 `expense_id` 從網址列拔除，達成「單次消費即銷毀」的冪等性保護，防止使用者 F5 重新整理時反覆重播定位動畫。
- **CSP Web Worker 同源靜態管線標準化**：
  不為求省事而放寬 CSP 安全標頭（堅決不用 `unsafe-eval` 或動態 blob），以建置期（Build-time Hook `copy-maplibre-worker.mjs`）自動化腳本將 Web Worker 轉換為同源靜態資產，兼顧安全性與開箱即用體驗。

---

## 🔴 3. Technical Debt (技術債與後續追蹤)

- **密集景點 Pin 的碰撞聚合 (POI Clustering)**：
  多天總覽地圖疊加全行程數十個景點時，相鄰景點圖示容易重疊。後續可規劃導入 MapLibre 向量圖層的原生 `cluster: true` 或依 Zoom Level 動態展延機制。
- **MapLibre 實例與記憶體生命週期監控 (WebGL Context Lifecycle)**：
  切換視圖頻繁時需持續監測 WebGL 上下文釋放情況，確保地圖卸載時完整執行 `map.remove()`，杜絕行動端 Safari 報錯 `Too many active WebGL contexts`。
- **Service Worker 點擊直接喚起深層視窗**：
  目前推播通知點擊跳轉依賴網頁開啟後的 `useDeepLinkRouter`。未來可評估在 `sw.js` 的 `notificationclick` 事件中加入 `clients.matchAll({ type: 'window' })` 智慧聚焦已開啟之分頁，減少不必要的重複分頁生成。
- **VAPID 密鑰輪轉與 Supabase Webhook 監控**：
  需持續觀測雲端 Edge Functions 派發推播的延遲與第三方推播伺服器之 410 Gone 回收率。

---

## 🛡️ 4. Failed Paths (踩坑與反思)

- **Flex 容器未封裝文字直用 `truncate` 引發標籤被擠壓 (WebKit Anonymous Flex Truncation Trap)**：
  在 Header 直接使用 `className="flex items-center min-w-0 truncate"` 包覆文字與 `<Badge>`，在 WebKit/iOS 渲染引擎下，裸文字被包入 Anonymous Block，計算寬度時強制將同級的 `shrink-0` 徽章壓縮或推出可視範圍。教訓：Flex 容器內的文本溢出截斷，務必單獨由子 `<span className="truncate">` 承擔。
- **未宣告 MapLibre 圖層時指定 `beforeId` 引發渲染引擎崩潰 (Premature beforeId Reference Trap)**：
  在 JSX 中宣告底層衛星影像時，指定 `beforeId="day-trajectories-layer"`，但該軌跡圖層在 JSX 代碼中寫在衛星圖層之後。MapLibre 依序解析引發 `Cannot add layer before non-existing layer` 致命錯誤。教訓：React-map-gl 圖層宣告應善用自然 JSX 階層排列，切忌跨越宣告順序參考不存在的圖層 ID。
- **拖曳浮動節點誘發 WebGL Canvas 主執行緒 Reflow 掉幀 (Unisolated WebGL Reflow Trap)**：
  在同一視圖內，若直接拖曳以 `right/bottom` 定位的 `chat-widget` 圓球，瀏覽器未開啟硬體加速時會重新計算整體頁面佈局並重繪大型地圖 WebGL Canvas，導致拖曳 FPS 崩跌至 20fps。教訓：包含 WebGL 地圖的複雜視圖中，浮動動態節點必須明確宣告 `transform-gpu` 與動態 `will-change`，建立獨立 GPU 合成層。
- **傳統 DOM `scrollIntoView` 在虛擬化清單下的無效陷阱 (Virtual List Null DOM Trap)**：
  初期嘗試使用 `document.getElementById('expense-' + id)?.scrollIntoView()` 尋找目標項目。在項目數量超過可視區域時，Virtuoso 尚未將其渲染至 DOM 樹中，`document.getElementById` 必然回傳 `null`。教訓：凡使用虛擬化滾動引擎，絕對不能依賴原生 DOM 選擇器，必須使用虛擬庫提供的 Ref Handle 進行索引計算與滾動。
- **行程切換無腦重置天數抹除外部深層意圖 (Blind Day-1 Overwrite Trap)**：
  在 `itinerary-view.tsx` 中監聽 `[activeTripId]` 並直接調用 `setDay(1)`，導致推播傳入的 `day=0` 總覽參數被瞬間覆寫回第一天。教訓：在多狀態驅動的視圖中，狀態重置必須檢查當前全域 Store 是否已有高優先順序的顯式指定值。

---

## 📊 5. Verification & Quality Gates (品質關卡數據)

| 檢驗項目 | 執行指令 | 檢驗結果 | 狀態 |
| :--- | :--- | :--- | :--- |
| **前端單元測試套件** | `npx vitest run` | 21 passed (21 files), 161 passed (161 tests) | 🟢 PASS |
| **後端測試套件** | `pytest` | 43 passed, 5 skipped (48 items) | 🟢 PASS |
| **前端 TypeScript 靜態檢查** | `npx tsc --noEmit` | Exit Code: 0 (0 errors) | 🟢 PASS |
| **Supabase 邊緣運算型別** | `npx tsc --project ../supabase/tsconfig.json --noEmit` | Exit Code: 0 (0 errors) | 🟢 PASS |
| **前端 Linter 嚴格檢查** | `npm run lint` | Exit Code: 0 (0 errors, 0 warnings) | 🟢 PASS |
| **AST 防禦性模式掃描** | `RULE-TS-01` (Nested button) | 0 violations detected | 🟢 PASS |
| **遠端版本控制同步** | `git push origin main` | Commit `b445cf5` pushed to origin/main | 🟢 PASS |

---

## 🎯 6. Next Steps (後續方向)

1. **多天總覽景點碰撞聚合 (POI Clustering)**：針對超過 20+ 密集景點的多日行程，評估引入 MapLibre 向量聚合圓圈，點擊後平滑放大展開。
2. **實機推播端對端點擊驗收**：透過行動裝置（iOS PWA / Android Chrome）進行真機點擊記帳與倒數通知，核驗呼吸發光與平滑滾動質感。
3. **AI 對話助理場景延伸**：將全新之 `DateTimePickers` 與 `BatchPOIPreviewCard` 廣泛推展至自由規劃與快速改期對話場景中。
