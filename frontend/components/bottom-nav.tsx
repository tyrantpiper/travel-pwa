"use client"
import { Map, Info, Wrench, UserCircle } from "lucide-react"
import { useLanguage } from "@/lib/LanguageContext"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { useTheme } from "@/lib/ThemeContext"

interface BottomNavProps {
    activeTab: string
    onTabChange: (tab: string) => void
    onActiveTabClick?: (tab: string) => void // 🆕 當前分頁點擊回調
    isVisible?: boolean // 🆕 滾動狀態監控
}

export function BottomNav({ activeTab, onTabChange, onActiveTabClick, isVisible = true }: BottomNavProps) {
    const { t } = useLanguage()
    const { currentTheme, accentColor } = useTheme()

    const tabs = [
        { id: "itinerary", label: t('nav_itinerary'), icon: Map },
        { id: "info", label: t('nav_info'), icon: Info },
        { id: "tools", label: t('nav_tools'), icon: Wrench },
        { id: "profile", label: t('nav_profile'), icon: UserCircle },
    ]

    return (
        <motion.div
            initial={false}
            animate={{ 
                y: isVisible ? 0 : 120,
                opacity: isVisible ? 1 : 0
            }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="fixed z-[100] bottom-[max(env(safe-area-inset-bottom,16px),16px)] left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-sm"
        >
            <div className="bg-white/90 dark:bg-slate-950/90 backdrop-blur-2xl shadow-2xl dark:shadow-2xl border border-slate-200/50 dark:border-white/10 rounded-full px-2 flex justify-around items-center h-[68px]">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => {
                                if (isActive) {
                                    onActiveTabClick?.(tab.id)
                                } else {
                                    onTabChange(tab.id)
                                }
                            }}
                            className={cn(
                                "relative flex flex-col items-center justify-center w-full h-[85%] gap-1 rounded-full transition-colors duration-200 z-10",
                                isActive 
                                    ? (accentColor === 'default' ? "text-slate-900 dark:text-white" : "") 
                                    : "text-slate-500 hover:text-slate-800 dark:text-white/50 dark:hover:text-white/80"
                            )}
                            style={isActive && accentColor !== 'default' ? { color: currentTheme.primary } : {}}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="nav-indicator"
                                    className={cn(
                                        "absolute inset-0 rounded-full -z-10",
                                        accentColor === 'default' ? "bg-slate-100 dark:bg-white/15" : ""
                                    )}
                                    style={accentColor !== 'default' ? { backgroundColor: `${currentTheme.primary}20` } : {}}
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                />
                            )}
                            <tab.icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.5 : 1.5} />
                            <span className="text-[10px] font-semibold tracking-tight">{tab.label}</span>
                        </button>
                    );
                })}
            </div>
        </motion.div>
    )
}
