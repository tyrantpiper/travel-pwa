"use client"
import { Map, Info, Wrench, UserCircle } from "lucide-react"
import { useLanguage } from "@/lib/LanguageContext"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

interface BottomNavProps {
    activeTab: string
    onTabChange: (tab: string) => void
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
    const { t } = useLanguage()

    const tabs = [
        { id: "itinerary", label: t('nav_itinerary'), icon: Map },
        { id: "info", label: t('nav_info'), icon: Info },
        { id: "tools", label: t('nav_tools'), icon: Wrench },
        { id: "profile", label: t('nav_profile'), icon: UserCircle },
    ]

    return (
        <div
            className="fixed z-[100] bottom-[max(env(safe-area-inset-bottom,16px),16px)] left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-sm"
        >
            <div className="bg-white/90 dark:bg-slate-950/90 backdrop-blur-2xl shadow-2xl dark:shadow-2xl border border-slate-200/50 dark:border-white/10 rounded-full px-2 flex justify-around items-center h-[68px]">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={cn(
                                "relative flex flex-col items-center justify-center w-full h-[85%] gap-1 rounded-full transition-colors duration-200 z-10",
                                isActive ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-white/50 dark:hover:text-white/80"
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="nav-indicator"
                                    className="absolute inset-0 bg-slate-100 dark:bg-white/15 rounded-full -z-10"
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                />
                            )}
                            <tab.icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.5 : 1.5} />
                            <span className="text-[10px] font-semibold tracking-tight">{tab.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    )
}
