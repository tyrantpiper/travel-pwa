# 📅 Daily Report - 2026-09-15

> **系統狀態**：🟢 Production Stable, WebGL & Map Guardian Skill Online, 4-Tier Fail-Fast Quality Gate, AST Semantic Audit Suite, 161 Vitest + 43 Pytest Passed (100%), 0 Type Errors, 0 Lint Warnings  
> **今日關鍵提交**：
> - [`86ef95b`](https://github.com/tyrantpiper/travel-pwa/commit/86ef95b) `feat(agents): create webgl-map-guardian skill and harden quality gates`

---

## 🟢 1. Features & Fixes (今日交付價值)

### 1.1 創建全新專精地圖技能 (`webgl-map-guardian`)
1. **宣告式圖層拓撲守衛 (Declarative Layer Precedence)**：
   - 規範 MapLibre 在 React 宣告式渲染中由底至頂的物理宣告順序（底圖衛星/向量 ➔ 中間彩帶軌跡 ➔ 頂層自訂 Marker）。
   - 嚴禁在前面圖層宣告 `beforeId` 指向尚未宣告的後續圖層，杜絕 `Cannot add layer before non-existing layer` 致命白屏。
2. **CSP Web Worker 同源靜態資產管線**：
   - 標準化 `frontend/scripts/copy-maplibre-worker.mjs` 與 `package.json` 的 `prebuild` hook，在嚴格 CSP 標頭下徹底杜絕動態 `blob:` 注入阻擋。
3. **WebGL Canvas 雙向硬體合成層隔離 (Hardware Compositing)**：
   - 地圖容器宣告 `transform-gpu will-change-transform` 與 `React.memo`。
   - 浮動拖曳節點宣告 `transform-gpu` 並動態開啟 `willChange: isDragging ? "right, bottom" : "auto"`，徹底阻斷拖曳時觸發主執行緒 Reflow 重繪 WebGL Canvas，保障 60fps 絲滑拖曳。
4. **景點抽屜容器內錨定 (Container-Anchored Sheet Decoupling)**：
   - 在多天總覽地圖與全景模式下，景點抽屜必須支援 `isInternal={true}`，錨定於地圖容器底部（`absolute bottom-0`），防止抽屜逃逸竄升至視窗頂部蓋住全站導航列。
5. **大圓航線球面插值標準 (Great-Circle Slerp)**：
   - 調用 `geo-multi-day.ts` 幾何庫進行球面 Slerp 插值，動態生成高對比弧線，支援 Day 1~5 飽和色彩池映射。
6. **本地真機活體驗收守門 (Local Native Probing Gate)**：
   - 明確排除 JSDOM / Node.js 測試無法模擬真實 WebGL 上下文之盲區，強制要求地圖與 WebGL 變更必須經本地真機瀏覽器實際渲染驗收。

### 1.2 加固 `/push` 全棧 Fail-Fast 品質守門
1. **4 級嚴格 Pre-flight 熔斷關卡**：
   - Gate 1: 前端 TypeScript 靜態檢查（`npx tsc --noEmit`，0 錯誤）。
   - Gate 2: 前端 ESLint 程式碼檢查（`npm run lint`，0 錯誤、0 警告）。
   - Gate 3: 前端全量單元測試（`npx vitest run`，161 tests 100% 通過）。
   - Gate 4: 後端 Pytest 測試套件（`pytest`，43 passed 全數通過）。
2. **Windows PowerShell 原生語法對齊**：
   - 杜絕在 Windows 環境下使用無效的 `&&`，並淘汰無熔斷保護的 `;`，導入 `if ($LASTEXITCODE -ne 0) { exit 1 }` 確定性熔斷機制，確保任何錯誤皆能即刻物理中止推送。

### 1.3 修復並擴充 `regression-guardian`
1. **修正死鏈指向**：
   - 將原本不存在的 `.agents/workflows/regression-check.md` 校正為 `.agents/workflows/test.md`。
2. **擴充關鍵縫隙回歸矩陣 (Critical Seams Checklist)**：
   - 前端深層連結與篩選穿透（`deep-link-router.test.ts`）
   - SWR 404 靜默自癒與防誤判雙重核驗（`self-healing-simulation.test.tsx`）
   - 多天全景大圓航線幾何運算（`multi-day-map.test.ts`）
   - 後端 POI 經緯度非空防禦與非同步保活連線池（`test_poi_lifespan.py`）

### 1.4 強化 `ui-component-architect` 實戰標準
1. **WebKit 匿名文本溢出防擠壓 (Text-Node Isolation)**：
   - Flex 容器內所有動態文字必須包覆於獨立 `<span className="truncate">`，同級 Badge / Button 必須掛載 `shrink-0`，杜絕 iOS 390px 螢幕下文字塊擠壓徽章。
2. **解耦按鈕 DOM 架構 (Decoupled Button DOM Architecture)**：
   - 嚴格落實 HTML5 規格，卡片操作列按鈕與卡片點擊熱區在 DOM 層級解耦為同級 Sibling 節點，杜絕 `<button>` 嵌套違規。
3. **虛擬列表篩選穿透與 Ref 尋址 (Filter Penetration on Deep Link)**：
   - 禁止對虛擬列表（Virtuoso）直接使用 DOM `scrollIntoView`，必須使用 `virtuosoRef.current.scrollToIndex`，並前置清空衝突篩選器。
4. **觸控防護與輸入法選字防禦 (Touch Guards & IME Composition)**：
   - 行動端按鈕一律提供 `active:scale-95` 觸覺回彈；多行文字輸入框必須在 `onKeyDown` 檢查 `if (e.nativeEvent.isComposing) return`，防止 CJK 選字提早發送。

### 1.5 擴充 `/audit` AST 語意規則庫
- `RULE-TS-04` (Bare Text in Flex Truncate): 檢測 Flex 標題列裸露文字與父級 truncate。
- `RULE-TS-05` (Virtual List Direct DOM Access): 檢測是否對虛擬清單直接調用 `scrollIntoView`。
- `RULE-TS-06` (MapLibre Premature beforeId): 檢測 MapLibre `<Layer>` 是否包含指向未宣告圖層的 `beforeId`。
- `RULE-PY-04` (Timezone-Aware Datetime): 檢測後端 `datetime.now()` 是否遺漏 `timezone.utc`。

### 1.6 全域對齊專案根配置 (`AGENTS.md`)
- 於專案 L0/L1 核心配置中正式註冊 `webgl-map-guardian`，確保每次 Agent 對話啟動時具備完整的 GIS 與 WebGL 防衛意識。

---

## 🏛️ 2. Architecture Decisions (架構級決策)

- **PowerShell 確定性熔斷守門架構 (Fail-Fast PowerShell Execution Harness)**：
  在 Windows 開發環境下，嚴禁依賴 Bash 風格的 `&&` 或非熔斷的 `;` 串接指令。所有工作流與守門腳本必須明確宣告 `$LASTEXITCODE` 檢查或單步終止，確保任何一級（TypeScript、ESLint、Vitest、Pytest）失敗時能立即物理中斷，杜絕「宣稱全棧嚴格守門，實際上破產放行」的邏輯矛盾。
- **宣告式地圖圖層拓撲優先原則 (Declarative Layer Precedence)**：
  在 React 宣告式地圖架構中，`<Layer>` 依 JSX 物理由底至頂解析。禁止在前面的圖層宣告 `beforeId` 指向尚未宣告的後續圖層，避免引發 `Cannot add layer before non-existing layer` 崩潰。應利用自然 JSX 宣告順序建立層次。
- **JSDOM WebGL 測試偽陽性防護 (Local Native Probing Gate)**：
  確立 Node.js / JSDOM 無法模擬真實 WebGL Context 的基本事實，任何圖層結構、底圖 URL 或 MapLibre 版本變更，嚴禁僅憑單元測試綠燈就斷定安全，必須在本地真機瀏覽器實際渲染驗證。
- **雙模 AST/正則防禦架構 (Dual-Mode AST/Regex Audit Pipeline)**：
  對於 JSX 樹狀結構複雜的樣式反模式（如 Flex Truncate 匿名區塊），放棄過度工程化的單一 AST 比對，採 AST 節點鎖定搭配正則約束，兼顧精確度與零偽陽性。

---

## 🔴 3. Technical Debt (技術債與後續追蹤)

- **Dependabot 安全漏洞修復**: Default branch 存在 1 個 Moderate severity 安全漏洞（Dependabot #83），需排程升級相依性。
- **多天總覽 POI Pin 碰撞聚合 (Clustering)**: 當多天行程累積超過 20+ 密集景點時，地圖 Pin 存在重疊遮蔽，後續需規劃導入 MapLibre 原生向量聚合圓圈。
- **Service Worker 點擊深層喚起現有分頁**: 評估在 `sw.js` 的 `notificationclick` 事件中加入 `clients.matchAll({ type: 'window' })` 智慧聚焦已開啟之分頁。

---

## 🛡️ 4. Failed Paths (踩坑與反思)

- **PowerShell 分號串接導致錯誤吞噬與假性放行 (PowerShell Unhalted Chain Trap)**：
  在 Windows PowerShell 中使用 `cmd1; cmd2; cmd3` 串接指令時，即使 `cmd1` 噴錯，PowerShell 依然會繼續執行後續指令。若最後一條指令成功，整個任務會被誤判為通過。教訓：Windows 終端工作流必須顯式包裝 `if ($LASTEXITCODE -ne 0) { exit 1 }` 實施嚴格熔斷。
- **粗糙 AST Pattern 比對引發的偽陽性爆發 (AST Pattern Overmatching Trap)**：
  企圖以單一 AST Pattern 比對包含特定 CSS 類別的動態文字標籤，若未指定確切約束，會把全站所有 JSX 文字節點全部誤判。教訓：語法審核必須採約束性 AST 規則（Constraints & Regex）。

---

## 📊 5. Verification & Quality Gates (品質關卡數據)

| 檢驗項目 | 執行指令 | 檢驗結果 | 狀態 |
| :--- | :--- | :--- | :--- |
| **前端單元測試套件** | `npx vitest run` | 21 passed (21 files), 161 passed (161 tests) | 🟢 PASS |
| **後端測試套件** | `pytest` | 43 passed, 5 skipped (48 items) | 🟢 PASS |
| **前端 TypeScript 靜態檢查** | `npx tsc --noEmit` | Exit Code: 0 (0 errors) | 🟢 PASS |
| **前端 Linter 嚴格檢查** | `npm run lint` | Exit Code: 0 (0 errors, 0 warnings) | 🟢 PASS |
| **遠端版本控制同步** | `git push origin main` | Commit `86ef95b` pushed to origin/main | 🟢 PASS |

---

## 🎯 6. Next Steps (後續方向)

1. **依據新版 `push.md` 守門驗收後續提交**：所有後續功能開發必須完全走通 4 級 Fail-Fast 流程。
2. **Dependabot 漏洞評估與修補**：依據最小侵入性原則處理 Dependabot #83 安全警告。
3. **密集景點 Pin 聚合機制原型規劃**：針對多日總覽地圖評估 MapLibre 向量聚合圖層。
