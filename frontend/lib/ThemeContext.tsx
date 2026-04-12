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

interface ThemeContextType {
    isDark: boolean
    setIsDark: (dark: boolean) => void
    toggleDark: () => void
    accentColor: AccentColor
    setAccentColor: (color: AccentColor) => void
    currentTheme: typeof ACCENT_COLORS[AccentColor]
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [isDark, setIsDark] = useState(false)
    const [accentColor, setAccentColor] = useState<AccentColor>("default")
    const [mounted, setMounted] = useState(false)

    // 初始化時從 localStorage 讀取
    useEffect(() => {
        if (typeof window !== "undefined") {
            const savedDark = localStorage.getItem("dark_mode") === "true"
            const savedAccent = localStorage.getItem("accent_color") as AccentColor

            setTimeout(() => {
                setIsDark(savedDark)
                if (savedAccent && ACCENT_COLORS[savedAccent]) {
                    setAccentColor(savedAccent)
                }
                setMounted(true)
            }, 0)
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

    return (
        <ThemeContext.Provider value={{
            isDark,
            setIsDark,
            toggleDark,
            accentColor,
            setAccentColor,
            currentTheme
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
