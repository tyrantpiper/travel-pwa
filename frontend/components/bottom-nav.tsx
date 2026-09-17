"use client"
import { Map, Info, Wrench, UserCircle } from "lucide-react"
import { useLanguage } from "@/lib/LanguageContext"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { useTheme } from "@/lib/ThemeContext"
import { useHaptic } from "@/lib/hooks"

interface BottomNavProps {
    activeTab: string
    onTabChange: (tab: string) => void
    onActiveTabClick?: (tab: string) => void // 🆕 當前分頁點擊回調
    isVisible?: boolean // 🆕 滾動狀態監控
}

export function BottomNav({ activeTab, onTabChange, onActiveTabClick, isVisible = true }: BottomNavProps) {
    const { t } = useLanguage()
    const { currentTheme, accentColor } = useTheme()
    const haptic = useHaptic()

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
            className="fixed z-100 bottom-[max(env(safe-area-inset-bottom,16px),16px)] left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-sm"
        >
            <div className={cn(
                "relative rounded-full px-2 flex justify-around items-center h-17 select-none transition-colors duration-200",
                "transform-gpu will-change-transform",
                // 物理 Liquid Glass：高飽和透光 + 雙重鏡面光緣 (Rim Light)
                "bg-white/75 dark:bg-slate-950/75 backdrop-blur-2xl saturate-190",
                "border border-white/40 dark:border-white/10",
                "shadow-[inset_0_1.5px_1px_0_rgba(255,255,255,0.85),inset_0_-1px_1px_0_rgba(0,0,0,0.05),0_12px_36px_rgba(0,0,0,0.12)]"
            )}>
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => {
                                haptic.selection()
                                if (isActive) {
                                    onActiveTabClick?.(tab.id)
                                } else {
                                    onTabChange(tab.id)
                                }
                            }}
                            className={cn(
                                "relative flex flex-col items-center justify-center w-full h-[85%] gap-1 rounded-full transition-all duration-200 z-10 cursor-pointer active:scale-95 select-none",
                                isActive 
                                    ? (accentColor === 'default' ? "text-slate-900 dark:text-white font-bold" : "font-bold") 
                                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                            )}
                            style={isActive && accentColor !== 'default' ? { color: currentTheme.primary } : {}}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="nav-indicator"
                                    className={cn(
                                        "absolute inset-0 rounded-full -z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_2px_8px_rgba(0,0,0,0.06)]",
                                        accentColor === 'default' && "bg-slate-100/85 dark:bg-white/15 border border-white/60 dark:border-white/15"
                                    )}
                                    style={accentColor !== 'default' ? {
                                        backgroundColor: `${currentTheme.primary}22`,
                                        border: `1px solid ${currentTheme.primary}40`
                                    } : undefined}
                                    transition={{ type: "spring", stiffness: 420, damping: 28 }}
                                />
                            )}
                            <tab.icon className="w-5.5 h-5.5" strokeWidth={isActive ? 2.5 : 1.5} />
                            <span className="text-[10px] font-semibold tracking-tight">{tab.label}</span>
                        </button>
                    );
                })}
            </div>
        </motion.div>
    )
}
