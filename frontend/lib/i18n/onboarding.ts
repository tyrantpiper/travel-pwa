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

        // TaskCard
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

        // TaskCard
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
