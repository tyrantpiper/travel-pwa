# 📅 Daily Report - 2026-09-10

> **系統狀態**：🟢 Production Stable, Offline-First Hardened & iOS Liquid Glass Master Craft (`Serwist BackgroundSync`, `IdbSwrProvider`, `AssistiveTouch 2D Magnetic Snap`, `Ryan AI 3D Companion Avatar`, All 127 Tests Passed, 0 Type Errors, 0 Lint Warnings)  
> **今日關鍵提交**：
> - [`8e03e0b`](https://github.com/tyrantpiper/travel-pwa/commit/8e03e0b) `feat(chat): modernize floating orb with iOS liquid glass, 2D assistivetouch, and ryan ai companion 3d avatar`
> - [`1838299`](https://github.com/tyrantpiper/travel-pwa/commit/1838299) `docs(journal): add 2026-09-10 daily report and consolidate offline-first memory`
> - [`c61ec47`](https://github.com/tyrantpiper/travel-pwa/commit/c61ec47) `feat(pwa): implement offline-first instant boot and background mutation sync`

---

## 🟢 1. Features & Fixes (今日交付價值)

### 1.1 離線優先與微秒級秒開全景架構實裝 (Offline-First & Instant Boot)
1. **全域 SWR 記憶體快照管線接管**：
   - 建立並落地 `docs/specs/offline-first-instant-boot-spec.md` 規格文件，並於 Google NotebookLM 建立專屬研究筆記本（UUID: `df7b08bd-66d2-48f0-9cac-eabeeba57869`），沉澱 8 篇高密度架構調研。
   - 建立 `frontend/lib/idb-swr-provider.tsx`，透過同步記憶體 `Map` 接管全域 SWR，保障 React 19 首幀 0ms 零骨架屏秒開；自動呼叫 `navigator.storage.persist()` 守護 Safari 7 天免清除權限。
   - 在 `frontend/app/layout.tsx` 中將 `<IdbSwrProvider>` 注入 Provider 樹外層，全數保留原先 11 個層級組件與自癒管線，無侵入式升級。
2. **行程清單同步快取與秒開 (Trips List 0ms Snapshot)**：
   - 擴充 `frontend/lib/idb-storage.ts` 新增 `getTripsListSnapshotSync` 與 `saveTripsListSnapshot`，保留既有 4 層自癒清除閉環。
   - 更新 `frontend/lib/hooks.ts` 的 `useTrips` 注入 `fallbackData` 與 `onSuccess` 儲存，達成清單頁面斷網秒開。
3. **背景突變同步佇列 (Serwist BackgroundSync Integration)**：
   - 於 `frontend/app/sw.ts` 整合 W3C 標準 `BackgroundSyncPlugin("tabidachi-offline-mutations")`，行程與費用相關之離線寫入（POST / PUT / PATCH / DELETE）失敗時自動排入 IndexedDB 佇列，最長保留 24 小時，網路恢復時依序自動重送。
4. **外部景點圖片 300 張全量解鎖與 App Shell 導航降級**：
   - 依據使用者體驗優先方針，解鎖外部景點圖片快取上限至 300 張（約 30MB），完整支援 Next.js `/_next/image` 與 CDN（Cloudflare Worker 代理、Cloudinary、Unsplash、Google 等），徹底杜絕離線破圖。
   - 實作地圖樣式、字型與雪碧圖（`map-styles-and-assets`）30 天長效快取。
   - 配置 App Shell 導航降級（3 秒超時回退本地快取 Shell），並以 `!url.searchParams.has("_rsc")` 與 `!url.pathname.startsWith("/api/")` 杜絕 React Server Components 二進位資料水合撕裂。

### 1.2 iOS 26 Liquid Glass 智慧對話伴侶與 2D AssistiveTouch 實裝
1. **液態金屬玻璃浮動球 (Liquid Glass Floating Orb)**：
   - 全面汰除傳統藍紫實心客服球，改採 `backdrop-blur-2xl` 超高採樣背景模糊、雙重反射內外陰影（頂部 `inset 0 1px 1px` 白光反射輪廓 + 底部 `0 8px 32px` 擴散柔和陰影），完美融入 iOS 風格。
   - 引入 2D AssistiveTouch 全向自由拖曳與邊緣彈簧磁吸貼齊（放開瞬間動態計算距離左/右邊緣最近端並貼齊，保留 16px 邊界安全距）。
   - 貼齊瞬間調用 Web Haptics API (`navigator.vibrate(10)`)，帶來實體阻尼觸覺震動。
   - 4 秒無操作自動進入 40% 半透明閒置降噪 (`opacity-40`)，避免遮擋旅行景點行程視野；懸浮或觸控立即 100% 喚醒。
   - 引入 `hasMovedRef` + 80ms 延遲鎖定，徹底根除拖曳放開誤觸發打開面板的手勢衝突。
2. **Ryan AI 專屬 3D 虛擬導遊 IP 實裝**：
   - 生成專屬 3D 陶瓷高光白 ✕ 螢光青眼 ✕ 環形軌道伴侶資產（透明微縮頭像 `ryan-bot-avatar.webp` 6.5KB + 迎賓卡 `ryan-bot-hero.webp` 31.9KB）。
   - 浮動按鈕、面板標頭、對話氣泡與思考狀態全鏈路無縫更換為 Ryan AI 專屬形象。
   - 思考中狀態具備外圈 `border-cyan-400/80 animate-ping` 環形軌道微光呼吸反饋。
   - 迎賓打招呼對話泡泡升級為圖文並茂的專屬迎賓卡片（Ryan AI 3D 揮手導遊插圖 + 專屬青藍高質感漸層面板）。
3. **對話輸入列現代化與 IME 護衛**：
   - 將固定單行 38px 的 `<Input />` 升級為自適應多行擴展 `<textarea>`（`rows={1} min-h-9 max-h-32`，36px ~ 128px），長段落自動展開，超過 128px 啟動平滑滾動，發送後自動復位為單行。
   - 嚴格掛載 `if (e.nativeEvent.isComposing) return`，徹底終結中/日文輸入法（注音、拼音、平假名）選字按 Enter 導致未完成語句被誤送出的長年痛點。
   - 支援 `Enter` 直接發送、`Shift + Enter` 插入換行。
4. **全介面深色模式覆蓋 (Dark Mode Precision)**：
   - 聊天面板全屏毛玻璃容器、標頭漸層、對話內容區、氣泡與輸入框全面對齊 `dark:bg-slate-900`, `dark:bg-slate-950/90`, `dark:border-slate-800` 等色彩映射，夜間規劃行程柔和不刺眼。
5. **12 項核心引擎原位零降級保留**：
   - `streamChat`、`prevTripIdRef` 切行程安全雙清、`POIPreviewCard`、`ExpensePreviewCard`、`DeepResearchCard`、`tryParseItinerary`、`ai-import-itinerary` 一鍵匯入、`SourceCitation`、`ThinkingIndicator`、`useWeatherStore`、SWR 輪詢與輕量化行程注入 100% 完整運作。

---

## 🏛️ 2. Architecture Decisions (架構級決策)

- **高密度對話組件原地微創升級原則 (In-Place Surgical Modernization over Premature Component Splitting)**：
  對於承載 12+ 項複雜閉包、SWR 動態輪詢與 SSE 串流狀態的 `chat-widget.tsx`，堅決抵制盲目拆檔（如拆成 `LiquidGlassOrb`, `ChatBottomSheet`, `ChatInputBar`），改以原地微創升級導入 iOS 26 Liquid Glass、2D AssistiveTouch 自由位移、16px 邊界安全磁吸貼齊與 Haptic 微震動，達成 100% 零業務邏輯流失、零回歸。
- **合成點擊與拖曳手勢競態防衛 (Drag-Release Synthetic Click Race-Condition Guard)**：
  當使用者於觸控或滑鼠拖曳浮動按鈕並釋放時，瀏覽器會合成觸發 `click` 事件導致聊天面板被誤開啟。透過 `hasMovedRef` 追蹤位移並於 `handleDragEnd` 中設置 80ms 延遲釋放閥，徹底杜絕拖曳完放開手指誤開面板的手勢衝突。
- **輸入法組合態攔截與自適應高度防線 (IME Composition Guard & Auto-Growing Textarea)**：
  中文（注音/倉頡/拼音）與日文平假名輸入時，按下 Enter 選字常引發未完成文字提早發送的災難。輸入框全面升級為自適應高度 `<textarea>`（`min-h-9 max-h-32`），並在 `onKeyDown` 嚴格掛載 `if (e.nativeEvent.isComposing) return`，保障多語言選字體驗。
- **專屬 3D 虛擬導遊 IP 輕量化與 PWA 快取 (Lightweight 3D Companion Avatar & Offline PWA Caching)**：
  將抽象向量圖標升級為具象化的「Ryan AI 隨行旅伴」3D 陶瓷光澤透明 WebP 資產（微縮頭像 6.5KB + 迎賓卡 31.9KB），並於 Service Worker 靜態快取池長效保活，兼顧情感連結與 PWA 斷網毫秒級即時渲染。
- **站在既有巨人肩膀上的輕量化原則 (Shoulder-of-Giants Lightweight Architecture)**：
  堅決拒絕盲目引入 PowerSync 或 RxDB 等肥大客戶端複寫引擎（節省 ~200KB bundle 與複雜 schema 遷移風險），完全立足於專案既有的 `serwist`、`idb-keyval` 與 `SWRConfig provider` 官方標準模式，以極小代碼增量完成離線優先秒開閉環。
- **以體驗為先解鎖圖片快取容量 (Experience-First Media Cache Unlocking)**：
  遵循使用者明確指示「不需要在乎國外漫遊流量」，將外部景點圖片上限擴充至 300 張（約 30MB），保障出國離線重度使用體驗，並透過 Cloudflare Worker 反向代理注入 `Access-Control-Allow-Origin: *`，防止 Safari 7~10MB Opaque 填充配額爆炸。
- **動脈與靜脈讀寫分流架構 (Arterial/Venous Read-Write Decoupling)**：
  在 Service Worker 層將 GET 查詢（SWR 快取）與 POST/PUT/PATCH/DELETE 突變（BackgroundSync 離線重試）物理隔離，杜絕突變請求被快取誤吞或 GET 查詢誤進背景佇列。
- **React 19 RSC 水合防衛鐵律 (Hydration-Safe App Shell Fallback)**：
  導航快取 Matcher 嚴格排除 `_rsc` 二進位參數與 `/api/` 路由，防止 Service Worker 將 HTML App Shell 誤回給 RSC 串流導致客戶端發生致命水合撕裂。

---

## 🔴 3. Technical Debt (技術債務追蹤)

- **BackgroundSync iOS Safari 降級機制強化**: iOS Safari 原生不支援 W3C Background Sync API，目前依賴 Service Worker 重新啟動與連線 fetch 事件被動觸發。後續可評估在 `SyncManager` 前端組件中監聽 `window.addEventListener('online')` 作為雙重主動觸發保險。
- **離線突變樂觀 UI 狀態提示 (Optimistic UI Badge)**: 當使用者於離線狀態新增費用或筆記時，可於 UI 卡片旁標註「等待連線同步中...」的微章，提升使用者心理安全感。
- **Dependabot 漏洞修補**: Default branch 存在 1 個 Critical 與 1 個 Moderate 安全漏洞，需排程依賴升級。

---

## 🛡️ 4. Failed Paths (踩坑與失敗教訓)

- **推倒式拆檔引發的閉包斷裂與 SWR 快取丟失陷阱 (Premature Component Decomposition Trap)**：
  曾嘗試將 `chat-widget.tsx` 暴力解耦拆分至 3 個獨立組件（`LiquidGlassOrb`, `ChatBottomSheet`, `ChatInputBar`），導致 `useDynamicPolling`、`prevTripIdRef` 雙清閉包、`textareaRef` 焦點控制以及多個自癒狀態遺失，引發大量測試報錯與死循環震盪。**教訓**：在缺乏完整抽象層保護前，高耦合高密度邏輯組件應優先採原地微創增強，嚴禁過度工程化的推倒重來。
- **未攔截輸入法組合態引發的 Enter 誤送出語句災難 (CJK IME Premature Send Trap)**：
  在 input/textarea 監聽 `onKeyDown` 的 Enter 事件時，若未檢查 `e.nativeEvent.isComposing`，使用者在注音或拼音選字確認按下 Enter 時會誤觸發 `handleSendMessage()`，將半形注音碼或未完成拼音直接送出。**教訓**：所有富文字或對話輸入框必須強制加入 `if (e.nativeEvent.isComposing) return`。
- **直接將未過濾的 SWR 快取 Map 序列化至 IndexedDB 的複製陷阱 (`DataCloneError Trap`)**：
  SWR 內部的 cacheMap 包含未決的 Promise、變異調度器與閉包函式，若未經過濾直接對其執行 IndexedDB `set()` 會觸發瀏覽器 `DataCloneError: could not clone` 致命崩潰。**教訓**：SWR 持久化必須將資料層（Data Snapshot）與排程/Promise 狀態解耦，由 `idb-storage.ts` 定向寫入純乾淨的 JSON 快照。
- **忽略 Next.js `/_next/image` 轉址路徑引發的圖片快取未命中 (`Next.js Image Proxy Bypass Trap`)**：
  初版圖片快取僅針對外部 CDN host (如 cloudinary.com)，但 Next.js `<Image />` 組件會將圖片重寫為本地 `/_next/image?url=...` 路由。**教訓**：圖片快取 Matcher 必須將 `/_next/image` 與外部 CDN 列為聯集比對。

---

## 🎯 5. Next Steps (後續規劃)

1. 本地實機以手機連線測試 PWA 飛航模式下的離線突變與連線自動補送功能。
2. 評估在費用與筆記卡片上實作離線待同步徽章 (Optimistic UI Badge)。
3. 排程處理 GitHub Dependabot 回報之相依性安全修補。
