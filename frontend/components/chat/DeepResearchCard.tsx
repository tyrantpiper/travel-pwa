"use client"

import React, { useState } from "react"
import { Sparkles, CheckCircle2, AlertCircle, XCircle, ExternalLink, Plus, Loader2 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/LanguageContext"

export interface DeepResearchData {
    id: string
    status: "running" | "completed" | "failed" | "cancelled"
    prompt: string
    outputText?: string | null
    engine?: string
    error?: string
}

interface DeepResearchCardProps {
    data: DeepResearchData
    onCancel?: (id: string) => void
    onAddToItinerary?: (content: string) => void
}

const TP_MARKER = process.env.NEXT_PUBLIC_TP_MARKER || "602410"

export default function DeepResearchCard({
    data,
    onCancel,
    onAddToItinerary
}: DeepResearchCardProps) {
    const { lang } = useLanguage()
    const zh = lang === "zh"
    const [added, setAdded] = useState(false)

    const isRunning = data.status === "running"
    const isCompleted = data.status === "completed"
    const isFailed = data.status === "failed"
    const isCancelled = data.status === "cancelled"

    const handleAdd = () => {
        if (data.outputText && onAddToItinerary) {
            onAddToItinerary(data.outputText)
            setAdded(true)
        }
    }

    return (
        <div className="w-full my-3 overflow-hidden rounded-2xl border border-indigo-200/70 dark:border-indigo-900/60 bg-linear-to-b from-indigo-50/50 via-white to-white dark:from-indigo-950/20 dark:via-neutral-900 dark:to-neutral-900 shadow-md">
            {/* Header / Engine Status Bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-indigo-100/60 dark:bg-indigo-950/40 border-b border-indigo-200/50 dark:border-indigo-900/40">
                <div className="flex items-center gap-2.5">
                    <div className={cn(
                        "flex items-center justify-center w-7 h-7 rounded-lg shadow-sm text-white",
                        isRunning ? "bg-linear-to-tr from-indigo-600 to-purple-600 animate-pulse" :
                        isCompleted ? "bg-emerald-600" :
                        "bg-neutral-600"
                    )}>
                        {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> :
                         isCompleted ? <CheckCircle2 className="w-4 h-4" /> :
                         isCancelled ? <XCircle className="w-4 h-4" /> :
                         <AlertCircle className="w-4 h-4" />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold tracking-wide uppercase text-indigo-950 dark:text-indigo-200">
                                {zh ? "AI 深度研究員副官" : "AI Deep Researcher"}
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-200/70 dark:bg-indigo-900/70 text-indigo-800 dark:text-indigo-300">
                                {data.engine?.includes("antigravity") ? "Linux Sandbox" : "Gemini 3.7 Flash"}
                            </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate max-w-60 sm:max-w-md">
                            {data.prompt}
                        </p>
                    </div>
                </div>

                {/* Stop / Status Badge */}
                {isRunning && onCancel && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onCancel(data.id)}
                        className="h-7 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
                    >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        {zh ? "取消" : "Cancel"}
                    </Button>
                )}
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
                {/* 1. Running State Animation */}
                {isRunning && (
                    <div className="flex flex-col items-center justify-center py-6 px-4 text-center space-y-3 bg-neutral-50/50 dark:bg-neutral-900/50 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800/50">
                        <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                            <Sparkles className="w-6 h-6 animate-pulse" />
                            <div className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                                {zh ? "沙盒演算法精算與深度爬蟲進行中..." : "Computing in Linux Sandbox..."}
                            </p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                                {zh ? "正在整合即時票價、扣除 Check-in 時間並計算最優路線" : "Integrating real-time pricing and solving constraints"}
                            </p>
                        </div>
                    </div>
                )}

                {/* 2. Output Markdown Content */}
                {isCompleted && data.outputText && (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-neutral-800 dark:text-neutral-200 overflow-x-auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {data.outputText}
                        </ReactMarkdown>
                    </div>
                )}

                {/* 3. Error / Cancelled State */}
                {(isFailed || isCancelled) && (
                    <div className="p-3 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                        {isCancelled ? (zh ? "任務已由使用者取消" : "Task cancelled by user") : (data.error || (zh ? "沙盒任務執行異常" : "Execution error"))}
                    </div>
                )}

                {/* 4. Action Bar (Affiliate Booking + One-click Import) */}
                {isCompleted && data.outputText && (
                    <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/30 flex flex-wrap items-center justify-between gap-2">
                        {/* Travelpayouts Affiliate Deep Link Button */}
                        <a
                            href={`https://tp.media/r?marker=${TP_MARKER}&p=4114&u=https%3A%2F%2Fwww.aviasales.com`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 hover:bg-amber-100 transition-colors"
                        >
                            <span>✈️ {zh ? "查詢即時優惠機票" : "Search Live Flights"}</span>
                            <ExternalLink className="w-3 h-3 opacity-70" />
                        </a>

                        {/* Batch Add to Itinerary Button */}
                        {onAddToItinerary && (
                            <Button
                                size="sm"
                                onClick={handleAdd}
                                disabled={added}
                                className={cn(
                                    "h-8 px-3 text-xs font-medium rounded-lg shadow-sm transition-all",
                                    added ? "bg-emerald-600 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"
                                )}
                            >
                                {added ? (
                                    <>
                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                        {zh ? "已加入行程" : "Added to Trip"}
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-3.5 h-3.5 mr-1" />
                                        {zh ? "📥 一鍵將成果加入行程" : "Add to Itinerary"}
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
