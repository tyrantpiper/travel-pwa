# Tabidachi 領域模型 (Domain Models)

## 🧳 旅遊與行程模型 (Travel & Itinerary)

### TripPlan (取代舊稱 Itinerary)
使用者規劃的完整旅遊行程，包含多個 Destination。
_Avoid_: itinerary, schedule, trip, journey

### Destination
行程中的單一目的地，包含 POI (景點) 清單。
_Avoid_: location, place, spot, stop

### AITripItinerary
AI 生成的主題性行程，包含每日活動 `AIDayPlan` 與活動細目 `AIActivityItem`。
_Avoid_: ai_plan, auto_schedule

## 💰 財務與記帳模型 (Financial & Expense)

### ExpenseRequest / ExpenseResponse
使用者的單筆消費紀錄，支援多幣別 (`currency`)、匯率 (`exchange_rate`) 與細目拆分 (`items`)。
_Avoid_: transaction, spending, cost

### ExpenseItem
消費細目項目，包含原始名稱與翻譯名稱。
_Avoid_: sub_expense, item_detail

### ReceiptExtraction
AI 收據解析結果，包含小計、稅金、小費等金額拆分 (`tax_amount`, `tip_amount`, `service_charge_amount`)。
_Avoid_: ocr_result, scanned_receipt

### ActuaryRequest (AI 精算師)
AI 財務分析對話，負責拆帳與費用建議。
_Avoid_: ai_accountant, finance_bot

## ⚙️ 系統狀態模型 (System State)

### OfflineCache
PWA 的 ServiceWorker 緩存狀態。值：Synced | Dirty。
_Avoid_: local storage, cache state, offline data

---

# 開發慣例 (Conventions)
- **Frontend**: Next.js 16 (App Router), 原子設計 (atoms/molecules)
- **Backend**: FastAPI, Pydantic v2 schemas (`backend/models/base.py`)
- **Testing**: Vitest (Unit), Playwright (E2E)
- **Tailwind**: Tailwind CSS v4 語法 (`bg-linear-to-br` 而非 `bg-gradient-to-br`)

---

# Flagged Ambiguities
- **"Trip"**: 曾同時指 TripPlan 與單次移動。現統一：TripPlan 指完整行程，單次移動使用 Leg。
- **"Amount"**: 記帳時，`total_amount` 為總金額，為兼容舊版同時接受 `amount_jpy`，但實作應優先使用 `total_amount` 搭配 `currency`。
