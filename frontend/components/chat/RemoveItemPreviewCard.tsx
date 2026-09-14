"use client"

import React, { useState, useMemo } from "react"
import { Trash2, AlertTriangle, Check, X, MapPin, Calendar, Clock, Loader2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useTripContext } from "@/lib/trip-context"
import { itemsApi } from "@/lib/api"
import { useLanguage } from "@/lib/LanguageContext"
import { useSWRConfig } from "swr"
import { useHaptic, useTripDetail } from "@/lib/hooks"

export interface RemoveItemData {
    place_name: string
    day?: number
    item_id?: string
    reason?: string
}

export interface RawActivityItem {
    id: string
    place?: string
    place_name?: string
    original_name?: string
    day?: number
    day_number?: number
    time?: string
    time_slot?: string
    category?: string
    desc?: string
    notes?: string
}

export interface RawDayItem {
    day?: number
    day_number?: number
    activities?: RawActivityItem[]
}

export interface TripLike {
    id?: string
    days?: RawDayItem[]
    items?: RawActivityItem[]
}

interface RemoveItemPreviewCardProps {
    removeData: RemoveItemData
    currentTrip?: TripLike | null
    onDismiss?: () => void
    onRemoved?: () => void
}

export interface ItineraryItem {
    id: string
    place: string
    original_name?: string
    day: number
    time?: string
    category?: string
    desc?: string
}

/**
 * 字符與異體字標準化清洗函式
 */
export function normalizePlaceName(str: string): string {
    if (!str) return ""
    return str
        .toLowerCase()
        .replace(/[\s\(\)（）\[\]【】\-_－·・,，.。/／\\:：]/g, "")
        .replace(/[臺台]/g, "台")
        .replace(/[淺浅]/g, "浅")
        .replace(/[澀涩]/g, "涩")
        .replace(/[廣广]/g, "广")
        .replace(/[國国]/g, "国")
        .replace(/[關关]/g, "关")
        .replace(/[門门]/g, "门")
        .replace(/[樓楼]/g, "楼")
}

/**
 * 計算兩字串的重疊相似度 (Dice's Coefficient on n-grams / characters)
 */
export function calculateCharOverlap(a: string, b: string): number {
    if (!a || !b) return 0
    const setA = new Set(a.split(""))
    const setB = new Set(b.split(""))
    let intersection = 0
    for (const char of setA) {
        if (setB.has(char)) intersection++
    }
    const total = Math.max(setA.size, setB.size)
    return total > 0 ? intersection / total : 0
}

/**
 * 從不同後端結構 (days[].activities 或 items[]) 中統一扁平化所有行程細項
 */
export function extractAllActivities(trip: TripLike | null | undefined): ItineraryItem[] {
    if (!trip) return []

    // 格式 1：後端標準 days 結構
    if (Array.isArray(trip.days) && trip.days.length > 0) {
        return trip.days.flatMap((d: RawDayItem) =>
            (d.activities || []).map((a: RawActivityItem) => ({
                id: a.id,
                place: a.place || a.place_name || "",
                original_name: a.original_name || "",
                day: Number(d.day || d.day_number || 1),
                time: a.time || a.time_slot || "",
                category: a.category,
                desc: a.desc || a.notes,
            }))
        )
    }

    // 格式 2：直接包含 items 陣列的結構
    if (Array.isArray(trip.items) && trip.items.length > 0) {
        return trip.items.map((it: RawActivityItem) => ({
            id: it.id,
            place: it.place || it.place_name || "",
            original_name: it.original_name || "",
            day: Number(it.day || it.day_number || 1),
            time: it.time || it.time_slot || "",
            category: it.category,
            desc: it.desc || it.notes,
        }))
    }

    return []
}

/**
 * 多層級智慧匹配演算法
 */
export function matchTargetItem(items: ItineraryItem[], removeData: RemoveItemData): ItineraryItem | null {
    if (!items || items.length === 0) return null

    // 1. 若有直接指定的 item_id
    if (removeData.item_id) {
        const found = items.find((it) => it.id === removeData.item_id)
        if (found) return found
    }

    const rawTarget = removeData.place_name.trim().toLowerCase()
    const normTarget = normalizePlaceName(removeData.place_name)
    if (!normTarget) return null

    // 輔助比對函式
    const isExact = (it: ItineraryItem) => {
        const rawPlace = it.place.toLowerCase()
        const normPlace = normalizePlaceName(it.place)
        const normOrig = normalizePlaceName(it.original_name || "")
        return (
            rawPlace === rawTarget ||
            normPlace === normTarget ||
            (normOrig !== "" && normOrig === normTarget)
        )
    }

    const isPartial = (it: ItineraryItem) => {
        const normPlace = normalizePlaceName(it.place)
        const normOrig = normalizePlaceName(it.original_name || "")
        if (normPlace && (normPlace.includes(normTarget) || normTarget.includes(normPlace))) return true
        if (normOrig && (normOrig.includes(normTarget) || normTarget.includes(normOrig))) return true
        return false
    }

    const isOverlap = (it: ItineraryItem) => {
        const normPlace = normalizePlaceName(it.place)
        return calculateCharOverlap(normPlace, normTarget) >= 0.5
    }

    // 2. 若指定天數，先在該天數內尋找 (完全匹配 -> 包含匹配 -> 字元重疊)
    if (removeData.day) {
        const dayMatches = items.filter((it) => it.day === removeData.day)
        const dayExact = dayMatches.find(isExact)
        if (dayExact) return dayExact

        const dayPartial = dayMatches.find(isPartial)
        if (dayPartial) return dayPartial

        const dayOverlap = dayMatches.find(isOverlap)
        if (dayOverlap) return dayOverlap
    }

    // 3. 全局尋找 (完全匹配 -> 包含匹配 -> 字元重疊)
    const globalExact = items.find(isExact)
    if (globalExact) return globalExact

    const globalPartial = items.find(isPartial)
    if (globalPartial) return globalPartial

    const globalOverlap = items.find(isOverlap)
    if (globalOverlap) return globalOverlap

    return null
}

