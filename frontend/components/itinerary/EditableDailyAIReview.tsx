"use client"

import { useState } from "react"
import { ChevronDown, Loader2, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { tripsApi } from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface EditableDailyAIReviewProps {
    tripId: string
    day: number
    review: string | undefined
    userId?: string              // 🆕 新增
    onUpdate: () => Promise<void>  // 刷新行程資料
}

/**
 * 🕵️ AI 深度審核組件
 * 
 * 功能:
 * - 首次生成 AI 審核報告
 * - 重新審核（刷新）
 * - 清除審核報告
 * - 美觀列點渲染
 */
export default function EditableDailyAIReview({
    tripId,
    day,
    review,
    userId,
    onUpdate
}: EditableDailyAIReviewProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [loadingAction, setLoadingAction] = useState<"generate" | "clear" | null>(null)
    const [isExpanded, setIsExpanded] = useState(false)  // 🆕 Collapsible state

    // 生成/重新生成 AI 審核
    const handleGenerate = async () => {
        if (isLoading || !tripId) return

        setIsLoading(true)
        setLoadingAction("generate")

        try {
            await tripsApi.generateAIReview(tripId, day, userId)
            toast.success(`Day ${day} AI 審核完成!`)
            await onUpdate()
        } catch (error) {
            console.error("AI Review failed:", error)
            toast.error(error instanceof Error ? error.message : "AI 審核失敗")
        } finally {
            setIsLoading(false)
            setLoadingAction(null)
        }
    }

    // 清除審核報告
    const handleClear = async () => {
        if (isLoading || !tripId) return

        setIsLoading(true)
        setLoadingAction("clear")

        try {
            await tripsApi.clearAIReview(tripId, day, userId)
            toast.success("已清除審核報告")
            await onUpdate()
        } catch (error) {
            console.error("Clear failed:", error)
            toast.error("清除失敗")
        } finally {
            setIsLoading(false)
            setLoadingAction(null)
        }
    }

    // 格式化審核報告 - 識別標題和列表項目
    const formatReview = (text: string | null | undefined) => {
        if (!text) return null
        // 處理可能的 literal \n 字串
        const normalizedText = String(text).replace(/\\n/g, '\n')
        const lines = normalizedText.split('\n')

        return lines.map((line, i) => {
            const trimmed = line.trim()
            if (!trimmed) return <div key={i} className="h-2" />  // 空行增加間距

            // 標題行 (🎯, ✅, ⚠️, 💡 開頭)
            if (/^[🎯✅⚠️💡]/.test(trimmed)) {
                return (
                    <p key={i} className="font-bold text-indigo-900 mt-4 first:mt-0 mb-2">
                        {trimmed}
                    </p>
                )
            }

            // 數字列表 (1. 2. 3. 開頭)
            if (/^\d+\./.test(trimmed)) {
                return (
                    <p key={i} className="pl-4 py-0.5 text-indigo-700">
                        {trimmed}
                    </p>
                )
            }

            // 項目行 (• 開頭)
            if (trimmed.startsWith('•')) {
                return (
                    <p key={i} className="pl-4 py-0.5 text-indigo-700">
                        {trimmed}
                    </p>
                )
            }

            return <p key={i} className="py-0.5">{trimmed}</p>
        })
    }

    // 無審核報告 - 顯示生成按鈕
    if (!review) {
        return (
            <div className="mx-6 mt-4">
                <Button
                    variant="outline"
                    className={cn(
                        "w-full py-6 border-dashed border-2 border-indigo-300",
                        "bg-gradient-to-br from-indigo-50/50 to-purple-50/50",
                        "hover:border-indigo-400 hover:bg-indigo-50",
                        "text-indigo-600 font-medium",
                        "touch-manipulation"
                    )}
                    onClick={handleGenerate}
                    disabled={isLoading}
                >
                    {isLoading && loadingAction === "generate" ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            AI 正在審核中...
                        </>
                    ) : (
                        <>
                            <span className="text-xl mr-2">🕵️</span>
                            生成 AI 深度審核報告
                        </>
                    )}
                </Button>
            </div>
        )
    }

    // 有審核報告 - 顯示報告 + 操作按鈕 (可收合)
    return (
        <div className="mx-6 mt-4 p-5 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl shadow-sm">
            {/* Header - 點擊展開/收合 */}
            <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <h3 className="text-base font-bold text-indigo-900 flex items-center gap-2">
                    <span className="text-lg">🕵️</span> AI 深度審核報告
                    <ChevronDown
                        className={cn(
                            "w-4 h-4 text-indigo-500 transition-transform duration-200",
                            isExpanded && "rotate-180"
                        )}
                    />
                </h3>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    {/* 重新審核 */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-indigo-600 hover:bg-indigo-100 touch-manipulation"
                        onClick={handleGenerate}
                        disabled={isLoading}
                        title="重新審核"
                    >
                        {isLoading && loadingAction === "generate" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <RefreshCw className="w-4 h-4" />
                        )}
                    </Button>
                    {/* 清除 */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:bg-red-100 touch-manipulation"
                        onClick={handleClear}
                        disabled={isLoading}
                        title="清除審核"
                    >
                        {isLoading && loadingAction === "clear" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Trash2 className="w-4 h-4" />
                        )}
                    </Button>
                </div>
            </div>

            {/* Content - 可收合 */}
            <div
                className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    isExpanded ? "max-h-[2000px] opacity-100 mt-3" : "max-h-0 opacity-0 mt-0"
                )}
            >
                <div className="text-sm text-indigo-800 leading-relaxed space-y-1">
                    {formatReview(review)}
                </div>
            </div>
        </div>
    )
}
