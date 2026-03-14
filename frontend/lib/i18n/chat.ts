/**
 * AI Chat translations — greetings, error messages, and UI labels.
 * Consumed by `chat-widget.tsx`.
 *
 * ⚠️ IMPORTANT: These translations are for the CHAT UI only.
 *    AI system prompts (e.g. weather_context, memory summaries sent to Gemini)
 *    must NEVER be translated — they are model instructions, not user-facing text.
 */
export const chatTranslations = {
    en: {
        ai_subtitle: "Your AI Travel Expert",
        ai_greet_msg:
            "👋 Hi! I'm Ryan, your AI travel expert!\n\n💡 **I can help you with:**\n• Translation, restaurant recommendations, transit info\n• Solve any travel problems\n• 🩺 **Itinerary checkup**: Just say \"Check if my itinerary makes sense?\"\n\nHow can I help? 😎",
        ai_apikey_missing:
            "⚠️ Please set up your AI API Key first!\n\nGo to **Profile** → Click **AI API Key** to configure.\n\n💡 It's completely free!",
        ai_image_uploaded: " [Image uploaded]",
        ai_stop: "Stop generating",
        ai_retry: "🔄 Resend",
        ai_ask_placeholder: "Ask Ryan...",
        ai_sources: "Sources",
        ai_summarizing: "🧠 Organizing memory...",
        ai_summarized: "🧠 Memory organized!",
        ai_summary_failed: "Summary failed:",
        ai_using_memory: "🧠 Continuing with memory summary~",
        ai_history_limit:
            "💬 Chat history limit reached, keeping recent 25 messages~",
        ai_connection_error: "🔥 Connection lost! Click resend below.",
        ai_itinerary_found: "Itinerary Found",
        ai_sending_to_import: "Sending to import...",
        ai_one_click_import: "Import Itinerary",
        ai_ready_to_import: "Itinerary ready to import!",
    },
    zh: {
        ai_subtitle: "你的 AI 旅遊達人",
        ai_greet_msg:
            "👋哈囉！我是 Ryan，你的 AI 旅遊達人！\n\n💡 **我能幫你：**\n• 翻譯、推薦美食、查詢交通\n• 解決旅途中的疑難雜症\n• 🩺 **行程健檢**：跟我說「幫我看這行程順不順？」\n\n有什麼我可以幫忙的嗎？😎",
        ai_apikey_missing:
            "⚠️ 請先設定 AI API Key！\n\n前往 **Profile** 頁面 → 點擊 **AI API Key** 進行設定。\n\n💡 完全免費！",
        ai_image_uploaded: " [圖片已上傳]",
        ai_stop: "停止生成",
        ai_retry: "🔄 重新發送",
        ai_ask_placeholder: "問問 Ryan...",
        ai_sources: "資料來源",
        ai_summarizing: "🧠 正在整理記憶...",
        ai_summarized: "🧠 記憶整理完成！",
        ai_summary_failed: "摘要失敗:",
        ai_using_memory: "🧠 使用記憶摘要繼續對話~",
        ai_history_limit: "💬 對話記錄已達上限，保留最近 25 條訊息~",
        ai_connection_error: "🔥 連線中斷！點擊下方重試按鈕。",
        ai_itinerary_found: "發現行程",
        ai_sending_to_import: "傳送至匯入工具...",
        ai_one_click_import: "立即匯入行程",
        ai_ready_to_import: "行程已準備好匯入！",
    },
} as const
