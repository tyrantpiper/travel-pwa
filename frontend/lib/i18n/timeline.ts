/**
 * Timeline card translations — edit actions, memo placeholders,
 * photo preview, link management, and toast messages.
 *
 * Consumed by `timeline-card.tsx` (both TimelineCard and TimelineCardDetail).
 */
export const timelineTranslations = {
    en: {
        // Card actions
        tl_add_memo: "Click to add a memo...",
        tl_navigate: "Navigate",
        tl_spot_memo: "Spot Memo",
        tl_photo_preview: "Photo Preview",
        tl_browse_photos: "Browse spot photos",
        tl_no_desc: "No description yet.",
        tl_edit_desc: "Edit details and personal memos",

        // Detail labels
        tl_booking_code: "Booking Code",
        tl_budget: "Budget",
        tl_primary_link: "Primary Link",
        tl_website: "Website",

        // Link management
        tl_links: "Links / Info",
        tl_link_title: "Title (e.g. Official Link)",
        tl_link_note: "Note (e.g. Bring tickets)",

        // Actions & toasts
        tl_resolving: "Resolving...",
        tl_saving: "Saving...",
        tl_save_changes: "Save Changes",
        tl_desc_updated: "Description and map preview updated",
        tl_image_parsed: "Image parsed successfully!",
        tl_parse_failed: "Could not parse URL: ",
        tl_parse_error: "Parse error occurred",
        tl_memo_placeholder: "Add personal memo...",

        // Overview / Master View
        ov_overview_tab: "Overview",
        ov_trip_pulse: "Trip Pulse & Summary",
        ov_total_days: "Days",
        ov_total_spots: "Spots",
        ov_total_budget: "Estimated Budget",
        ov_cities_visited: "Destinations",
        ov_view_day: "View Day Details",
        ov_empty_day_prompt: "🌱 No activities planned yet. Tap to plan this day!",
        ov_no_activities: "No activities",
        ov_daily_estimated_cost: "Est. Cost",

        // Calendar Range Picker
        cal_title: "Select Trip Dates",
        cal_select_range: "Tap start and end dates",
        cal_days_nights: "{days} Days {nights} Nights",
        cal_single_day: "1 Day Trip",
        cal_confirm_range: "Confirm Trip Dates",
        cal_jump_to_current: "Back to Trip Month",
        cal_jump_to_today: "Jump to Today",
        cal_reset: "Reset",
        cal_updating: "Updating trip dates...",
        cal_updated_success: "Trip dates updated!",
        cal_shorten_title: "Shorten Duration Warning",
        cal_shorten_desc: "Shortening the trip will affect items in truncated days. Please choose an action:",
        cal_merge_to_last: "Merge items to last day (Recommended)",
        cal_delete_truncated: "Delete truncated days",
        cal_cancel: "Cancel",
    },
    zh: {
        // Card actions
        tl_add_memo: "點擊新增備忘錄...",
        tl_navigate: "導航",
        tl_spot_memo: "景點備忘錄",
        tl_photo_preview: "圖片預覽",
        tl_browse_photos: "瀏覽景點圖片",
        tl_no_desc: "暫無描述。",
        tl_edit_desc: "編輯詳細資訊與個人備忘錄",

        // Detail labels
        tl_booking_code: "預約碼",
        tl_budget: "預算",
        tl_primary_link: "主要連結",
        tl_website: "官方網站",

        // Link management
        tl_links: "連結 / 資訊",
        tl_link_title: "標題 (e.g. 官方連結)",
        tl_link_note: "備註 (e.g. 記得帶門票)",

        // Actions & toasts
        tl_resolving: "解析中",
        tl_saving: "儲存中...",
        tl_save_changes: "儲存變更",
        tl_desc_updated: "描述與地圖預覽已更新",
        tl_image_parsed: "圖片解析成功！",
        tl_parse_failed: "無法解析網址：",
        tl_parse_error: "解析發生錯誤",
        tl_memo_placeholder: "加入個人備忘...",

        // Overview / Master View
        ov_overview_tab: "總覽",
        ov_trip_pulse: "行程全景指標",
        ov_total_days: "天數",
        ov_total_spots: "個景點",
        ov_total_budget: "預估總預算",
        ov_cities_visited: "跨足城市",
        ov_view_day: "查看此日詳情",
        ov_empty_day_prompt: "🌱 尚未安排活動，點擊立即規劃！",
        ov_no_activities: "暫無活動",
        ov_daily_estimated_cost: "預估花費",

        // Calendar Range Picker
        cal_title: "調整旅行日期",
        cal_select_range: "點選出發與結束日期",
        cal_days_nights: "{days} 天 {nights} 晚",
        cal_single_day: "1 天當日來回",
        cal_confirm_range: "確認變更日期",
        cal_jump_to_current: "回到行程月份",
        cal_jump_to_today: "跳至今日",
        cal_reset: "重設",
        cal_updating: "正在更新行程日期...",
        cal_updated_success: "行程日期已成功更新！",
        cal_shorten_title: "縮短行程天數提醒",
        cal_shorten_desc: "縮短天數將影響被截斷天數中的景點與活動，請選擇處理方式：",
        cal_merge_to_last: "合併景點至最後一天 (推薦)",
        cal_delete_truncated: "直接刪除被截斷天數",
        cal_cancel: "取消",
    },
} as const
