"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { translations, TranslationKey } from './i18n'

type Language = 'en' | 'zh'

interface LanguageContextType {
    lang: Language
    setLang: (lang: Language) => void
    t: (key: TranslationKey, params?: Record<string, string | number>) => string
    formatDate: (date: Date) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<Language>('zh')
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration: setMounted must be called to detect client
        setMounted(true)

        const saved = localStorage.getItem('app_language') as Language
        if (saved && (saved === 'en' || saved === 'zh')) {
            setLangState(saved)
        }
    }, [])

    const setLang = useCallback((newLang: Language) => {
        setLangState(newLang)
        localStorage.setItem('app_language', newLang)
        // Sync to cookie so Server Components (SSR) can read the language preference
        document.cookie = `app_language=${newLang}; path=/; max-age=31536000; SameSite=Lax`
    }, [])

    /**
     * Translate a key with optional parameter interpolation.
     * Usage: t('greeting', { name: 'Ryan' }) → "Hello, Ryan!"
     * The dictionary value should contain `{name}` as placeholder.
     */
    const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
        const dict = translations[lang] as Record<string, string>
        let result: string = dict[key] || key
        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
            })
        }
        return result
    }, [lang])

    /** Format a Date according to the current app language (not OS locale). */
    const formatDate = useCallback((date: Date): string => {
        return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-TW')
    }, [lang])

    // Prevent hydration mismatch
    if (!mounted) {
        return <>{children}</>
    }

    return (
        <LanguageContext.Provider value={{ lang, setLang, t, formatDate }}>
            {children}
        </LanguageContext.Provider>
    )
}

export function useLanguage() {
    const context = useContext(LanguageContext)
    if (!context) {
        // Return default values if not in provider (for SSR)
        return {
            lang: 'zh' as Language,
            setLang: () => { },
            t: (key: TranslationKey) => {
                const dict = translations.zh as Record<string, string>
                return dict[key] || key
            },
            formatDate: (date: Date) => date.toLocaleDateString('zh-TW'),
        }
    }
    return context
}
