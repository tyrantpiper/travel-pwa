# 📋 Tabidachi AI 聊天圓球與對話面板重構：精確執行流程與零誤刪防禦報告

> **報告目標**: 提供《iOS 26 Liquid Glass 智慧伴侶重塑》之超微步（Micro-Step）拆解與程式碼精確行號對照，徹底杜絕任何業務邏輯、自癒機制或功能組件被意外刪改。  
> **目標檔案**: `frontend/components/chat-widget.tsx` (共 1063 行)  
> **關聯規格**: `docs/specs/ios-liquid-glass-chat-spec.md`

---

## 一、 現有 1063 行代碼逐行審查與保全清單 (Line-by-Line Preservation Audit)

下表為 `frontend/components/chat-widget.tsx` 完整 1063 行的逐段盤點。**凡標記為「🔒 100% 絕對封存」的區塊，實作期間連一個變數名稱都不會更動**：

| 行號區間 | 邏輯區塊名稱 | 關鍵依賴與功能 | 處置承諾 |
| :--- | :--- | :--- | :---: |
| **L1 – L27** | 模組導入區 (Imports) | Lucide 圖示、SWR、Markdown、TripContext、POI卡片、記帳卡片、深度研究卡片、SSE串流解析器 | 🔒 **100% 保留**<br>*(僅追加新子組件導入)* |
| **L28 – L56** | `Part` 結構與 `tryParseItinerary` | 解析 Gemini API 回傳之 JSON 行程並防漏閥轉換 | 🔒 **100% 絕對封存** |
| **L57 – L93** | 核心型別與城市座標映射 | `GroundingSource`, `Message`, `Position`, `CITY_COORDS` (10大城市座標) | 🔒 **100% 絕對封存** |
| **L94 – L100** | 安全區域計算函式 | `getSafeAreaBottom()` (CSS `--sab` 讀取) | 🔒 **100% 絕對封存** |
| **L105 – L128** | 跨分頁登入狀態雙向監聽 | `localStorage.getItem("user_uuid")`, `storage` 事件, `user-login-state-changed` 事件 | 🔒 **100% 絕對封存** |
| **L129 – L150** | 行程上下文與動態輪詢對齊 | `useTripContext`, `useTripDetail` (含 polling interval 對齊), `tripLocation` | 🔒 **100% 絕對封存** |
| **L151 – L212** | 精簡行程產生器與天氣神經注入 | `getLeanItinerary()` 攤排行程項目、注入注意事項/預算/清單/票券，並從 `useWeatherStore` 注入即時均溫與 WBGT 風險 | 🔒 **100% 絕對封存** |
| **L213 – L248** | 訊息清單與串流狀態管理 | `messages`, `hydrateMessage`, `isLoading`, `abortControllerRef`, `fileInputRef` 等 | 🔒 **100% 絕對封存** |
| **L250 – L281** | **行程切換自癒清理 (`prevTripIdRef`)** | **🚨 P0 自癒防線**：當行程切換時，強制 `abort()` 前次 AI 生成、重置 Greeting、清空記憶摘要 | 🔒 **100% 絕對封存** |
| **L282 – L420** | 舊版原生滑鼠/觸控拖曳監聽 | 手動計算 `clientX`, `clientY`, `style.right`, `style.bottom` (限制於右側上下滑) | 🔄 **模組化抽換**<br>*(移交給 `LiquidGlassOrb`)* |
| **L422 – L775** | **`handleSendMessage` 核心對話大腦** | **🚨 350行核心動脈**：API Key 安全檢驗、`streamChat` SSE 串流解析、打字機動態回填、錯誤自動回退至 `/api/chat`、失敗重試登記 | 🔒 **100% 絕對封存** |
| **L777 – L786** | `handleImageUpload` 圖片讀取 | 讀取檔案轉 Base64 DataURL 存入 `selectedImage` | 🔒 **100% 絕對封存** |
| **L788 – L790** | 未登入閘門檢查 | `if (!isLoggedIn) return null` | 🔒 **100% 絕對封存** |
| **L794 – L812** | 舊版全螢幕黑色遮罩與實色 Header | 剛硬的 `bg-slate-900/40` 與 `bg-linear-to-r from-blue-600 to-indigo-600` | 🔄 **外殼結構升級**<br>*(升級為 `ChatBottomSheet`)* |
| **L813 – L886** | **訊息清單渲染與 Markdown 解析** | 包含使用者與 AI 氣泡、JSON 自動轉友善清單、`ReactMarkdown` 渲染 | 🔒 **100% 保留**<br>*(僅注入 `dark:` 類別)* |
| **L829 – L872** | **POI、記帳、深度研究任務預覽卡片** | `extractFunctionCall` ➔ `POIPreviewCard`<br>`extractExpenseFunctionCall` ➔ `ExpensePreviewCard`<br>`DeepResearchCard` (含任務取消回調) | 🔒 **100% 絕對封存** |
| **L888 – L911** | **✨ 一鍵匯入行程橋樑 (`ai-import-itinerary`)** | 派發事件至 `ToolsView` 並導航至匯入器 | 🔒 **100% 絕對封存** |
| **L924 – L960** | 思考指示器、中斷按鈕、失敗重試按鈕 | `<ThinkingIndicator />` 脈衝指示器、中斷按鈕、`lastFailedMessage` 重新發送按鈕 | 🔒 **100% 絕對封存** |
| **L964 – L1033** | 舊版單行輸入列 | 單行 `<Input />`，無文字自增高，無 IME 選字保護 | 🔄 **模組化抽換**<br>*(升級為 `ChatInputBar`)* |
| **L1036 – L1060** | 舊版藍紫客服懸浮圓球 JSX | `h-14 w-14 rounded-full bg-linear-to-r` 搭配 `MessageCircle` | 🔄 **模組化抽換**<br>*(升級為 `LiquidGlassOrb`)* |

