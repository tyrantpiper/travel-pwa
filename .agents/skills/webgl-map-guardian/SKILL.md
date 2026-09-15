---
name: "WebGL & Map Guardian"
description: "Master-level MapLibre, WebGL Canvas, Esri Satellite, OpenFreeMap, and geographic calculation architect. Enforces declarative layer topology, CSP worker pipeline, GPU compositing isolation, and container-anchored drawer layout."
version: "1.0.0"
triggers:
  - "/map"
  - "地圖"
  - "map"
  - "webgl"
  - "maplibre"
  - "衛星影像"
  - "軌跡"
---

# WebGL & Map Guardian Skill

> **Role**: Master GIS & WebGL Graphics Architect.  
> **Mission**: Guarantee high-performance, crash-free, and accessibility-compliant interactive mapping across mobile PWA and desktop viewports.

---

## 🏛️ Core Architectural Standards

### 1. 宣告式圖層拓撲守衛 (Declarative Layer Precedence)
- **圖層物理渲染順序**：
  MapLibre 在 React 宣告式渲染中依序加入樣式表。JSX 必須嚴格遵守由底至頂的物理宣告順序：
  ```jsx
  <Map>
    {/* 1. 底層：向量或衛星影像圖層 */}
    {isSatellite && <Source id="esri-satellite" ...><Layer id="esri-satellite-layer" ... /></Source>}

    {/* 2. 中間層：多天軌跡與路線 */}
    <Source id="trajectories-source" ...><Layer id="trajectories-layer" ... /></Source>

    {/* 3. 頂層：自訂標記與互動 Pin (HTML Markers) */}
    {spots.map(spot => <Marker key={spot.id} ... />)}
  </Map>
  ```
- **禁忌 (Anti-Pattern)**：
  - **嚴禁在尚未渲染的後續圖層前宣告 `beforeId`**（如在底層衛星宣告 `beforeId="trajectories-layer"`，但該圖層在 JSX 下方宣告）。此舉會引發 `Cannot add layer before non-existing layer` 致命崩潰。
  - `beforeId` 僅能用於參照底圖樣式表（Base Style）中預先存在的既有圖層（如 `road_label`）。

### 2. CSP Web Worker 同源靜態管線 (MapLibre CSP Pipeline)
- **同源資產要求**：
  在嚴格的 Content Security Policy (CSP) 標頭下，嚴禁使用 `new Worker(URL.createObjectURL(blob))` 動態產生 Worker。
- **自動化管線**：
  - 靜態建置腳本：`frontend/scripts/copy-maplibre-worker.mjs`
  - 透過 `package.json` 的 `prebuild` 與 `dev:worker` 自動將 `maplibre-gl-csp-worker.js` 同步至 `public/` 目錄。
  - 前端組件統一宣告：
    ```ts
    import maplibregl from "maplibre-gl";
    // @ts-expect-error workerUrl is supported in CSP build
    maplibregl.workerUrl = "/maplibre-gl-csp-worker.js";
    ```

### 3. WebGL Canvas 雙向硬體合成層隔離 (Hardware Compositing)
- **拖曳掉幀根因**：
  浮動動態節點（如 AssistiveTouch `chat-widget`、可拖曳 Bottom Sheet）若直接以 CSS `right/bottom` 修改座標，會觸發 Blink/WebKit 主執行緒的 Layout Reflow，迫使 GPU 重新繪製整張大尺寸 WebGL Canvas，FPS 瞬間暴跌至 20fps。
- **雙向隔離規範**：
  - **地圖容器**：外層必須掛載 `transform-gpu will-change-transform` 與 `React.memo`，鎖定獨立 GPU 合成層：
    ```tsx
    <div className="relative w-full h-full transform-gpu will-change-transform">
      <Map ... />
    </div>
    ```
  - **浮動拖曳節點**：必須掛載 `transform-gpu`，並在拖曳中動態開啟 `willChange`：
    ```tsx
    <div
      className="fixed transform-gpu"
      style={{ willChange: isDragging ? "right, bottom" : "auto" }}
    >
    ```

### 4. 景點抽屜容器內錨定原則 (Container-Anchored Sheet Decoupling)
- **視窗逃逸陷阱**：
  在行程總覽模式或嵌入式地圖中，景點詳情抽屜（`POIDetailDrawer`）若使用預設的 `fixed inset-0`，會竄升至視窗頂部遮蓋全域導航列與 Header。
- **內嵌錨定規範**：
  嵌入式地圖必須傳入 `isInternal={true}`：
  ```tsx
  {selectedSpot && (
    <div className="absolute inset-x-0 bottom-0 z-30 pointer-events-auto">
      <POIDetailDrawer
        spot={selectedSpot}
        isInternal={true}
        onClose={() => setSelectedSpot(null)}
      />
    </div>
  )}
  ```

### 5. 大圓航線球面插值 (Great-Circle Slerp)
- 長距離或跨天軌跡在平面投影上若直接連成直線，會失真且視覺單調。
- 必須透過 `frontend/lib/geo-multi-day.ts` 進行大圓航線插值運算，動態生成高對比弧線，並搭配天數顏色池：
  - Day 1: `#10B981` (Emerald)
  - Day 2: `#3B82F6` (Blue)
  - Day 3: `#8B5CF6` (Violet)
  - Day 4: `#EC4899` (Pink)
  - Day 5: `#F59E0B` (Amber)

### 6. 本地真機活體驗收守門 (Local Native Probing Gate)
- **JSDOM 測試盲區**：
  `vitest` 與 `tsc --noEmit` 在 Node.js / JSDOM 環境下無法模擬真實 WebGL Context。任何圖層結構、底圖 URL 或 MapLibre 版本變更，**禁止僅憑單元測試綠燈就判定合格**。
- **驗收要求**：必須於本地 `http://localhost:3000` 進行 Chrome DevTools 實機或真機瀏覽器實際渲染驗證，確認地圖瓦片正常加載、無 WebGL 報錯後方可提交。

---

## 🚀 Execution Checklist

- [ ] 地圖容器是否已標註 `transform-gpu will-change-transform`？
- [ ] JSX 中的圖層順序是否由底至頂（衛星 ➔ 軌跡 ➔ Marker）？
- [ ] 是否完全不存在指向同級後續圖層的 `beforeId`？
- [ ] 抽屜元件在總覽地圖中是否配置 `isInternal={true}`？
- [ ] 浮動手勢節點是否使用動態 `will-change` 阻斷 WebGL Reflow？
- [ ] 本地實機確認地圖瓦片無 404 / 403，主控制台無 WebGL 錯誤？
