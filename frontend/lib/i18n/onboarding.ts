/**
 * Onboarding translations — WelcomeWizard and TaskCard copy.
 *
 * Consumed by:
 *   - `WelcomeWizard.tsx` (3-step onboarding flow)
 *   - `TaskCard.tsx` (gamified task tracker)
 *
 * Key prefixes:
 *   - `wz_*` — WelcomeWizard steps, buttons, hints
 *   - `tc_*` — TaskCard labels and celebration text
 */
export const onboardingTranslations = {
    en: {
        // WelcomeWizard — Steps
        wz_step1_title: "Create Your First Trip",
        wz_step1_subtitle: "Start planning your adventure",
        wz_step1_desc: "Tap \"New Trip\" at the top-left to create one, or let AI generate a complete itinerary.",
        wz_step2_title: "Enable AI Assistant",
        wz_step2_subtitle: "Unlock smart planning",
        wz_step2_desc: "Set up your Gemini API Key to use AI trip planning, translation, and recommendations. It's free!",
        wz_step3_title: "Explore More Features",
        wz_step3_subtitle: "Your travel companion",
        wz_step3_desc: "Expense tracking, PDF export, live weather, map navigation... everything you need for your trip!",

        // WelcomeWizard — Buttons & Hints
        wz_get_key: "Get Key from Google AI Studio",
        wz_setup_later: "You can set this later in Profile → AI API Key",
        wz_prev: "Back",
        wz_next: "Next",
        wz_start: "Start Journey",
        wz_skip: "Skip for now, explore other features",

        // 🚀 Spotlight Tour
        tour_step: "Step",
        tour_of: "of",
        tour_skip: "Skip Tour",
        tour_prev: "Previous",
        tour_next: "Next",
        tour_finish: "Start Journey",
        tour_restart: "Restart Interactive Tour",
        tour_restart_desc: "Replay the step-by-step guided walkthrough to explore core features",
        tour_step1_title: "Enable AI Companion",
        tour_step1_desc: "Connect your free Gemini API Key to unlock real-time AI itinerary planning and smart translations.",
        tour_step1_action: "👉 Tap the highlighted button to set up (or click Next to set later)",
        tour_step2_title: "Ryan AI Assistant",
        tour_step2_desc: "Have questions on the road? Tap the AI companion anytime for live recommendations, tips, and instant answers.",
        tour_step2_action: "👉 Tap the AI Assistant to open chat, or click Next",
        tour_step3_title: "Create Your Journey",
        tour_step3_desc: "Start planning your adventure! Customize dates and destinations or let AI build a complete schedule.",
        tour_step3_action: "👉 Tap the New Trip button to begin",
        tour_step4_title: "Explore Sample Itinerary",
        tour_step4_desc: "Tap the sample trip to explore 3D great-circle flight arcs, daily timelines, and street-level views.",
        tour_step4_action: "👉 Tap the trip card to open details",
        tour_step5_title: "Travel Tools & Expense Ledger",
        tour_step5_desc: "Multi-currency offline ledger, auto exchange rate conversion, group bill splitting, and checklist.",
        tour_step5_action: "👉 Tap the Tools tab on the navigation bar",
        tour_step6_title: "You're All Set!",
        tour_step6_desc: "You have explored all core features! You can always replay this tour from Profile → Usage Guide.",
        tour_step6_action: "🚀 Ready for takeoff! Tap Start Journey below",

        // TaskCard (Preserved for compatibility)
        tc_title: "Getting Started",
        tc_set_nickname: "Set a Nickname",
        tc_create_trip: "Create Your First Trip",
        tc_setup_ai: "Set Up AI API Key",
        tc_add_expense: "Add Your First Expense",
        tc_done: "Done!",
        tc_go_setup: "Go to Settings →",
        tc_congrats: "Awesome!",
        tc_all_done: "You've completed all starter tasks",
    },
    zh: {
        // WelcomeWizard — Steps
        wz_step1_title: "建立你的第一個行程",
        wz_step1_subtitle: "開始規劃精彩旅程",
        wz_step1_desc: "點擊左上角「新增行程」建立行程，或使用 AI 自動生成完整行程規劃。",
        wz_step2_title: "啟用 AI 助手",
        wz_step2_subtitle: "解鎖智能規劃功能",
        wz_step2_desc: "設定 Gemini API Key 即可使用 AI 行程規劃、翻譯、推薦等功能。完全免費！",
        wz_step3_title: "探索更多功能",
        wz_step3_subtitle: "你的旅行好幫手",
        wz_step3_desc: "費用追蹤、PDF 匯出、即時天氣、地圖導航...所有旅行所需功能一應俱全！",

        // WelcomeWizard — Buttons & Hints
        wz_get_key: "前往 Google AI Studio 獲取 Key",
        wz_setup_later: "可稍後在 Profile → AI API Key 設定",
        wz_prev: "上一步",
        wz_next: "下一步",
        wz_start: "開始旅程",
        wz_skip: "稍後再說，先看看其他功能",

        // 🚀 Spotlight Tour
        tour_step: "步驟",
        tour_of: "/",
        tour_skip: "跳過導引",
        tour_prev: "上一步",
        tour_next: "下一步",
        tour_finish: "立即出發",
        tour_restart: "重新啟動互動導引",
        tour_restart_desc: "重新體驗一步一步帶著走的聚光燈新手導引，快速熟悉核心操作",
        tour_step1_title: "啟用 AI 智慧旅伴",
        tour_step1_desc: "Tabidachi 具備即時行程生成與語意建議功能。綁定免費 Gemini API Key 即可解鎖核心 AI 規劃能力。",
        tour_step1_action: "👉 請點擊左上角亮起的按鈕開啟設定（亦可點擊下一步稍後再設）",
        tour_step2_title: "Ryan AI 隨行助理",
        tour_step2_desc: "旅途中有任何疑問？隨時點擊右下角 AI 助理，為你即時解答行程問題、景點推薦與在地資訊。",
        tour_step2_action: "👉 點擊 AI 助理開啟對話，體驗即時問答",
        tour_step3_title: "建立專屬旅程",
        tour_step3_desc: "開始規劃您的專屬冒險！您可以手動輸入天數與目的地，或輸入提示詞讓 AI 自動生成完整每日動線。",
        tour_step3_action: "👉 請點擊「＋ 建立行程」按鈕",
        tour_step4_title: "進入範例行程探索",
        tour_step4_desc: "點擊精選範例行程，立即進入體驗 3D 大圓飛行航線、每日景點時間軸與 Mapillary 實景街景漫遊。",
        tour_step4_action: "👉 請點擊行程卡片進入詳細檢視",
        tour_step5_title: "多幣別記帳與旅行工具箱",
        tour_step5_desc: "內建多幣別離線記帳、即時匯率自動換算、多人分帳與行李清單，即使在飛機離線無網路時也能隨手記帳。",
        tour_step5_action: "👉 請點擊底部導覽列「工具」分頁",
        tour_step6_title: "探索完成，準備出發！",
        tour_step6_desc: "您已完全掌握 Tabidachi 的核心功能！隨時可於「個人檔案 ➔ 使用說明」第一項重新開啟這項導引。",
        tour_step6_action: "🚀 準備就緒！請點擊下方「立即出發」開始旅程",

        // TaskCard (Preserved for compatibility)
        tc_title: "新手任務",
        tc_set_nickname: "設定暱稱",
        tc_create_trip: "建立第一個行程",
        tc_setup_ai: "設定 AI API Key",
        tc_add_expense: "新增第一筆消費",
        tc_done: "完成！",
        tc_go_setup: "前往設定 →",
        tc_congrats: "太棒了！",
        tc_all_done: "你已完成所有新手任務",
    },
} as const
