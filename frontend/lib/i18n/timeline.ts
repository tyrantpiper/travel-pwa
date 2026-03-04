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
    },
} as const
