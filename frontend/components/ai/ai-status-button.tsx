"use client"

import { useState, useEffect } from "react"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { getSecureApiKey } from "@/lib/security"
import { useLanguage } from "@/lib/LanguageContext"
import { AIKeyDialog } from "@/components/ai/ai-key-dialog"

export function AIStatusButton() {
    const { lang } = useLanguage()
    const zh = lang === 'zh'

    const [hasKey, setHasKey] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)

    useEffect(() => {
        const updateStatus = () => {
            const key = getSecureApiKey()
            setHasKey(!!key)
        }
        updateStatus()

        window.addEventListener("apiKeyUpdated", updateStatus)
        window.addEventListener("storage", updateStatus)
        return () => {
            window.removeEventListener("apiKeyUpdated", updateStatus)
            window.removeEventListener("storage", updateStatus)
        }
    }, [])

    return (
        <>
            <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className={cn(
                    "h-9 px-2.5 rounded-full",
                    "bg-white/80 dark:bg-slate-800/80 backdrop-blur-md",
                    "border border-slate-200/80 dark:border-slate-700",
                    "shadow-sm hover:shadow-md",
                    "flex items-center gap-1.5",
                    "hover:scale-105 active:scale-95 transition-all cursor-pointer select-none group"
                )}
                title={hasKey 
                    ? (zh ? "AI 連線正常 (點擊設定)" : "AI Connected (Click to configure)") 
                    : (zh ? "AI 未設定金鑰 (點擊設定)" : "AI Key Not Configured (Click to set)")
                }
                aria-label={zh ? "AI API Key 設定" : "AI API Key Settings"}
            >
                <Sparkles className="w-4 h-4 text-amber-500 group-hover:rotate-12 transition-transform duration-300" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-tight">
                    AI
                </span>
                <span 
                    className={cn(
                        "w-2 h-2 rounded-full transition-all duration-300",
                        hasKey 
                            ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse" 
                            : "bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.5)]"
                    )}
                />
            </button>

            <AIKeyDialog 
                open={dialogOpen} 
                onOpenChange={setDialogOpen} 
            />
        </>
    )
}