---

## 二、 超微步（Micro-Step）實作執行計畫

為了將風險完全隔離，我們採取 **「全新檔案獨立建置 ➔ 單點外科手術式接軌」** 的四步法：

```
┌─────────────────────────────────────────────────────────────┐
│ 【Phase 1: 純增量建置 (0% 影響現有代碼)】                     │
│ 1.1 建立 frontend/components/chat/LiquidGlassOrb.tsx        │
│ 1.2 建立 frontend/components/chat/ChatInputBar.tsx         │
│ 1.3 建立 frontend/components/chat/ChatBottomSheet.tsx      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 【Phase 2: chat-widget.tsx 外科手術式組件替換】              │
│ 2.1 引入 3 個新子組件                                       │
│ 2.2 移除 L282-L420 舊版手動 DOM 拖曳代碼 (由 Orb 內部接管)   │
│ 2.3 將 L794-L812 替換為 <ChatBottomSheet> (內部訊息原封不動) │
│ 2.4 將 L964-L1033 替換為 <ChatInputBar>                     │
│ 2.5 將 L1036-L1060 替換為 <LiquidGlassOrb>                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 【Phase 3: 靜態品質與回歸驗證 (Quality Gate)】               │
│ 3.1 npx tsc --noEmit (0 型別錯誤)                            │
│ 3.2 npm run lint (0 語法警告)                                │
│ 3.3 npm test (127/127 測試綠燈，包含自癒與回歸測試)          │
│ 3.4 npm run build (Next.js 16 生產環境打包通過)              │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、 三個子組件與 `chat-widget.tsx` 的精確介面契約 (Props Contract)

### 1. `LiquidGlassOrb.tsx`
* **路徑**: `frontend/components/chat/LiquidGlassOrb.tsx`
* **介面定義**:
  ```typescript
  interface LiquidGlassOrbProps {
      isOpen: boolean
      onToggle: () => void
      isStreaming?: boolean
  }
  ```
* **職責**:
  - 封裝 Framer Motion 2D 自由拖曳與左右邊界彈簧磁吸（放手自動貼齊左側 `x: 16` 或右側 `x: 16`）。
  - 磁吸到達邊緣時調用 `useHaptic().selection()` 觸發微震動。
  - 內建 4 秒無操作計時器，自動進入 35% 半透明度；點擊或觸摸瞬間復原。
  - 點擊時使用 `hasDraggedRef`（位移 > 4px）過濾拖曳行為，杜絕拖曳結束誤觸開關。
  - 連接 `useTheme()` 獲取 `currentTheme.primary` 動態渲染液態呼吸光暈。

### 2. `ChatInputBar.tsx`
* **路徑**: `frontend/components/chat/ChatInputBar.tsx`
* **介面定義**:
  ```typescript
  interface ChatInputBarProps {
      input: string
      setInput: (value: string) => void
      onSendMessage: () => void
      isLoading: boolean
      selectedImage: string | null
      onClearImage: () => void
      onTriggerImageUpload: () => void
      isDeepResearch: boolean
      onToggleDeepResearch: () => void
      fileInputRef: React.RefObject<HTMLInputElement | null>
      onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  }
  ```
* **職責**:
  - 動態 Textarea 高度自適應（1 行 38px ➔ 隨輸入擴展至最大 128px ➔ 超出啟用內部滾動 ➔ 送出後平滑回縮至 38px）。
  - 中文/日文 IME 組字保護：`if (e.nativeEvent.isComposing) return;`。
  - 包含圖片預覽縮圖與移除按鈕、深度研究晶片切換鈕、主題發送按鈕。

### 3. `ChatBottomSheet.tsx`
* **路徑**: `frontend/components/chat/ChatBottomSheet.tsx`
* **介面定義**:
  ```typescript
  interface ChatBottomSheetProps {
      isOpen: boolean
      onClose: () => void
      children: React.ReactNode // 放訊息清單與輸入列
  }
  ```
* **職責**:
  - 提供 65dvh（半屏）/ 94dvh（全屏）雙段式 Snap Points。
  - 頂部 iOS 膠囊把手 (Grab Handle Pill) 與 Header 綁定 `dragControls.start(e)`。
  - 主容器宣告 `dragListener={false}`，徹底隔離下方訊息清單的捲動手勢，**完美補足關鍵 1 分**。
  - 支援向下輕甩超過 120px 手勢自動彈簧收回。
  - 全域深色模式適配（`dark:bg-slate-900/90 dark:border-white/10`）。

---

## 四、 核心功能防誤刪對照驗收矩陣 (Zero-Regression Checklist)

| 序號 | 核心功能項目 | 原代碼行號 | 升級後如何確保不失效？ | 驗收方式 |
| :---: | :--- | :---: | :--- | :--- |
| **1** | **SSE 串流對話打字機** | L452–L720 | `streamChat` 迴圈與 Promise 處理 100% 原始保留在 `chat-widget.tsx` | 實時提問驗證流式回填 |
| **2** | **行程切換自癒清理** | L253–L280 | `prevTripIdRef` 切換行程時自動 abort 與清空邏輯原地不動 | 切換行程驗證對話立即重置 |
| **3** | **POI 景點預覽卡片** | L830–L836 | `extractFunctionCall(msg.rawParts)` 與 `<POIPreviewCard />` 原樣保留 | 詢問特定景點驗證卡片彈出 |
| **4** | **記帳預覽卡片** | L838–L844 | `extractExpenseFunctionCall` 與 `<ExpensePreviewCard />` 原樣保留 | 輸入記帳對話驗證卡片彈出 |
| **5** | **深度研究任務卡片** | L846–L871 | `DeepResearchCard` 與任務取消 API 原樣保留 | 啟用深度研究驗證任務卡片 |
| **6** | **一鍵匯入行程按鈕** | L888–L910 | `ai-import-itinerary` 廣播事件與跳轉邏輯原樣保留 | 生成行程點擊「立即匯入」驗證 |
| **7** | **天氣數據即時感知** | L182–L200 | `useWeatherStore` 注入行程上下文邏輯原樣保留 | 詢問天氣驗證 AI 回傳真實均溫 |
| **8** | **失敗重試按鈕** | L945–L960 | `lastFailedMessage` 重新發送按鈕原樣保留 | 模擬網路中斷驗證重試按鈕 |

---

## 五、 結論

透過本方案：
1. **業務大腦 100% 留存**：`chat-widget.tsx` 中最敏感的 350 行串流通訊、自癒中斷、資料注入完全未被破壞。
2. **手勢衝突完美閉環**：透過 `dragControls` 徹底隔絕訊息捲動與抽屜手勢。
3. **體驗指數級躍升**：告別呆板客服圓球與單行輸入框，達成真正的 iOS 26 Liquid Glass 絲滑感。
