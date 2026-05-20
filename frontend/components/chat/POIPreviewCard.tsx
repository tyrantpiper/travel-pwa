"use client"

import { useState, useEffect } from "react"
import { MapPin, Clock, Star, Check, X, Map, Loader2, ExternalLink, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, openExternalLink } from "@/lib/utils"
import { toast } from "sonner"
import { useTripContext } from "@/lib/trip-context"
import { itemsApi, poiApi } from "@/lib/api"
import { debugLog } from "@/lib/debug"
import { useLanguage } from "@/lib/LanguageContext"
import { getSecureApiKey } from "@/lib/security"
import { useSWRConfig } from "swr"

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
    summary?: string
    must_try?: string[]
    rating?: number
    image_url?: string
    status?: string
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
    link_url?: string  // 官網或相關連結
    sub_items?: { name: string; desc?: string; link?: string }[]  // 子項目（推薦菜品、必看展品等）
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
    const { mutate: globalMutate } = useSWRConfig()
    const { lang } = useLanguage()
    const zh = lang === 'zh'
    const [isAdding, setIsAdding] = useState(false)
    const [isAdded, setIsAdded] = useState(false)
    const [enriched, setEnriched] = useState<EnrichedPOI | null>(null)
    const [isLoadingEnrich, setIsLoadingEnrich] = useState(false)

    // 🆕 v3.7: 自動獲取三源整合資料
    useEffect(() => {
        const fetchEnrichedData = async () => {
            if (!poiData.place_name) return

            // 🛡️ 防空虛島：當 AI 沒給有效座標時跳過三源豐富化，避免 (0,0) 查到 Null Island
            const hasValidCoords = !!(poiData.lat && poiData.lng && !(poiData.lat === 0 && poiData.lng === 0))
            if (!hasValidCoords) {
                debugLog("跳過三源豐富化：無有效座標", poiData.place_name)
                return
            }

            setIsLoadingEnrich(true)
            try {
                // 🛡️ v5: Standardized Enrichment with Auth
                const data = await poiApi.enrich({
                    name: poiData.place_name,
                    type: poiData.category || "sightseeing",
                    lat: poiData.lat || 0,
                    lng: poiData.lng || 0,
                    api_key: getSecureApiKey()
                }, userId || undefined)
                if (data && (data.cultural_desc || data.name || data.summary)) {
                    setEnriched(data as EnrichedPOI)
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
        food: zh ? "🍜 美食" : "🍜 Food",
        restaurant: zh ? "🍜 餐廳" : "🍜 Restaurant",
        sightseeing: zh ? "🏯 景點" : "🏯 Sightseeing",
        shopping: zh ? "🛍️ 購物" : "🛍️ Shopping",
        transport: zh ? "🚃 交通" : "🚃 Transport",
        hotel: zh ? "🏨 住宿" : "🏨 Hotel",
    }

    const colorClass = categoryColors[poiData.category || "sightseeing"] || categoryColors.sightseeing
    const categoryLabel = categoryLabels[poiData.category || "sightseeing"] || (zh ? "📍 地點" : "📍 Place")

    /**
     * 加入行程 (Optimistic UI)
     */
    const handleAddToItinerary = async () => {
        if (!activeTripId) {
            toast.error(zh ? "請先選擇一個行程" : "Please select a trip first")
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
                link_url: poiData.link_url,
                sub_items: poiData.sub_items,
                user_id: userId || undefined
            })

            // 成功
            setIsAdded(true)
            toast.success(zh ? `✅ 已加入：${poiData.place_name}` : `✅ Added: ${poiData.place_name}`)

            // 刷新行程列表
            mutate()

            // 🟢 [BUGFIX]: 顯式刷新行程詳情快取，即時更新時間軸與地圖標記，消除快取空洞
            if (userId) {
                globalMutate([`/api/trips/${activeTripId}`, userId])
            }

            onAdded?.()

        } catch (error) {
            console.error("Add to itinerary failed:", error)
            toast.error(zh ? "加入失敗，請稍後再試" : "Failed to add, please try again")
            setIsAdding(false)
        }
    }

    /**
     * 在地圖上預覽
     */
    const handlePreviewOnMap = () => {
        if (poiData.lat && poiData.lng) {
            const url = `https://www.google.com/maps/search/?api=1&query=${poiData.lat},${poiData.lng}`
            openExternalLink(url)
        } else {
            // 用地名搜尋
            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(poiData.place_name)}`
            openExternalLink(url)
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

                {/* 描述：AI 描述優先，三源資料為 fallback */}
                <p className="text-xs text-slate-600 line-clamp-2">
                    {poiData.desc || enriched?.cultural_desc || ""}
                </p>

                {/* 旅遊指南摘要 */}
                {enriched?.travel_tips && (
                    <p className="text-[10px] text-blue-600 line-clamp-1 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        {enriched.travel_tips.slice(0, 50)}...
                    </p>
                )}

                {/* 官網連結 */}
                {(poiData.link_url || enriched?.official_url) && (
                    <a
                        href={poiData.link_url || enriched?.official_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-indigo-600 hover:underline inline-flex items-center gap-1 font-medium bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded w-fit"
                    >
                        <ExternalLink className="w-3 h-3" />
                        {zh ? '官方網站' : 'Official Site'}
                    </a>
                )}

                {/* 🆕 景點子項目/必看推薦 (sub_items) */}
                {poiData.sub_items && poiData.sub_items.length > 0 && (
                    <div className="mt-1.5 p-1.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800/80 space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 block tracking-wider uppercase">
                            {poiData.category === "food" || poiData.category === "restaurant" ? (zh ? "🍽️ 推薦品項" : "🍽️ Recommended") : (zh ? "✨ 必看/特色" : "✨ Highlights")}
                        </span>
                        <div className="space-y-1">
                            {poiData.sub_items.map((sub, idx) => (
                                <div key={idx} className="text-[10px] leading-normal flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                                            • {sub.name}
                                        </span>
                                        {sub.desc && (
                                            <span className="text-slate-500 ml-1">
                                                ({sub.desc})
                                            </span>
                                        )}
                                    </div>
                                    {sub.link && (
                                        <a
                                            href={sub.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-500 hover:underline shrink-0"
                                        >
                                            {zh ? '詳情' : 'Link'}
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Loading 指示器 */}
                {isLoadingEnrich && (
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {zh ? '載入更多資訊...' : 'Loading more info...'}
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
                        {zh ? '座標已取得' : 'Coords ready'}
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
                    {zh ? '在地圖上預覽' : 'Preview on Map'}
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
                            {zh ? '加入中...' : 'Adding...'}
                        </>
                    ) : isAdded ? (
                        <>
                            <Check className="w-3 h-3 mr-1" />
                            {zh ? '已加入' : 'Added'}
                        </>
                    ) : (
                        zh ? "✅ 加入行程" : "✅ Add to Trip"
                    )}
                </Button>
            </div>
        </div>
    )
}

/**
 * 從 rawParts 中偵測 function_call 並提取 POI 資料
 */
export function extractFunctionCall(rawParts: unknown[]): POIData | null {
    if (!rawParts || !Array.isArray(rawParts)) return null

    for (const part of rawParts) {
        if (part && typeof part === 'object') {
            // 🟢 雙格式相容：相容 camelCase 與 snake_case 命名
            const partObj = part as {
                functionCall?: { name: string; args?: Record<string, unknown> }
                function_call?: { name: string; args?: Record<string, unknown> }
            }
            const fc = partObj.functionCall || partObj.function_call
            if (fc && fc.name === "add_itinerary_item") {
                const args = fc.args || {}
                
                // 🟢 參數降級鏈：支援 day_number, dayNumber, day 等各種 AI 產出的欄位變體
                const dayVal = args.day_number ?? args.dayNumber ?? args.day ?? 1
                
                return {
                    place_name: String(args.place_name || args.name || ""),
                    category: String(args.category || "sightseeing"),
                    desc: String(args.desc || args.description || ""),
                    lat: typeof args.lat === "number" ? args.lat : undefined,
                    lng: typeof args.lng === "number" ? args.lng : undefined,
                    rating: typeof args.rating === "number" ? args.rating : undefined,
                    duration: String(args.duration || ""),
                    day_number: typeof dayVal === "number" ? dayVal : parseInt(String(dayVal)) || 1,
                    time_slot: String(args.time_slot || args.timeSlot || "12:00"),
                    link_url: args.link_url ? String(args.link_url) : undefined,
                    sub_items: Array.isArray(args.sub_items) ? (args.sub_items as unknown[]).map((item) => {
                        const sub = item as { name?: unknown; desc?: unknown; link?: unknown } | null | undefined
                        return {
                            name: sub?.name ? String(sub.name) : "",
                            desc: sub?.desc ? String(sub.desc) : undefined,
                            link: sub?.link ? String(sub.link) : undefined,
                        }
                    }).filter(item => item.name) : undefined
                }
            }
        }
    }

    return null
}
