"use client"

import { useState, useEffect } from "react"
import { MapPin, Clock, Star, Check, X, Map, Loader2, ExternalLink, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useTripContext } from "@/lib/trip-context"
import { itemsApi, poiApi } from "@/lib/api"
import { debugLog } from "@/lib/debug"

// 三源整合資料結構
interface EnrichedPOI {
    display_name?: {
        primary: string
        secondary: string
    }
    cultural_desc?: string
    travel_tips?: string
    official_url?: string
    wikivoyage_url?: string
}

// Function call args 結構
interface POIData {
    place_name: string
    category?: string
    desc?: string
    lat?: number
    lng?: number
    rating?: number
    duration?: string  // 預估停留時間
    day_number?: number
    time_slot?: string
}

interface POIPreviewCardProps {
    poiData: POIData
    onAdded?: () => void
    onDismiss?: () => void
}

/**
 * 🏗️ POI 預覽卡片 (機票樣式)
 * 
 * 當 AI 回應包含 function_call: add_itinerary_item 時渲染
 * 提供「加入行程」和「在地圖上預覽」功能
 */
export default function POIPreviewCard({
    poiData,
    onAdded,
    onDismiss
}: POIPreviewCardProps) {
    const { activeTripId, mutate, userId } = useTripContext()
    const [isAdding, setIsAdding] = useState(false)
    const [isAdded, setIsAdded] = useState(false)
    const [enriched, setEnriched] = useState<EnrichedPOI | null>(null)
    const [isLoadingEnrich, setIsLoadingEnrich] = useState(false)

    // 🆕 v3.7: 自動獲取三源整合資料
    useEffect(() => {
        const fetchEnrichedData = async () => {
            if (!poiData.place_name) return

            setIsLoadingEnrich(true)
            try {
                // 🛡️ v5: Standardized Enrichment with Auth
                const data = await poiApi.enrich({
                    name: poiData.place_name,
                    type: poiData.category || "sightseeing",
                    lat: poiData.lat || 0,
                    lng: poiData.lng || 0,
                    api_key: localStorage.getItem("user_gemini_key")
                }, userId || undefined)
                if (data.success && data.poi) {
                    setEnriched(data.poi)
                }
            } catch (error) {
                debugLog("三源資料獲取失敗 (不影響主流程):", error)
            } finally {
                setIsLoadingEnrich(false)
            }
        }

        fetchEnrichedData()
    }, [poiData.place_name, poiData.category, poiData.lat, poiData.lng, userId])

    // 分類顏色映射
    const categoryColors: Record<string, string> = {
        food: "bg-orange-100 text-orange-700 border-orange-200",
        restaurant: "bg-orange-100 text-orange-700 border-orange-200",
        sightseeing: "bg-blue-100 text-blue-700 border-blue-200",
        shopping: "bg-pink-100 text-pink-700 border-pink-200",
        transport: "bg-slate-100 text-slate-700 border-slate-200",
        hotel: "bg-purple-100 text-purple-700 border-purple-200",
    }

    const categoryLabels: Record<string, string> = {
        food: "🍜 美食",
        restaurant: "🍜 餐廳",
        sightseeing: "🏯 景點",
        shopping: "🛍️ 購物",
        transport: "🚃 交通",
        hotel: "🏨 住宿",
    }

    const colorClass = categoryColors[poiData.category || "sightseeing"] || categoryColors.sightseeing
    const categoryLabel = categoryLabels[poiData.category || "sightseeing"] || "📍 地點"

    /**
     * 加入行程 (Optimistic UI)
     */
    const handleAddToItinerary = async () => {
        if (!activeTripId) {
            toast.error("請先選擇一個行程")
            return
        }

        if (isAdding || isAdded) return

        // 🆕 Optimistic UI - 立即顯示成功狀態
        setIsAdding(true)

        try {
            // 🛡️ v5: Standardized Item Creation with Auth
            await itemsApi.create({
                trip_id: activeTripId,
                day: poiData.day_number || 1,
                time: poiData.time_slot || "12:00",
                place: poiData.place_name,
                category: poiData.category || "sightseeing",
                desc: poiData.desc || "",
                lat: poiData.lat,
                lng: poiData.lng,
                user_id: userId || undefined
            })

            // 成功
            setIsAdded(true)
            toast.success(`✅ 已加入：${poiData.place_name}`)

            // 刷新行程列表
            mutate()
            onAdded?.()

        } catch (error) {
            console.error("Add to itinerary failed:", error)
            toast.error("加入失敗，請稍後再試")
            setIsAdding(false)
        }
    }

    /**
     * 在地圖上預覽
     */
    const handlePreviewOnMap = () => {
        if (poiData.lat && poiData.lng) {
            const url = `https://www.google.com/maps/search/?api=1&query=${poiData.lat},${poiData.lng}`
            window.open(url, "_blank")
        } else {
            // 用地名搜尋
            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(poiData.place_name)}`
            window.open(url, "_blank")
        }
    }

    return (
        <div className={cn(
            "relative overflow-hidden rounded-xl border-2 shadow-sm my-2",
            isAdded ? "border-green-300 bg-green-50" : "border-slate-200 bg-white"
        )}>
            {/* 🎫 票券頂部裝飾 */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

            {/* Header */}
            <div className="p-3 pb-2">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full border font-medium",
                                colorClass
                            )}>
                                {categoryLabel}
                            </span>
                            {poiData.rating && (
                                <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    {poiData.rating.toFixed(1)}
                                </span>
                            )}
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm leading-tight truncate">
                            {poiData.place_name}
                        </h4>
                    </div>

                    {/* 關閉按鈕 */}
                    {onDismiss && !isAdded && (
                        <button
                            onClick={onDismiss}
                            className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}

                    {/* 已加入勾勾 */}
                    {isAdded && (
                        <div className="p-1 bg-green-100 rounded-full">
                            <Check className="w-4 h-4 text-green-600" />
                        </div>
                    )}
                </div>
            </div>

            {/* Body */}
            {/* 🆕 v3.7: 三源整合顯示 */}
            <div className="px-3 pb-2 space-y-1">
                {/* 副標題 (日文/英文名) */}
                {enriched?.display_name?.secondary && (
                    <p className="text-[10px] text-slate-400">
                        {enriched.display_name.secondary}
                    </p>
                )}

                {/* 描述：優先使用三源資料，fallback 到原始 desc */}
                <p className="text-xs text-slate-600 line-clamp-2">
                    {enriched?.cultural_desc || poiData.desc || ""}
                </p>

                {/* 旅遊指南摘要 */}
                {enriched?.travel_tips && (
                    <p className="text-[10px] text-blue-600 line-clamp-1 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        {enriched.travel_tips.slice(0, 50)}...
                    </p>
                )}

                {/* 官網連結 */}
                {enriched?.official_url && (
                    <a
                        href={enriched.official_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1"
                    >
                        <ExternalLink className="w-3 h-3" />
                        官方網站
                    </a>
                )}

                {/* Loading 指示器 */}
                {isLoadingEnrich && (
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        載入更多資訊...
                    </p>
                )}
            </div>

            {/* Meta */}
            <div className="px-3 pb-2 flex items-center gap-3 text-[10px] text-slate-500">
                {poiData.duration && (
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {poiData.duration}
                    </span>
                )}
                {poiData.lat && poiData.lng && (
                    <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        座標已取得
                    </span>
                )}
            </div>

            {/* 🎫 虛線分隔 (票券效果) */}
            <div className="relative px-3">
                <div className="border-t border-dashed border-slate-200" />
                {/* 左側圓形缺口 */}
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-50 rounded-full border-r border-slate-200" />
                {/* 右側圓形缺口 */}
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-50 rounded-full border-l border-slate-200" />
            </div>

            {/* Footer - 按鈕 */}
            <div className="p-3 pt-2 flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={handlePreviewOnMap}
                >
                    <Map className="w-3 h-3 mr-1" />
                    在地圖上預覽
                </Button>

                <Button
                    size="sm"
                    className={cn(
                        "flex-1 h-8 text-xs transition-all",
                        isAdded
                            ? "bg-green-500 hover:bg-green-500 cursor-default"
                            : "bg-blue-600 hover:bg-blue-700"
                    )}
                    onClick={handleAddToItinerary}
                    disabled={isAdding || isAdded || !activeTripId}
                >
                    {isAdding ? (
                        <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            加入中...
                        </>
                    ) : isAdded ? (
                        <>
                            <Check className="w-3 h-3 mr-1" />
                            已加入
                        </>
                    ) : (
                        "✅ 加入行程"
                    )}
                </Button>
            </div>
        </div>
    )
}

/**
 * 從 rawParts 中偵測 function_call 並提取 POI 資料
 */
export function extractFunctionCall(rawParts: { function_call?: { name: string; args: Record<string, unknown> } }[]): POIData | null {
    if (!rawParts || !Array.isArray(rawParts)) return null

    for (const part of rawParts) {
        if (part.function_call && part.function_call.name === "add_itinerary_item") {
            const args = part.function_call.args
            return {
                place_name: String(args.place_name || args.name || ""),
                category: String(args.category || "sightseeing"),
                desc: String(args.desc || args.description || ""),
                lat: typeof args.lat === "number" ? args.lat : undefined,
                lng: typeof args.lng === "number" ? args.lng : undefined,
                rating: typeof args.rating === "number" ? args.rating : undefined,
                duration: String(args.duration || ""),
                day_number: typeof args.day_number === "number" ? args.day_number : 1,
                time_slot: String(args.time_slot || "12:00")
            }
        }
    }

    return null
}
