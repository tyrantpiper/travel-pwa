/**
 * Expense module translations — currencies, categories, and form labels.
 * Consumed primarily by `expense-dialog.tsx` and `tools-view.tsx`.
 */
export const expenseTranslations = {
    en: {
        // Section labels
        exp_amount: "Amount",
        exp_details: "Details",
        exp_category: "Category",
        exp_payment: "Payment Method",
        exp_receipt: "Receipt / Photo",

        // Form placeholders & messages
        exp_name_placeholder: "Expense name",
        exp_select_currency: "Select currency",
        exp_select_trip_first: "⚠️ Please select a trip first",
        exp_card_name: "Card name",
        exp_cashback: "Cashback %",
        exp_dialog_desc:
            "Fill in expense details including amount, currency, category, and payment method.",
        exp_save_failed: "Save failed",

        // Dynamic currency names (accessed via `t(`currency_${code}`)`)
        currency_JPY: "Yen",
        currency_USD: "USD",
        currency_EUR: "EUR",
        currency_KRW: "KRW",
        currency_CNY: "RMB",
        currency_THB: "THB",
        currency_SGD: "SGD",
        currency_HKD: "HKD",
        currency_TWD: "NTD",

        // Dynamic category names (accessed via `t(`cat_${key}`)`)
        cat_food: "Food",
        cat_transport: "Transport",
        cat_shopping: "Shopping",
        cat_hotel: "Hotel",
        cat_ticket: "Ticket",
        cat_general: "Other",
    },
    zh: {
        // Section labels
        exp_amount: "金額",
        exp_details: "明細",
        exp_category: "分類",
        exp_payment: "付款方式",
        exp_receipt: "收據 / 照片",

        // Form placeholders & messages
        exp_name_placeholder: "消費名稱",
        exp_select_currency: "選擇幣別",
        exp_select_trip_first: "⚠️ 請先選擇行程",
        exp_card_name: "卡片名稱",
        exp_cashback: "回饋%",
        exp_dialog_desc:
            "填寫消費資訊，包括金額、幣別、分類與付款方式。",
        exp_save_failed: "儲存失敗",

        // Dynamic currency names
        currency_JPY: "日幣",
        currency_USD: "美元",
        currency_EUR: "歐元",
        currency_KRW: "韓圓",
        currency_CNY: "人民幣",
        currency_THB: "泰銖",
        currency_SGD: "新幣",
        currency_HKD: "港幣",
        currency_TWD: "台幣",

        // Dynamic category names
        cat_food: "餐飲",
        cat_transport: "交通",
        cat_shopping: "購物",
        cat_hotel: "住宿",
        cat_ticket: "門票",
        cat_general: "其他",
    },
} as const