export default function RemoveItemPreviewCard({
    removeData,
    currentTrip: propTrip,
    onDismiss,
    onRemoved,
}: RemoveItemPreviewCardProps) {
    const { activeTripId, userId, mutate: tripContextMutate } = useTripContext()
    const { mutate: globalMutate } = useSWRConfig()
    const { lang } = useLanguage()
    const zh = lang === "zh"
    const haptic = useHaptic()

    const [isDeleting, setIsDeleting] = useState(false)
    const [isDeleted, setIsDeleted] = useState(false)
    const [manualSelectedId, setManualSelectedId] = useState<string | null>(null)
    const [isManualSelectorOpen, setIsManualSelectorOpen] = useState(false)

    // 若父組件未傳入 currentTrip，則使用 useTripDetail 進行標準快取載入
    const { trip: hookTrip } = useTripDetail(activeTripId, userId)
    const activeTrip = propTrip || hookTrip

    // 提取所有行程項目 (自動扁平化 days -> activities)
    const allActivities = useMemo(() => extractAllActivities(activeTrip), [activeTrip])

    // 自動匹配目標項目
    const autoMatchedItem = useMemo<ItineraryItem | null>(() => {
        return matchTargetItem(allActivities, removeData)
    }, [allActivities, removeData])

    // 最終選定項目：手動優先，其次自動匹配
    const matchedItem = useMemo<ItineraryItem | null>(() => {
        if (manualSelectedId) {
            const manual = allActivities.find((it) => it.id === manualSelectedId)
            if (manual) return manual
        }
        return autoMatchedItem
    }, [allActivities, manualSelectedId, autoMatchedItem])

    const handleConfirmDelete = async () => {
        if (!activeTripId) {
            toast.error(zh ? "請先選擇一個行程" : "Please select a trip first")
            return
        }

        const targetId = matchedItem?.id || removeData.item_id
        if (!targetId) {
            toast.error(zh ? "無法在行程中定位此景點 ID，請手動選擇" : "Cannot locate item ID, please select manually")
            setIsManualSelectorOpen(true)
            return
        }

        setIsDeleting(true)
        haptic.tap()

        try {
            await itemsApi.delete(targetId, userId || undefined)
            setIsDeleted(true)
            toast.success(
                zh
                    ? `已成功移除「${matchedItem?.place || removeData.place_name}」`
                    : `Removed "${matchedItem?.place || removeData.place_name}"`
            )

            // 🛡️ 雙重全域 SWR 閉環刷新
            if (userId) {
                await globalMutate([`/api/trips/${activeTripId}`, userId])
            }
            await globalMutate((key) => {
                if (typeof key === "string" && key.includes(activeTripId)) return true
                if (Array.isArray(key) && typeof key[0] === "string" && key[0].includes(activeTripId)) return true
                return false
            })
            await tripContextMutate()

            // 廣播自訂事件，通知地圖與其他未連動 SWR 的視圖
            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("itinerary-updated", {
                        detail: { tripId: activeTripId, removedId: targetId },
                    })
                )
            }

            if (onRemoved) onRemoved()
        } catch (err) {
            console.error("Delete item failed:", err)
            toast.error(zh ? "移除失敗，請稍後再試" : "Failed to remove item")
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="relative my-2 max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 shadow-md overflow-hidden transition-all">
            {/* 頂部裝飾條 (琥珀轉玫瑰紅警告條) */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-amber-500 via-rose-500 to-red-500" />

            {/* Header */}
            <div className="p-3 pb-2">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] px-2 py-0.5 rounded-full border font-bold bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-500" />
                                {zh ? "行程移除建議" : "Removal Suggestion"}
                            </span>
                        </div>
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-tight truncate">
                            {matchedItem ? matchedItem.place : removeData.place_name}
                        </h4>
                    </div>

                    {/* 關閉或狀態圖示 */}
                    {isDeleted ? (
                        <div className="p-1 bg-green-100 dark:bg-green-950 rounded-full">
                            <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </div>
                    ) : onDismiss ? (
                        <button
                            type="button"
                            onClick={onDismiss}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    ) : null}
                </div>
            </div>

            {/* 內容資訊 */}
            <div className="px-3 pb-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                {removeData.reason && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                        &ldquo;{removeData.reason}&rdquo;
                    </p>
                )}

                {matchedItem ? (
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-2.5 truncate">
                            <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                                <Calendar className="w-3 h-3 text-emerald-500" />
                                Day {matchedItem.day}
                            </span>
                            {matchedItem.time && (
                                <span className="flex items-center gap-1 font-mono text-slate-600 dark:text-slate-400 shrink-0">
                                    <Clock className="w-3 h-3 text-amber-500" />
                                    {matchedItem.time}
                                </span>
                            )}
                            <span className="flex items-center gap-1 truncate text-slate-500">
                                <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
                                {matchedItem.place}
                            </span>
                        </div>
                        {/* 若有其他項目，允許切換選取 */}
                        {allActivities.length > 1 && (
                            <button
                                type="button"
                                onClick={() => setIsManualSelectorOpen((v) => !v)}
                                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline shrink-0 flex items-center gap-0.5"
                            >
                                {zh ? "更換" : "Change"}
                                <ChevronDown className="w-2.5 h-2.5" />
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-[11px] text-amber-700 dark:text-amber-400 space-y-1">
                        <div className="flex items-center justify-between">
                            <span>
                                ⚠️ {zh ? "比對不到完全同名項目" : "Item not automatically matched"}
                            </span>
                            {allActivities.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setIsManualSelectorOpen(true)}
                                    className="font-bold underline text-amber-800 dark:text-amber-300 hover:opacity-80"
                                >
                                    {zh ? "手動選取" : "Select Manually"}
                                </button>
                            )}
                        </div>
                        {allActivities.length === 0 && (
                            <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80">
                                {zh ? "目前行程中尚無任何景點項目。" : "No items found in itinerary."}
                            </p>
                        )}
                    </div>
                )}

                {/* 🛡️ 防呆閉環：手動選擇器下拉面板 */}
                {isManualSelectorOpen && allActivities.length > 0 && (
                    <div className="p-2 mt-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300 pb-1 border-b border-slate-200 dark:border-slate-700">
                            <span>{zh ? "從行程中手動選取要移除的項目：" : "Select item to remove:"}</span>
                            <button
                                type="button"
                                onClick={() => setIsManualSelectorOpen(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1 pt-1">
                            {allActivities.map((act) => {
                                const isSelected = matchedItem?.id === act.id
                                return (
                                    <button
                                        key={act.id}
                                        type="button"
                                        onClick={() => {
                                            setManualSelectedId(act.id)
                                            setIsManualSelectorOpen(false)
                                        }}
                                        className={`w-full text-left p-1.5 rounded-lg text-[11px] flex items-center justify-between transition-colors ${
                                            isSelected
                                                ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold"
                                                : "bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5 truncate">
                                            <span className="text-[10px] px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                                                D{act.day}
                                            </span>
                                            <span className="truncate">{act.place}</span>
                                        </div>
                                        {act.time && (
                                            <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">
                                                {act.time}
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* 底部確認按鈕 */}
            <div className="p-3 pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                {isDeleted ? (
                    <div className="w-full py-1 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        {zh ? "已自行程中成功移除" : "Removed successfully"}
                    </div>
                ) : (
                    <>
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={isDeleting || (!matchedItem && !removeData.item_id)}
                            onClick={handleConfirmDelete}
                            className="flex-1 h-8 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
                        >
                            {isDeleting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <>
                                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                                    {zh ? "確認移除行程" : "Confirm Remove"}
                                </>
                            )}
                        </Button>
                        {onDismiss && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={onDismiss}
                                className="h-8 text-xs text-slate-600 dark:text-slate-300"
                            >
                                {zh ? "保留行程" : "Keep"}
                            </Button>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

/**
 * 從 rawParts 提取 remove_itinerary_item 呼叫參數
 */
export function extractRemoveFunctionCall(rawParts: unknown[]): RemoveItemData | null {
    if (!rawParts || !Array.isArray(rawParts)) return null

    for (const part of rawParts) {
        if (!part || typeof part !== "object") continue
        const partObj = part as {
            functionCall?: { name: string; args?: Record<string, unknown> }
            function_call?: { name: string; args?: Record<string, unknown> }
        }
        const fc = partObj.functionCall || partObj.function_call
        if (fc && fc.name === "remove_itinerary_item") {
            const args = fc.args || {}
            return {
                place_name: String(args.place_name || args.name || ""),
                day: args.day ? Number(args.day) : undefined,
                item_id: args.item_id ? String(args.item_id) : undefined,
                reason: args.reason ? String(args.reason) : undefined,
            }
        }
    }
    return null
}
