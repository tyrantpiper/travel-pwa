"use client"

import { BookOpen, AlertCircle } from "lucide-react"
import {
    Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import { useLanguage } from "@/lib/LanguageContext"

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
        <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 p-3 rounded-xl border border-amber-100 dark:border-amber-800 flex items-start gap-2.5 mt-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="text-xs leading-relaxed">{children}</span>
        </div>
    )
}

export function UsageGuideContent() {
    const { lang } = useLanguage()
    const zh = lang === 'zh'

    const handleRestartTour = () => {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("tabidachi-restart-tour"))
        }
    }

    return (
        <div className="space-y-4">
            {/* 🚀 1. 互動式新手導引重啟卡片 (置於使用說明第一位) */}
            <div className="p-4 rounded-2xl bg-linear-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-pink-950/30 border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-md">
                        <span className="text-lg">🚀</span>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span>{zh ? '重新啟動新手互動導引' : 'Restart Interactive Tour'}</span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            {zh ? '一步一步帶著走，重新體驗 AI 旅伴、行程建立與 3D 地圖核心操作' : 'Experience the step-by-step guided walkthrough to explore AI, trips, and 3D maps'}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleRestartTour}
                    className="self-end sm:self-center px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                    <span>{zh ? '立即啟動' : 'Start Tour'}</span>
                    <span>→</span>
                </button>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-stone-200/60 dark:border-slate-700/60 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {zh ? 'Tabidachi 全功能操作手冊' : 'Tabidachi Comprehensive Guide'}
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {zh ? '收錄 3D 巡航、全球實景、離線同步與 11 大核心模組操作詳解' : 'Complete instructions for 3D tours, street view, offline sync, and 11 core modules'}
                    </p>
                </div>
            </div>

            <Accordion type="single" collapsible className="w-full space-y-3">

                {/* ===== 1. 行程管理 ===== */}
                <AccordionItem value="trip" className="border border-stone-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <span className="text-sm font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            🗺️ {zh ? '行程管理' : 'Trip Management'}
                        </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 space-y-3">
                        <Step n={1}
                            title={zh ? '建立新行程' : 'Create New Trip'}
                            desc={zh ? '在行程列表頁面點擊「+」按鈕，填寫行程名稱與日期範圍，即可建立新行程。' : 'Tap the "+" button on the trip list page. Enter trip name and date range to create.'}
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
                            title={zh ? '增減與管理天數' : 'Adjust & Manage Days'}
                            desc={zh ? '點擊行程頂部的日期區間膠囊，即可在日曆中重新挑選起訖日期以增減天數；在天數標籤列選取特定日期時，亦可點擊「刪除此天」進行單日刪減。' : 'Tap the date capsule at the top to pick new dates and adjust trip duration. When viewing a specific day, you can also tap "Delete Day" to remove it.'}
                        />
                        <Step n={6}
                            title={zh ? '分享行程' : 'Share Trip'}
                            desc={zh ? '點擊行程頁面頂端導覽列的分享按鈕 📤，可透過原生分享或複製公開連結分享。' : 'Tap the share button 📤 at the top. Share via native share or copy the public link.'}
                        />
                        <Step n={7}
                            title={zh ? '⛅ 5 天微氣候即時預報帶' : '⛅ 5-Day Live Microclimate Forecast'}
                            desc={zh ? '行程總覽（Day 0）頂部提供 5 天連續氣象帶，即時監控最高/最低溫與降水機率，輔助行程打包穿搭。' : 'Trip Master Overview (Day 0) features a 5-day live weather strip showing high/low temps and rain probabilities.'}
                        />
                        <Tip>{zh ? '只有行程創建者可以刪除行程；其他成員可以選擇離開行程。' : 'Only the trip creator can delete a trip; other members can choose to leave.'}</Tip>
                    </AccordionContent>
                </AccordionItem>

                {/* ===== 2. 行程編輯技巧 ===== */}
                <AccordionItem value="edit" className="border border-stone-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <span className="text-sm font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-100">
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
                            title={zh ? '📅 跨月份日曆區間選取' : '📅 Multi-Month Date Range Picker'}
                            desc={zh ? '建立或調整行程時，可上下滑動連續瀏覽各月份日曆，直覺點選出發與回程日期。' : 'Scroll smoothly across months to effortlessly select your trip departure and return dates.'}
                        />
                        <Tip>{zh ? '支援各種格式的 Google Maps 連結，包括短網址和完整網址，貼上即自動辨識！' : 'All Google Maps link formats are supported, including short URLs and full URLs. Just paste and go!'}</Tip>
                    </AccordionContent>
                </AccordionItem>

                {/* ===== 3. 備忘錄與筆記 ===== */}
                <AccordionItem value="memo" className="border border-stone-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <span className="text-sm font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            📝 {zh ? '備忘錄與筆記' : 'Memos & Notes'}
                        </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 space-y-3">
                        <Step n={1}
                            title={zh ? '活動備忘錄' : 'Activity Memo'}
                            desc={zh ? '點擊任何活動卡片可展開詳情，在備忘欄（memo）記錄注意事項、營業時間等資訊。' : 'Tap any activity card to expand details. Use the memo field to record notes, opening hours, etc.'}
                        />
                        <Step n={2}
                            title={zh ? '活動官網與訂位連結' : 'Official Website & Booking Links'}
                            desc={zh ? '活動詳情中可填入店家官網、訂位網址或 IG 頁面，點擊即可一鍵開啟外部瀏覽；亦可填入導航連結自動解析座標！' : 'Add restaurant websites, booking links, or social pages to any activity card for one-tap browsing, alongside map navigation links!'}
                        />
                        <Step n={3}
                            title={zh ? '⭐ 連結中貼入地圖網址' : '⭐ Paste Map URL in Links'}
                            desc={zh ? '在連結欄位貼入 Google Maps 網址，系統會自動解析座標，活動卡片上會顯示導航按鈕。' : 'Paste a Google Maps URL in the link field. The system auto-resolves coordinates and shows navigation.'}
                        />
                        <Step n={4}
                            title={zh ? '每日注意事項與備忘' : 'Daily Tips & Notes'}
                            desc={zh ? '在每日行程的時間軸上方展開提示區，即可為當天新增多條注意事項，支援 emoji 圖示（⚠️💡✈️🚇等）醒目標記。' : 'Expand the daily tips section above your timeline to add notes with emoji icons (⚠️💡✈️🚇 etc.) for quick reminders.'}
                        />
                        <Step n={5}
                            title={zh ? '每日 Checklist 待辦清單' : 'Daily Checklist'}
                            desc={zh ? '在每日行程頂部可建立當天專屬待辦清單，勾選完成會自動排序到底部，支援編輯與刪除。' : 'Create a daily to-do list at the top of each day. Checked items automatically sort to the bottom.'}
                        />
                        <Step n={6}
                            title={zh ? '每日花費與票券記錄' : 'Daily Costs & Tickets'}
                            desc={zh ? '展開每日提示區可預先登記當日門票與花費項目，並支援「私人模式」（點擊 👁️）對同團旅伴隱藏。' : 'Record daily tickets and estimated expenses above the timeline, with private mode (👁️) to hide personal items from group members.'}
                        />
                        <Step n={7}
                            title={zh ? '照片紀錄' : 'Photo Gallery'}
                            desc={zh ? '在活動詳情中可上傳多張照片作為行程紀錄，支援圖片預覽與縮放。' : 'Upload multiple photos in activity details as travel records. Supports preview and zoom.'}
                        />
                    </AccordionContent>
                </AccordionItem>

                {/* ===== 4. Info 資訊與預訂中心 ===== */}
                <AccordionItem value="info" className="border border-stone-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <span className="text-sm font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            📋 {zh ? 'Info 資訊與預訂中心' : 'Info & Booking Center'}
                        </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 space-y-3">
                        <Step n={1}
                            title={zh ? '航班資訊' : 'Flight Information'}
                            desc={zh ? '記錄去程/回程的航空公司、班號、PNR 確認碼、座位、起降時間。卡片式展示一目了然。' : 'Record airline, flight number, PNR, seats, and times for outbound/inbound flights.'}
                        />
                        <Step n={2}
                            title={zh ? '住宿資訊' : 'Accommodation & Hotels'}
                            desc={zh ? '新增飯店名稱、地址、訂單編號、電話。支援貼入 Google Maps 連結自動解析位置！還可加入 Wi-Fi 密碼、門鎖密碼等備忘。' : 'Add hotel name, address, booking ID, phone. Supports Google Maps link auto-resolve! Add Wi-Fi/lock codes in memo.'}
                        />
                        <Step n={3}
                            title={zh ? '機酒與景點票券預訂' : 'Travel Booking Hub'}
                            desc={zh ? '預訂專區依據你的行程目的地，自動提供各大平台的飯店住宿、熱門景點門票與一日遊專屬推薦特惠。' : 'The booking tab automatically curates hotel stays, popular attraction passes, and day tours tailored to your trip destination.'}
                        />
                        <Step n={4}
                            title={zh ? '多航段彈性管理' : 'Multi-Leg Flight Segments'}
                            desc={zh ? '支援去程與回程自由增減多個航段（Leg），包含轉機航班、不同航廈與座位號碼皆可完整登記。' : 'Easily add or remove flight legs for outbound and inbound journeys, supporting layovers, terminal details, and seats.'}
                        />
                        <Tip>{zh ? '住宿的「導航網址」欄位可直接貼 Google Maps 連結，自動抓取座標！' : 'Paste a Google Maps link in the hotel "Navigation URL" field for auto coordinate extraction!'}</Tip>
                    </AccordionContent>
                </AccordionItem>

                {/* ===== 5. 2D 多日大地圖功能 ===== */}
                <AccordionItem value="map" className="border border-stone-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <span className="text-sm font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            🗺️ {zh ? '多日大地圖與交通' : 'Multi-Day Master Map & Routing'}
                        </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 space-y-3">
                        <Step n={1}
                            title={zh ? '跨天總覽與單日切換' : 'Multi-Day Overview & Day Views'}
                            desc={zh ? '點擊頂部天數切換籤，地圖相機將自動計算最佳視角邊界，平滑飛行至當天所有景點的全覽視野。' : 'Switching days smoothly animates the camera viewport to fit all activities of that day.'}
                        />
                        <Step n={2}
                            title={zh ? '🚶‍♂️🚗🚌 多模態交通路線切換' : '🚶‍♂️🚗🚌 Travel Mode Switching'}
                            desc={zh ? '地圖控制列可即時切換「步行」、「開車」與「大眾運輸」三種路線，即時重新規劃並顯示清楚的道路軌跡。' : 'Toggle between Walking, Driving, and Transit modes on the fly to view clear, real-time route paths.'}
                        />
                        <Step n={3}
                            title={zh ? '🛰️ 衛星空拍與街道地圖' : '🛰️ Satellite & Street Map Views'}
                            desc={zh ? '點擊衛星按鈕即可切換真實衛星空拍圖與清晰街道地圖，山川地形與街道建築一覽無遺。' : 'Switch between high-resolution satellite imagery and clean street maps to explore your surroundings.'}
                        />
                        <Step n={4}
                            title={zh ? '📍 即時定位' : '📍 Live Location'}
                            desc={zh ? '點擊右上角懸浮按鈕的定位圖示，地圖立即平滑移動至你所在的即時位置。' : 'Tap the locate button in the floating capsule to smoothly center the map on your current position.'}
                        />
                        <Step n={5}
                            title={zh ? '景點搜尋與加入行程' : 'Explore Places & Add to Trip'}
                            desc={zh ? '在全螢幕地圖中搜尋附近景點、餐廳與地標，點擊查看評分與照片，一鍵直接排入行程。' : 'Search nearby places and attractions. View ratings and photos, and add them directly to your itinerary.'}
                        />
                        <Tip>{zh ? '長按地圖任意位置可插下自訂紅針，快速建立私房景點！' : 'Long-press anywhere on the map to drop a custom pin and create secret spots!'}</Tip>
                    </AccordionContent>
                </AccordionItem>

                {/* ===== 6. 3D 景觀巡航與全球實景 (全新專屬章節) ===== */}
                <AccordionItem value="tour" className="border border-stone-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <span className="text-sm font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            ✈️ {zh ? '3D 景觀巡航與全球實景' : '3D Cinematic Tour & Street View'}
                        </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 space-y-3">
                        <Step n={1}
                            title={zh ? '啟動 3D 低空巡航' : 'Launch 3D Low-Altitude Tour'}
                            desc={zh ? '當天有 2 個以上景點時，地圖上方會出現「✈️ 3D 巡航」按鈕。點擊後視角自動切換為立體俯瞰，順著飛行路線低空飛掠各景點。' : 'When 2+ spots exist, tap "✈️ 3D Tour". The view smoothly shifts to a 3D aerial perspective, gliding across all spots along your itinerary.'}
                        />
                        <Step n={2}
                            title={zh ? '🔄 360° 景點上空盤旋' : '🔄 360° Orbiting at POIs'}
                            desc={zh ? '抵達每個景點後，鏡頭會自動進入 360 度低空環繞盤旋模式，全景欣賞地標四周風景。' : 'Upon reaching each destination, the camera automatically enters smooth 360° orbital rotation.'}
                        />
                        <Step n={3}
                            title={zh ? '🎛️ 懸浮控制面板' : '🎛️ Floating Tour Controls'}
                            desc={zh ? '懸浮面板即時顯示當前站點與飛行進度。可隨時按「暫停」自由瀏覽地圖、「繼續」或跳至「下一站」。' : 'The floating control pill displays your current stop and tour progress. Tap "Pause" to explore freely, "Resume", or skip to "Next".'}
                        />
                        <Step n={4}
                            title={zh ? '📷 360° 全球真實街景' : '📷 360° Real-World Street View'}
                            desc={zh ? '在控制面板或景點資訊中點擊「街景」，即可開啟 360 度全景真實街景視圖，身臨其境預覽景點周邊。' : 'Tap "Street View" in the tour controls or place details to launch an immersive 360° panoramic view of your destination.'}
                        />
                        <Tip>{zh ? '巡航過程中可隨時暫停或切換視角，自由探索景點四周環境！' : 'You can pause the tour or adjust your viewing angle anytime to freely explore surrounding areas!'}</Tip>
                    </AccordionContent>
                </AccordionItem>

                {/* ===== 7. 離線優先與秒開同步 (全新專屬章節) ===== */}
                <AccordionItem value="offline" className="border border-stone-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <span className="text-sm font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            📶 {zh ? '離線模式與秒開同步' : 'Offline-First & Auto Sync'}
                        </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 space-y-3">
                        <Step n={1}
                            title={zh ? '飛航模式 0 秒極速啟動' : 'Zero-Second Instant Boot in Airplane Mode'}
                            desc={zh ? 'Tabidachi 具備極速離線運算架構，即使完全沒有網路或處於飛航模式，也能瞬間秒開查閱！' : 'Tabidachi features an instant offline architecture, booting and loading your plans immediately even without internet or in airplane mode.'}
                        />
                        <Step n={2}
                            title={zh ? '離線查閱行程與快取圖資' : 'Browse Itinerary & Cached Tiles Offline'}
                            desc={zh ? '已瀏覽過的行程細節、筆記、航班住宿與地圖瓦片皆會持久化保存於本機，出國未辦漫遊也能隨時查閱。' : 'Previously loaded itineraries, notes, flights, and map tiles remain fully accessible offline without roaming.'}
                        />
                        <Step n={3}
                            title={zh ? '離線無憂查閱與行程快照' : 'Offline Browsing & Local Snapshots'}
                            desc={zh ? '在完全沒有網路的地下鐵或機艙內，依然能順暢瀏覽行程安排、景點筆記、航班住宿資訊與地圖瓦片。' : 'Freely browse all itinerary details, notes, flight/hotel bookings, and map tiles even without network in subways or flights.'}
                        />
                        <Step n={4}
                            title={zh ? '🔄 安全網路自動重連' : '🔄 Seamless Auto-Reconnection'}
                            desc={zh ? '重新連上網路時，系統會自動核驗最新雲端版本並靜默同步更新，確保跨裝置資料始終保持一致。' : 'Upon reconnecting, the system automatically verifies the latest cloud version and syncs updates seamlessly.'}
                        />
                        <Tip>{zh ? '出發前先在飯店連線開啟一次行程，讓地圖與資料完成預熱快取，旅途更加安心！' : 'Open your trip once on hotel Wi-Fi before heading out to pre-warm offline map caches!'}</Tip>
                    </AccordionContent>
                </AccordionItem>

                {/* ===== 8. 工具箱與智慧記帳 ===== */}
                <AccordionItem value="tools" className="border border-stone-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <span className="text-sm font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            🧰 {zh ? '工具箱與智慧記帳' : 'Toolbox & Smart Expense'}
                        </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 space-y-3">
                        <Step n={1}
                            title={zh ? '新增消費記錄' : 'Add Expense'}
                            desc={zh ? '切換至「工具 🧰」頁，點擊「+」新增消費，選擇分類（餐飲/交通/購物/住宿）與付款方式。' : 'Go to "Tools 🧰", tap "+" to record costs. Choose category and payment method.'}
                        />
                        <Step n={2}
                            title={zh ? '🌍 全球 110+ 國幣別與國旗支援' : '🌍 110+ World Currencies with Flags'}
                            desc={zh ? '支援全球超過 110 種各國貨幣，每一種皆配有清晰的國旗圖示，出國記帳一目了然。' : 'Supports over 110 world currencies with clear country flag icons, making foreign expense tracking effortless.'}
                        />
                        <Step n={3}
                            title={zh ? '💡 目的地智慧貨幣判定' : '💡 Smart Destination Currency Default'}
                            desc={zh ? '建立行程時系統會依據目的地國家名稱（如日本、美國、歐洲），自動判定並優先為你選定官方貨幣（JPY、USD、EUR）。' : 'Auto-infers and presets the official currency based on destination (e.g. Japan -> JPY, USA -> USD).'}
                        />
                        <Step n={4}
                            title={zh ? '信用卡回饋即時折抵試算' : 'Instant Credit Card Cashback Calculation'}
                            desc={zh ? '記帳選擇信用卡付款時，可直接填入該卡海外回饋率（%），系統會自動換算折抵金額並顯示於總帳明細中。' : 'When paying by credit card, enter your card\'s cashback percentage to auto-calculate savings right on your expense breakdown.'}
                        />
                        <Step n={5}
                            title={zh ? '收據拍照存證' : 'Receipt Photo Archiving'}
                            desc={zh ? '每筆消費可拍攝或上傳實體收據圖片，日後可原圖放大查看明細，退稅出示極方便。' : 'Attach physical receipt photos to any expense for easy tax refund verification.'}
                        />
                        <Step n={6}
                            title={zh ? '🧾 AI 收據圖片自動拆分' : '🧾 AI Receipt Auto-Parsing'}
                            desc={zh ? '使用 AI 辨識功能上傳收據照片，AI 自動萃取商家名稱、品項明細、稅金 (Tax) 與服務費 (Tip)。' : 'Upload receipt images to AI Parse. It automatically extracts merchant name, items, taxes, and tips.'}
                        />
                        <Step n={7}
                            title={zh ? '多人旅費公帳即時同步' : 'Shared Group Travel Ledger'}
                            desc={zh ? '記帳時可選擇付款人與分攤成員，旅伴開啟各自手機即可即時查看最新總支出與分類明細，結算帳目清晰省心。' : 'Assign payers and split members on any expense. Travel companions see real-time shared expenses and category breakdowns on their own devices.'}
                        />
                        <Tip>{zh ? '點擊統計圖表可隨時切換分類佔比與每日花費趨勢，讓你輕鬆掌握每筆旅費預算！' : 'Tap expense charts to view category breakdowns and daily spending trends, keeping your trip budget on track!'}</Tip>
                    </AccordionContent>
                </AccordionItem>

                {/* ===== 9. AI 助手 ===== */}
                <AccordionItem value="ai" className="border border-stone-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <span className="text-sm font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            🤖 {zh ? 'AI 旅遊助手 (Ryan AI)' : 'AI Assistant (Ryan AI)'}
                        </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 space-y-3">
                        <Step n={1}
                            title={zh ? '懸浮 AI 伴遊小球' : 'Floating AI Companion Orb'}
                            desc={zh ? '右下角的藍紫色小球可隨心拖曳至螢幕任意位置，點擊即可召喚 Ryan AI 伴遊助手。' : 'Drag the floating blue-purple orb anywhere on your screen and tap to open your Ryan AI travel assistant.'}
                        />
                        <Step n={2}
                            title={zh ? '行程健檢與智慧診斷' : 'Itinerary Health Check & Advice'}
                            desc={zh ? '直接對話「幫我健檢行程」或「看路線順不順」，AI 會深度評估時間緊湊度、交通合理性並提出優化方案。' : 'Ask "Check my itinerary", and AI evaluates transit feasibility, schedule density, and optimizes order.'}
                        />
                        <Step n={3}
                            title={zh ? '多國菜單與圖片辨識' : 'Menu Translation & Vision Recognition'}
                            desc={zh ? '上傳各國餐廳菜單照片，AI 即時翻譯菜色、標註過敏原並推薦招牌必吃餐點。' : 'Upload foreign restaurant menus. AI translates dishes, highlights allergens, and recommends favorites.'}
                        />
                        <Step n={4}
                            title={zh ? '✨ 景點推薦卡片一鍵排入' : '✨ One-Tap Spot Recommendation Cards'}
                            desc={zh ? '請 AI 推薦景點時，對話中會生成精美景點卡片，勾選喜歡的地點即可一鍵加入指定天數！' : 'When AI recommends places, it presents interactive cards. Check your favorites to add them directly to your itinerary in one tap.'}
                        />
                        <Step n={5}
                            title={zh ? '💬 對話即時記帳與景點異動' : '💬 In-Chat Expense & Item Actions'}
                            desc={zh ? '告訴 AI「剛吃了 1500 日圓拉麵」或「刪除明天的某個景點」，AI 會即時在對話中生成操作確認卡片，確認後立即生效！' : 'Tell AI "Spent 1500 JPY on ramen" or "Remove a spot tomorrow", and interactive action cards appear in chat to execute directly.'}
                        />
                        <Step n={6}
                            title={zh ? '自備免費金鑰與偏好記憶' : 'Free API Key & Travel Preferences'}
                            desc={zh ? '支援填入個人免費的 Gemini API 金鑰（僅儲存於手機保護隱私），AI 同時會自動記住你的旅遊喜好。' : 'Add your own free Gemini API key (safely stored on your device only), while AI automatically adapts to your travel preferences.'}
                        />
                        <Tip>{zh ? 'AI 伴遊助手會自動整合你當前的行程資訊與偏好，所有建議皆為你的旅程量身定制！' : 'Ryan AI automatically references your current itinerary and preferences to provide tailored suggestions for your trip!'}</Tip>
                    </AccordionContent>
                </AccordionItem>

                {/* ===== 10. 多人協作 ===== */}
                <AccordionItem value="collab" className="border border-stone-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <span className="text-sm font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            👥 {zh ? '多人即時協作' : 'Real-time Collaboration'}
                        </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 space-y-3">
                        <Step n={1}
                            title={zh ? '專屬邀請碼' : 'Trip Invite Code'}
                            desc={zh ? '在行程設定中可取得 6 碼專屬邀請碼，發送給好友即可直接加入共同編輯行程。' : 'Find your 6-character invite code in trip settings. Share it with friends for collaborative planning.'}
                        />
                        <Step n={2}
                            title={zh ? '成員權限管理' : 'Member Management'}
                            desc={zh ? '行程創建者可點擊成員圖示隨時檢視旅伴清單，並擁有管理與退出行程之權限。' : 'Trip creators can view the members list and manage permissions at any time.'}
                        />
                        <Step n={3}
                            title={zh ? '毫秒級即時同步' : 'Millisecond Real-time Sync'}
                            desc={zh ? '所有人的排程更動皆能跨裝置毫秒級即時廣播，多人同時編輯不互相覆蓋。' : 'Edits sync across all devices in real-time. Simultaneous editing is fully conflict-safe.'}
                        />
                        <Step n={4}
                            title={zh ? '免登入公開分享' : 'Login-Free Public Share'}
                            desc={zh ? '產生只讀公開網址，長輩或非 App 用戶點擊即可在瀏覽器完整瀏覽精美行程。' : 'Generate read-only public URLs so family members can view your itinerary without logging in.'}
                        />
                    </AccordionContent>
                </AccordionItem>

                {/* ===== 11. 設定、推播與帳號安全 ===== */}
                <AccordionItem value="settings" className="border border-stone-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <span className="text-sm font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            ⚙️ {zh ? '設定、推播與帳號' : 'Settings, Push & Security'}
                        </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 space-y-3">
                        <Step n={1}
                            title={zh ? '主題與配色風格' : 'Theme & Color Accents'}
                            desc={zh ? '支援深色 (Dark Mode) 與淺色模式切換，並提供 5 款高級主題色彩自由配置。' : 'Toggle between Dark and Light mode, with 5 curated accent colors to personalize your view.'}
                        />
                        <Step n={2}
                            title={zh ? '多國語言切換' : 'Instant Language Toggle'}
                            desc={zh ? '支援繁體中文（zh-TW）與 English 即時熱切換，所有介面元素同步更新。' : 'Seamlessly switch between Traditional Chinese and English with real-time UI updates.'}
                        />
                        <Step n={3}
                            title={zh ? '🔔 推播通知與出發倒數' : '🔔 Push Notifications & Countdown'}
                            desc={zh ? '開啟推播通知後，可在行前收到行程倒數預警與即時異動提醒。' : 'Enable push notifications to receive countdown alerts and live itinerary updates before your trip.'}
                        />
                        <Step n={4}
                            title={zh ? '🎯 通知即時直達卡片' : '🎯 Direct Notification Navigation'}
                            desc={zh ? '收到提醒或變更推播時，點擊即可直接跳轉至該筆活動或記帳明細，並以醒目高亮標出位置。' : 'Tapping a push notification navigates straight to the target activity or expense item with clear visual highlighting.'}
                        />
                        <Step n={5}
                            title={zh ? '🔑 Recovery Key（引繼備份碼）' : '🔑 Recovery Key Account Backup'}
                            desc={zh ? '這是你的專屬身份憑證！換手機或清空快取前請至個人檔案複製保存，這是還原帳號的唯一金鑰。' : 'Your unique account credential! Copy and backup your recovery key in Profile to restore on new devices.'}
                        />
                        <Step n={6}
                            title={zh ? '📲 PWA 安裝至手機主畫面' : '📲 Install as Native PWA'}
                            desc={zh ? '在 iOS Safari 點擊「分享」→「加入主畫面」，或在 Android Chrome 點擊「安裝應用程式」，享受原生全螢幕體驗。' : 'Tap "Add to Home Screen" on iOS Safari or Android Chrome to enjoy a fullscreen native experience.'}
                        />
                        <Tip>{zh ? '若推播通知被系統誤封鎖，可至手機系統設定 → 應用程式 → 瀏覽器中重新解除「通知」權限。' : 'If push is blocked, check your phone OS settings under Browser > Notifications to unblock.'}</Tip>
                    </AccordionContent>
                </AccordionItem>

            </Accordion>
        </div>
    )
}
