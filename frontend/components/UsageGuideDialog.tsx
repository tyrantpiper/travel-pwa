"use client"

import { BookOpen, AlertCircle } from "lucide-react"
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import { useLanguage } from "@/lib/LanguageContext"

interface UsageGuideDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

// 🆕 步驟元件
function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
    return (
        <div className="flex gap-3 items-start">
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs shrink-0 mt-0.5">
                {n}
            </div>
            <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
            </div>
        </div>
    )
}

function Tip({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 p-2.5 rounded-lg border border-amber-100 dark:border-amber-800 flex items-start gap-2 mt-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="text-xs leading-relaxed">{children}</span>
        </div>
    )
}

export function UsageGuideDialog({ open, onOpenChange }: UsageGuideDialogProps) {
    const { lang } = useLanguage()
    const zh = lang === 'zh'

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0 gap-0">
                <DialogHeader className="sticky top-0 z-10 bg-white dark:bg-slate-800 p-5 pb-3 border-b border-slate-200 dark:border-slate-700">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                        {zh ? '使用說明' : 'Usage Guide'}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-400">
                        {zh ? '了解如何使用 Tabidachi 的所有功能' : 'Learn how to use all Tabidachi features'}
                    </DialogDescription>
                </DialogHeader>

                <div className="p-4">
                    <Accordion type="single" collapsible className="w-full space-y-2">

                        {/* ===== 1. 行程管理 ===== */}
                        <AccordionItem value="trip" className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <span className="text-sm font-medium flex items-center gap-2">
                                    🗺️ {zh ? '行程管理' : 'Trip Management'}
                                </span>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 space-y-3">
                                <Step n={1}
                                    title={zh ? '建立新行程' : 'Create New Trip'}
                                    desc={zh ? '在行程列表頁面點擊右上角「+」按鈕，填寫行程名稱與日期範圍，即可建立新行程。' : 'Tap the "+" button on the trip list page. Enter trip name and date range to create.'}
                                />
                                <Step n={2}
                                    title={zh ? 'AI 匯入行程' : 'AI Import Trip'}
                                    desc={zh ? '前往「工具箱 🧰」→ AI 工具，貼上行程文字或截圖，AI 會自動解析產生完整行程！' : 'Go to "Tools 🧰" → AI Tools. Paste itinerary text or screenshot, and AI will auto-generate a complete trip!'}
                                />
                                <Step n={3}
                                    title={zh ? '加入他人行程' : 'Join Others\' Trip'}
                                    desc={zh ? '在行程列表點擊「加入代碼」，輸入朋友分享給你的行程邀請碼即可加入。' : 'Tap "Join Code" on the trip list and enter the invite code shared by your friend.'}
                                />
                                <Step n={4}
                                    title={zh ? '切換行程' : 'Switch Trip'}
                                    desc={zh ? '點擊頂部行程名稱旁的下拉箭頭，即可在不同行程之間快速切換。' : 'Tap the dropdown arrow next to the trip name at the top to switch between trips.'}
                                />
                                <Step n={5}
                                    title={zh ? '新增 / 刪除天數' : 'Add / Delete Days'}
                                    desc={zh ? '滑到行程底部可看到「新增天數」按鈕。系統支援智能克隆：可複製前一天的 Checklist、Notes 等資料到新的一天。' : 'Scroll to the bottom to find "Add Day". Smart clone can copy previous day\'s checklist and notes.'}
                                />
                                <Step n={6}
                                    title={zh ? '分享行程' : 'Share Trip'}
                                    desc={zh ? '點擊行程頁面右上角的分享按鈕 📤，可透過原生分享或複製公開連結分享給任何人瀏覽。' : 'Tap the share button 📤 at the top right. Share via native share or copy the public link.'}
                                />
                                <Tip>{zh ? '只有行程創建者可以刪除行程；其他成員可以選擇離開行程。' : 'Only the trip creator can delete a trip; other members can choose to leave.'}</Tip>
                            </AccordionContent>
                        </AccordionItem>

                        {/* ===== 2. 行程編輯技巧 ===== */}
                        <AccordionItem value="edit" className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <span className="text-sm font-medium flex items-center gap-2">
                                    ✏️ {zh ? '行程編輯技巧' : 'Editing Tips'}
                                </span>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 space-y-3">
                                <Step n={1}
                                    title={zh ? '新增活動' : 'Add Activity'}
                                    desc={zh ? '點擊每日行程下方的「+」按鈕，填寫時間、地點、備註，即可新增一個活動。' : 'Tap the "+" button below the daily timeline. Fill in time, place, and notes to add an activity.'}
                                />
                                <Step n={2}
                                    title={zh ? '⭐ 貼上 Google Maps 連結' : '⭐ Paste Google Maps Link'}
                                    desc={zh ? '在編輯活動的「地點」欄位直接貼入 Google Maps 連結（包括 iPhone 分享的短連結），系統會自動解析出地名和座標！再也不用手動輸入地址。' : 'Paste a Google Maps link (including iPhone short links) in the "Place" field. The system auto-resolves the name and coordinates!'}
                                />
                                <Step n={3}
                                    title={zh ? '地點搜尋' : 'Place Search'}
                                    desc={zh ? '在地點欄位輸入文字後點擊搜尋圖示，系統會即時搜尋並顯示結果，選擇後自動填入地名與座標。' : 'Type in the place field and tap search. The system finds results in real-time. Select to auto-fill name and coordinates.'}
                                />
                                <Step n={4}
                                    title={zh ? '拖曳排序' : 'Drag to Reorder'}
                                    desc={zh ? '長按活動卡片左側可拖曳移動，調整當天行程的先後順序。' : 'Long press the left side of an activity card to drag and reorder the daily schedule.'}
                                />
                                <Step n={5}
                                    title={zh ? '分類標籤' : 'Category Tags'}
                                    desc={zh ? '編輯活動時選擇分類（🍽️ 餐飲 / 🚃 交通 / 🛍️ 購物 / 🏨 住宿 / 🎭 活動），卡片會顯示對應圖示。' : 'Choose a category when editing (🍽️ Food / 🚃 Transit / 🛍️ Shopping / 🏨 Hotel / 🎭 Activity) for icon display.'}
                                />
                                <Step n={6}
                                    title={zh ? '自訂 Tags' : 'Custom Tags'}
                                    desc={zh ? '在編輯活動底部可加入自訂標籤，方便分類和搜尋。' : 'Add custom tags at the bottom of the activity editor for easy categorization.'}
                                />
                                <Tip>{zh ? '支援各種格式的 Google Maps 連結，包括短網址和完整網址，貼上即自動辨識！' : 'All Google Maps link formats are supported, including short URLs and full URLs. Just paste and go!'}</Tip>
                            </AccordionContent>
                        </AccordionItem>

                        {/* ===== 3. 備忘錄與筆記 ===== */}
                        <AccordionItem value="memo" className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <span className="text-sm font-medium flex items-center gap-2">
                                    📝 {zh ? '備忘錄與筆記' : 'Memos & Notes'}
                                </span>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 space-y-3">
                                <Step n={1}
                                    title={zh ? '活動備忘錄' : 'Activity Memo'}
                                    desc={zh ? '點擊任何活動卡片可展開詳情，在備忘欄（memo）記錄注意事項、營業時間等資訊。' : 'Tap any activity card to expand details. Use the memo field to record notes, opening hours, etc.'}
                                />
                                <Step n={2}
                                    title={zh ? '相關連結' : 'Related Links'}
                                    desc={zh ? '活動詳情中可新增多個連結（訂位連結、餐廳官網、IG 頁面等），點擊即可開啟。' : 'Add multiple links in activity details (booking links, restaurant pages, etc.). Tap to open.'}
                                />
                                <Step n={3}
                                    title={zh ? '⭐ 連結中貼入地圖網址' : '⭐ Paste Map URL in Links'}
                                    desc={zh ? '在連結欄位貼入 Google Maps 網址，系統會自動解析座標，活動卡片上會顯示導航按鈕。' : 'Paste a Google Maps URL in the link field. The system auto-resolves coordinates and shows navigation.'}
                                />
                                <Step n={4}
                                    title={zh ? '每日注意事項（Info 頁）' : 'Daily Notes (Info Page)'}
                                    desc={zh ? '切換到 Info 頁 → 展開每日提示區 → 可新增多條注意事項，支援 emoji 圖示選擇（⚠️💡✈️🚇等）。' : 'Go to Info tab → expand daily tips → add notes with emoji icons (⚠️💡✈️🚇 etc.).'}
                                />
                                <Step n={5}
                                    title={zh ? '照片紀錄' : 'Photo Gallery'}
                                    desc={zh ? '在活動詳情中可上傳多張照片作為行程紀錄，支援圖片預覽與縮放。' : 'Upload multiple photos in activity details as travel records. Supports preview and zoom.'}
                                />
                            </AccordionContent>
                        </AccordionItem>

                        {/* ===== 4. Info 資訊頁 ===== */}
                        <AccordionItem value="info" className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <span className="text-sm font-medium flex items-center gap-2">
                                    📋 {zh ? 'Info 資訊頁' : 'Info Page'}
                                </span>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 space-y-3">
                                <Step n={1}
                                    title={zh ? '航班資訊' : 'Flight Information'}
                                    desc={zh ? '記錄去程/回程的航空公司、班號、PNR 確認碼、座位、起降時間。卡片式展示一目了然。' : 'Record airline, flight number, PNR, seats, and times for outbound/inbound flights.'}
                                />
                                <Step n={2}
                                    title={zh ? '住宿資訊' : 'Accommodation'}
                                    desc={zh ? '新增飯店名稱、地址、訂單編號、電話。支援貼入 Google Maps 連結自動解析位置！還可加入 Wi-Fi 密碼、門鎖密碼等備忘。' : 'Add hotel name, address, booking ID, phone. Supports Google Maps link auto-resolve! Add Wi-Fi/lock codes in memo.'}
                                />
                                <Step n={3}
                                    title={zh ? '每日花費預估' : 'Daily Cost Estimate'}
                                    desc={zh ? '展開每日花費區塊，預先估算每日預算項目與金額，支援多幣別（JPY/USD/TWD 等）。' : 'Expand daily cost section to estimate budget items. Supports multiple currencies (JPY/USD/TWD).'}
                                />
                                <Step n={4}
                                    title={zh ? '每日票券' : 'Daily Tickets'}
                                    desc={zh ? '記錄每日需要的門票、車票、體驗票券的名稱與價格。' : 'Record daily tickets, passes, and experience tickets with names and prices.'}
                                />
                                <Step n={5}
                                    title={zh ? '每日 Checklist 待辦' : 'Daily Checklist'}
                                    desc={zh ? '建立每日待辦清單，勾選完成後會自動排序到底部。支援編輯和刪除。' : 'Create daily to-do lists. Checked items auto-sort to the bottom. Supports edit and delete.'}
                                />
                                <Step n={6}
                                    title={zh ? '🔒 隱私模式' : '🔒 Privacy Mode'}
                                    desc={zh ? 'Checklist、花費、票券項目支援「私人」模式（點擊眼睛圖示 👁️），設為私人後其他行程成員看不到該項目。' : 'Checklist, costs, and tickets support "Private" mode (tap 👁️). Private items are hidden from other trip members.'}
                                />
                                <Tip>{zh ? '住宿的「導航網址」欄位可直接貼 Google Maps 連結，自動抓取座標！' : 'Paste a Google Maps link in the hotel "Navigation URL" field for auto coordinate extraction!'}</Tip>
                            </AccordionContent>
                        </AccordionItem>

                        {/* ===== 5. 地圖功能 ===== */}
                        <AccordionItem value="map" className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <span className="text-sm font-medium flex items-center gap-2">
                                    🗺️ {zh ? '地圖功能' : 'Map Features'}
                                </span>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 space-y-3">
                                <Step n={1}
                                    title={zh ? '每日路線圖' : 'Daily Route Map'}
                                    desc={zh ? '每天的行程會自動根據地點座標繪製路線圖，可看到整天的移動軌跡。' : 'Daily itineraries auto-generate route maps based on coordinates, showing the full day\'s path.'}
                                />
                                <Step n={2}
                                    title={zh ? '全螢幕地圖' : 'Fullscreen Map'}
                                    desc={zh ? '點擊地圖可展開為全螢幕模式，支援 POI 搜尋和地點探索。' : 'Tap the map to expand fullscreen. Supports POI search and place discovery.'}
                                />
                                <Step n={3}
                                    title={zh ? 'POI 搜尋 & 加入行程' : 'POI Search & Add'}
                                    desc={zh ? '在全螢幕地圖中搜尋附近景點、餐廳等，點擊查看詳情（評價、照片），一鍵加入當天行程。' : 'Search nearby spots and restaurants in fullscreen map. View details (ratings, photos) and add to today\'s plan.'}
                                />
                                <Step n={4}
                                    title={zh ? '設定每日位置' : 'Set Daily Location'}
                                    desc={zh ? '點擊天氣面板的「修改地點」可手動設定每日所在城市，影響天氣預報和搜尋偏好。' : 'Tap "Change Location" on the weather panel to set the daily city, affecting weather forecasts and search.'}
                                />
                            </AccordionContent>
                        </AccordionItem>

                        {/* ===== 6. 工具箱 ===== */}
                        <AccordionItem value="tools" className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <span className="text-sm font-medium flex items-center gap-2">
                                    🧰 {zh ? '工具箱' : 'Toolbox'}
                                </span>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 space-y-3">
                                <Step n={1}
                                    title={zh ? '消費記錄' : 'Expense Tracking'}
                                    desc={zh ? '切到「工具 🧰」頁面，點擊「+」新增消費，可選分類（餐飲/交通/購物等）、付款方式（現金/Suica/信用卡等）。' : 'Go to "Tools 🧰", tap "+" to add expenses. Choose category and payment method.'}
                                />
                                <Step n={2}
                                    title={zh ? '多幣別自動換算' : 'Multi-Currency'}
                                    desc={zh ? '記帳時可選擇幣別（JPY/USD/EUR/KRW/HKD/TWD），系統會自動以即時匯率換算成預設貨幣。' : 'Select currency when recording (JPY/USD/EUR/KRW/HKD/TWD). Auto-converts with real-time exchange rates.'}
                                />
                                <Step n={3}
                                    title={zh ? '消費圖表分析' : 'Expense Charts'}
                                    desc={zh ? '自動生成消費比例圖表，直覺了解錢花在哪裡。' : 'Auto-generated spending charts show where your money goes at a glance.'}
                                />
                                <Step n={4}
                                    title={zh ? '信用卡回饋管理' : 'Credit Card Rewards'}
                                    desc={zh ? '新增信用卡資訊（名稱、回饋率、回饋上限），記帳時選擇信用卡可自動計算回饋金額。' : 'Add credit cards (name, reward rate, limit). Selecting a card auto-calculates cashback.'}
                                />
                                <Step n={5}
                                    title={zh ? '收據上傳' : 'Receipt Upload'}
                                    desc={zh ? '記帳時可拍照或上傳收據圖片，方便日後查看和退稅。' : 'Take a photo or upload receipt images when recording expenses for future reference and tax refunds.'}
                                />
                                <Tip>{zh ? 'AI 工具可以幫你自動解析截圖中的消費明細！拍照就能記帳。' : 'AI tools can auto-parse expense details from screenshots! Just take a photo to record.'}</Tip>
                            </AccordionContent>
                        </AccordionItem>

                        {/* ===== 7. AI 助手 ===== */}
                        <AccordionItem value="ai" className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <span className="text-sm font-medium flex items-center gap-2">
                                    🤖 {zh ? 'AI 助手' : 'AI Assistant'}
                                </span>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 space-y-3">
                                <Step n={1}
                                    title={zh ? '開啟 AI 聊天' : 'Open AI Chat'}
                                    desc={zh ? '點擊右下角的藍紫色圓球 💬 即可開啟 AI 對話。可拖曳調整圓球位置。' : 'Tap the blue-purple circle 💬 at bottom-right to open AI chat. Drag to reposition.'}
                                />
                                <Step n={2}
                                    title={zh ? '行程健檢' : 'Trip Health Check'}
                                    desc={zh ? '跟 AI 說「幫我看這行程順不順」或「幫我健檢」，AI 會分析你目前的行程安排，提供優化建議。' : 'Ask AI "Check if my itinerary makes sense" and it will analyze your schedule and provide optimization tips.'}
                                />
                                <Step n={3}
                                    title={zh ? '圖片辨識' : 'Image Recognition'}
                                    desc={zh ? '點擊聊天視窗左下角的圖片圖示 🖼️ 上傳照片，AI 可辨識菜單、翻譯、推薦餐點。' : 'Tap the image icon 🖼️ to upload a photo. AI can read menus, translate, and recommend dishes.'}
                                />
                                <Step n={4}
                                    title={zh ? 'API Key 設定（免費）' : 'API Key Setup (Free)'}
                                    desc={zh ? '前往 Profile → AI API Key → 按照指示到 Google AI Studio 免費取得 API Key。每日可用 1,500 次！' : 'Go to Profile → AI API Key → Follow steps to get a free key from Google AI Studio. 1,500 calls/day!'}
                                />
                                <Tip>{zh ? 'AI 助手會自動讀取你目前的行程資料，所以回答會根據你的行程量身定制！' : 'AI assistant auto-reads your current itinerary, so answers are tailored to your specific trip!'}</Tip>
                            </AccordionContent>
                        </AccordionItem>

                        {/* ===== 8. 多人協作 ===== */}
                        <AccordionItem value="collab" className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <span className="text-sm font-medium flex items-center gap-2">
                                    👥 {zh ? '多人協作' : 'Collaboration'}
                                </span>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 space-y-3">
                                <Step n={1}
                                    title={zh ? '邀請成員' : 'Invite Members'}
                                    desc={zh ? '每個行程都有一個邀請碼（行程設定中可看到），將邀請碼分享給朋友即可邀請他們加入。' : 'Each trip has an invite code (visible in trip settings). Share it with friends to invite them.'}
                                />
                                <Step n={2}
                                    title={zh ? '成員管理' : 'Member Management'}
                                    desc={zh ? '點擊行程頁面的成員圖示 👥，可查看所有成員。行程創建者可以踢出成員。' : 'Tap the members icon 👥 on the trip page to view all members. Trip creator can remove members.'}
                                />
                                <Step n={3}
                                    title={zh ? '即時同步' : 'Real-time Sync'}
                                    desc={zh ? '所有成員的編輯會即時同步，不需要手動重新整理。多人同時編輯不會互相覆蓋。' : 'All edits sync in real-time. No need to refresh. Simultaneous edits won\'t overwrite each other.'}
                                />
                                <Step n={4}
                                    title={zh ? '公開分享連結' : 'Public Share Link'}
                                    desc={zh ? '透過分享按鈕可產生公開連結，非成員也能以唯讀方式瀏覽整份行程。' : 'Generate a public link via the share button. Non-members can view the full itinerary (read-only).'}
                                />
                            </AccordionContent>
                        </AccordionItem>

                        {/* ===== 9. 設定與帳號 ===== */}
                        <AccordionItem value="settings" className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <span className="text-sm font-medium flex items-center gap-2">
                                    ⚙️ {zh ? '設定與帳號' : 'Settings & Account'}
                                </span>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 space-y-3">
                                <Step n={1}
                                    title={zh ? '主題切換' : 'Theme Switch'}
                                    desc={zh ? '支援深色 / 淺色模式切換，以及 5 種主題色可選。' : 'Toggle dark/light mode and choose from 5 accent colors.'}
                                />
                                <Step n={2}
                                    title={zh ? '語言切換' : 'Language Switch'}
                                    desc={zh ? '支援繁體中文與 English 切換，大部分介面文字會即時更新。' : 'Switch between Traditional Chinese and English. Most UI text updates instantly.'}
                                />
                                <Step n={3}
                                    title={zh ? '⚠️ Recovery Key（引繼碼）' : '⚠️ Recovery Key'}
                                    desc={zh ? '這是你的帳號識別碼！更換手機或清除瀏覽器資料前，務必複製並妥善保存。可在 Profile 頁面找到。' : 'This is your account ID! Before switching phones or clearing browser data, copy and save it. Found on Profile page.'}
                                />
                                <Step n={4}
                                    title={zh ? 'PWA 安裝到桌面' : 'Install as PWA'}
                                    desc={zh ? '在手機瀏覽器中點擊「加入主畫面」，即可像原生 App 一樣從桌面開啟，享受全螢幕體驗。' : 'Tap "Add to Home Screen" in your mobile browser to use like a native app with fullscreen experience.'}
                                />
                                <Tip>{zh ? 'Recovery Key 非常重要！這是唯一能還原帳號的方式，請務必備份。' : 'Recovery Key is critical! It\'s the only way to restore your account. Always back it up.'}</Tip>
                            </AccordionContent>
                        </AccordionItem>

                    </Accordion>
                </div>
            </DialogContent>
        </Dialog>
    )
}
