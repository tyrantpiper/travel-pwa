"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

export const ACCENT_COLORS = {
    default: {
        name: "預設",
        gradient: "from-slate-700 to-slate-900",
        primary: "#1e293b",
        icon: "⚪"
    },
    amber: {
        name: "Amber",
        gradient: "from-amber-400 to-orange-500",
        primary: "#f59e0b",
        icon: "🟠"
    },
    blue: {
        name: "Ocean",
        gradient: "from-blue-400 to-cyan-500",
        primary: "#3b82f6",
        icon: "🔵"
    },
    green: {
        name: "Forest",
        gradient: "from-green-400 to-emerald-500",
        primary: "#22c55e",
        icon: "🟢"
    },
    rose: {
        name: "Rose",
        gradient: "from-rose-400 to-pink-500",
        primary: "#f43f5e",
        icon: "🔴"
    },
    purple: {
        name: "Violet",
        gradient: "from-purple-400 to-indigo-500",
        primary: "#a855f7",
        icon: "🟣"
    }
} as const

export type AccentColor = keyof typeof ACCENT_COLORS

export type FontScale = 100 | 110 | 120 | 130
export const VALID_FONT_SCALES: readonly FontScale[] = [100, 110, 120, 130] as const

export const FONT_SCALE_TIERS: Record<FontScale, { scale: FontScale; labelZh: string; labelEn: string; descZh: string; descEn: string }> = {
    100: { scale: 100, labelZh: "標準", labelEn: "Standard", descZh: "原始黃金比例", descEn: "Original golden ratio" },
    110: { scale: 110, labelZh: "適讀", labelEn: "Readable", descZh: "舒適閱讀", descEn: "Comfortable reading" },
    120: { scale: 120, labelZh: "清晰", labelEn: "Clear", descZh: "戶外與行進易讀", descEn: "Outdoor & on-the-go" },
    130: { scale: 130, labelZh: "醒目", labelEn: "Prominent", descZh: "最大字級醒目無礙", descEn: "Maximum visibility" },
}

interface ThemeContextType {
    isDark: boolean
    setIsDark: (dark: boolean) => void
    toggleDark: () => void
    accentColor: AccentColor
    setAccentColor: (color: AccentColor) => void
    currentTheme: typeof ACCENT_COLORS[AccentColor]
    fontScale: FontScale
    setFontScale: (scale: FontScale) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [isDark, setIsDark] = useState(false)
    const [accentColor, setAccentColor] = useState<AccentColor>("default")
    const [fontScale, setFontScaleState] = useState<FontScale>(100)
    const [mounted, setMounted] = useState(false)

    // 初始化時從 localStorage 讀取
    useEffect(() => {
        if (typeof window !== "undefined") {
            const savedDark = localStorage.getItem("dark_mode") === "true"
            const savedAccent = localStorage.getItem("accent_color") as AccentColor
            const rawScale = localStorage.getItem("app_font_scale")
            const parsedScale = Number(rawScale) as FontScale
            const validScale = VALID_FONT_SCALES.includes(parsedScale) ? parsedScale : 100

            setTimeout(() => {
                setIsDark(savedDark)
                if (savedAccent && ACCENT_COLORS[savedAccent]) {
                    setAccentColor(savedAccent)
                }
                setFontScaleState(validScale)
                // 🛡️ 確保 DOM 與屬性精準對齊，不發生二次跳動
                document.documentElement.style.fontSize = `${validScale}%`
                document.documentElement.setAttribute("data-font-scale", String(validScale))
                setMounted(true)
            }, 0)

            // 🔄 多分頁同源即時同步 (Multi-Tab Storage Sync)
            const handleStorage = (e: StorageEvent) => {
                if (e.key === "app_font_scale" && e.newValue) {
                    const newScale = Number(e.newValue) as FontScale
                    if (VALID_FONT_SCALES.includes(newScale)) {
                        setFontScaleState(newScale)
                        document.documentElement.style.fontSize = `${newScale}%`
                        document.documentElement.setAttribute("data-font-scale", String(newScale))
                    }
                }
            }
            window.addEventListener("storage", handleStorage)
            return () => window.removeEventListener("storage", handleStorage)
        }
    }, [])

    // 當 isDark 改變時，更新 html class 和 localStorage
    useEffect(() => {
        if (!mounted) return

        const html = document.documentElement
        if (isDark) {
            html.classList.add("dark")
        } else {
            html.classList.remove("dark")
        }
        localStorage.setItem("dark_mode", String(isDark))
    }, [isDark, mounted])

    // 當 accentColor 改變時，更新 localStorage 和 CSS 變數
    useEffect(() => {
        if (!mounted) return
        localStorage.setItem("accent_color", accentColor)

        // 設置 CSS 變數讓全站可以使用
        const root = document.documentElement
        const theme = ACCENT_COLORS[accentColor]
        root.style.setProperty("--accent-color", theme.primary)
        root.style.setProperty("--primary", theme.primary) // 🆕 同步至 Tailwind 核心變數
        root.style.setProperty("--accent-gradient", `linear-gradient(135deg, var(--tw-gradient-stops))`)
    }, [accentColor, mounted])

    const toggleDark = () => setIsDark(prev => !prev)
    const currentTheme = ACCENT_COLORS[accentColor]

    const setFontScale = (scale: FontScale) => {
        if (!VALID_FONT_SCALES.includes(scale)) return
        setFontScaleState(scale)
        if (typeof window !== "undefined") {
            document.documentElement.style.fontSize = `${scale}%`
            document.documentElement.setAttribute("data-font-scale", String(scale))
            try {
                localStorage.setItem("app_font_scale", String(scale))
            } catch (e) {
                console.warn("[ThemeContext] Failed to persist font scale to localStorage:", e)
            }
        }
    }

    return (
        <ThemeContext.Provider value={{
            isDark,
            setIsDark,
            toggleDark,
            accentColor,
            setAccentColor,
            currentTheme,
            fontScale,
            setFontScale
        }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider")
    }
    return context
}
