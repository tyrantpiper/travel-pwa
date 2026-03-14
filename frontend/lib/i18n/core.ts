/**
 * Core UI translations — buttons, status labels, and common actions.
 * These keys are shared across virtually every component.
 */
export const coreTranslations = {
  en: {
    // Actions
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    back: "Back",
    search: "Search",
    copy: "Copy",
    create: "Create",
    upload: "Upload",
    update: "Update",
    refresh: "Refresh",
    close: "Close",
    share: "Share",
    saving: "Saving...",
    zoom_in: "Zoom In",
    zoom_out: "Zoom Out",
    zoom_reset: "Reset Zoom",

    // Status
    loading: "Loading...",
    copied: "Copied!",
    confirm_delete: "Delete?",
    update_success: "Updated!",
    update_failed: "Update failed",
    profile_api_key_required: "Please configure your Gemini API Key in the \"Profile\" tab.",
  },
  zh: {
    // Actions
    save: "儲存",
    cancel: "取消",
    delete: "刪除",
    edit: "編輯",
    add: "新增",
    back: "返回",
    search: "搜尋",
    copy: "複製",
    create: "建立",
    upload: "上傳",
    update: "更新",
    refresh: "重新整理",
    close: "關閉",
    share: "分享",
    saving: "儲存中...",
    zoom_in: "放大",
    zoom_out: "縮小",
    zoom_reset: "重置",

    // Status
    loading: "載入中...",
    copied: "已複製！",
    confirm_delete: "確定刪除？",
    update_success: "已更新！",
    update_failed: "更新失敗",
    profile_api_key_required: "請到下方導覽列的「個人檔案」頁面設定 Gemini API Key",
  },
} as const
