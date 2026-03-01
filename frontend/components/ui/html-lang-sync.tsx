"use client"

import { useEffect } from "react"
import { useLanguage } from "@/lib/LanguageContext"

/**
 * 同步 HTML lang 屬性與使用者語言設定
 * 確保螢幕閱讀器、SEO 爬蟲讀到正確的語言標記
 * 
 * 放在 LanguageProvider 內部，確保能讀到 context
 * layout.tsx 的 <html> 已有 suppressHydrationWarning，不會觸發 hydration 錯誤
 */
export function HtmlLangSync() {
    const { lang } = useLanguage()

    useEffect(() => {
        document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en'
    }, [lang])

    return null  // 不渲染任何 UI
}
