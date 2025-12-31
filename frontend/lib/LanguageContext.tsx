"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { translations, TranslationKey } from './translations'

type Language = 'en' | 'zh'

interface LanguageContextType {
    lang: Language
    setLang: (lang: Language) => void
    t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<Language>('zh')
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration: must set mounted after client render
        setMounted(true)

        const saved = localStorage.getItem('app_language') as Language
        if (saved && (saved === 'en' || saved === 'zh')) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- Initialization from localStorage on mount is intentional
            setLangState(saved)
        }
    }, [])

    const setLang = (newLang: Language) => {
        setLangState(newLang)
        localStorage.setItem('app_language', newLang)
    }

    const t = (key: TranslationKey): string => {
        return translations[lang][key] || key
    }

    // Prevent hydration mismatch
    if (!mounted) {
        return <>{children}</>
    }

    return (
        <LanguageContext.Provider value={{ lang, setLang, t }}>
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
            t: (key: TranslationKey) => translations.zh[key] || key
        }
    }
    return context
}
