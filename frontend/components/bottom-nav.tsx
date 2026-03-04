"use client"
import { Map, Info, Wrench, UserCircle } from "lucide-react"
import { useLanguage } from "@/lib/LanguageContext"
import { useTheme } from "@/lib/ThemeContext"
import { cn } from "@/lib/utils"

interface BottomNavProps {
    activeTab: string
    onTabChange: (tab: string) => void
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
    const { t } = useLanguage()
    const { currentTheme } = useTheme()

    const tabs = [
        { id: "itinerary", label: t('nav_itinerary'), icon: Map, href: "/itinerary" },
        { id: "info", label: t('nav_info'), icon: Info, href: "/info" },
        { id: "tools", label: t('nav_tools'), icon: Wrench, href: "/tools" },
        { id: "profile", label: t('nav_profile'), icon: UserCircle, href: "/profile" },
    ]

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe z-50">
            <div className="flex justify-around items-center h-16">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={cn(
                            "flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-200 relative",
                            activeTab === tab.id ? "" : "text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                        )}
                        style={activeTab === tab.id ? { color: currentTheme.primary } : undefined}
                    >
                        {activeTab === tab.id && (
                            <div
                                className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-10 h-[2px] rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]"
                                style={{ backgroundColor: currentTheme.primary }}
                            />
                        )}
                        <tab.icon className="w-5 h-5" strokeWidth={activeTab === tab.id ? 2.5 : 1.5} />
                        <span className="text-[10px] font-bold tracking-tight uppercase">{tab.label}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}
