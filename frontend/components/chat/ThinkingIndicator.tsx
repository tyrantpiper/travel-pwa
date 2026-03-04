"use client"

import { Loader2, Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/LanguageContext"

interface ThinkingIndicatorProps {
    phase: "thinking" | "searching"
    isExpanded?: boolean
    onToggle?: () => void
}

/**
 * 🧠 脈衝手風琴 (Pulse Accordion)
 * 
 * 視覺化 AI 處理狀態：
 * - thinking: 紫色脈衝 - AI 正在深度規劃
 * - searching: 藍色掃描 - 正在連網驗證
 */
export default function ThinkingIndicator({
    phase,
    isExpanded = false,
    onToggle
}: ThinkingIndicatorProps) {
    const isThinking = phase === "thinking"
    const { lang } = useLanguage()
    const zh = lang === 'zh'

    return (
        <div
            className={cn(
                "flex items-center gap-3 p-3 rounded-2xl rounded-tl-none border shadow-sm cursor-pointer transition-all",
                isThinking
                    ? "bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200"
                    : "bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200"
            )}
            onClick={onToggle}
        >
            {/* Icon with pulse animation */}
            <div className={cn(
                "relative flex items-center justify-center w-8 h-8 rounded-full",
                isThinking ? "bg-purple-100" : "bg-blue-100"
            )}>
                {/* Pulse ring */}
                <div className={cn(
                    "absolute inset-0 rounded-full animate-ping opacity-30",
                    isThinking ? "bg-purple-400" : "bg-blue-400"
                )} />

                {/* Icon */}
                {isThinking ? (
                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                ) : (
                    <Globe className="w-4 h-4 animate-pulse text-blue-600" />
                )}
            </div>

            {/* Status text */}
            <div className="flex-1">
                <p className={cn(
                    "text-sm font-medium",
                    isThinking ? "text-purple-700" : "text-blue-700"
                )}>
                    {isThinking
                        ? (zh ? "🧠 AI 正在進行深度規劃..." : "🧠 AI is planning...")
                        : (zh ? "🌏 正在連線 Google 確認最新資訊..." : "🌏 Verifying with Google...")
                    }
                </p>

                {/* Expanded details */}
                {isExpanded && (
                    <p className={cn(
                        "text-xs mt-1 opacity-70",
                        isThinking ? "text-purple-600" : "text-blue-600"
                    )}>
                        {isThinking
                            ? (zh ? "使用 Gemini 3 Flash Preview 進行推理中" : "Reasoning with Gemini 3 Flash Preview")
                            : (zh ? "透過 Google Search Grounding 驗證資訊時效性" : "Verifying with Google Search Grounding")
                        }
                    </p>
                )}
            </div>

            {/* Expand hint */}
            <span className="text-xs opacity-50">
                {isExpanded ? "▲" : "▼"}
            </span>
        </div>
    )
}
