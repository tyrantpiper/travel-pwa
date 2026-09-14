"use client"

import React, { useState } from "react"
import { Check, Loader2, Sparkles, PlusCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useTripContext } from "@/lib/trip-context"
import { itemsApi } from "@/lib/api"
import { useLanguage } from "@/lib/LanguageContext"
import { useSWRConfig } from "swr"
import { useHaptic } from "@/lib/hooks"
import { SingleDateCalendarPopover, ClockTimePickerPopover } from "./DateTimePickers"
import { POIData } from "./POIPreviewCard"

interface BatchPOIPreviewCardProps {
    items: POIData[]
    onAllAdded?: () => void
}

export default function BatchPOIPreviewCard({
    items: initialItems,
    onAllAdded,
}: BatchPOIPreviewCardProps) {
    const { activeTripId, activeTrip, mutate, userId } = useTripContext()
    const { mutate: globalMutate } = useSWRConfig()
    const { lang } = useLanguage()
    const zh = lang === "zh"
    const haptic = useHaptic()

    // 每個項目的微調狀態 (天數、時間)
    const [itemsState, setItemsState] = useState(() =>
        initialItems.map((it) => ({
            ...it,
            day_number: it.day_number || 1,
            time_slot: it.time_slot || "10:00",
            isAdded: false,
        }))
    )

    const [isAddingAll, setIsAddingAll] = useState(false)
    const [addingProgress, setAddingProgress] = useState<number | null>(null)

    const allAdded = itemsState.every((it) => it.isAdded)

    const handleUpdateItemDay = (index: number, newDay: number) => {
        setItemsState((prev) =>
            prev.map((item, i) => (i === index ? { ...item, day_number: newDay } : item))
        )
    }

    const handleUpdateItemTime = (index: number, newTime: string) => {
        setItemsState((prev) =>
            prev.map((item, i) => (i === index ? { ...item, time_slot: newTime } : item))
        )
    }

    const handleAddSingle = async (index: number) => {
        if (!activeTripId) {
            toast.error(zh ? "請先選擇行程" : "Select a trip first")
            return
        }

        const target = itemsState[index]
        if (target.isAdded) return

        haptic.tap()
        try {
            await itemsApi.create({
                trip_id: activeTripId,
                day: target.day_number,
                time: target.time_slot,
                place: target.place_name,
                category: target.category || "sightseeing",
                desc: target.desc || "",
                lat: target.lat,
                lng: target.lng,
                link_url: target.link_url,
                sub_items: target.sub_items,
                user_id: userId || undefined,
            })

            setItemsState((prev) =>
                prev.map((it, i) => (i === index ? { ...it, isAdded: true } : it))
            )
            toast.success(zh ? `已加入：${target.place_name}` : `Added: ${target.place_name}`)

            mutate()
            if (userId) {
                globalMutate([`/api/trips/${activeTripId}`, userId])
            }
        } catch (err) {
            console.error("Single add failed:", err)
            toast.error(zh ? "加入失敗" : "Failed to add")
        }
    }

    const handleAddAll = async () => {
        if (!activeTripId) {
            toast.error(zh ? "請先選擇行程" : "Select a trip first")
            return
        }

        setIsAddingAll(true)
        haptic.tap()

        let successCount = 0
        const pendingItems = itemsState.map((item, idx) => ({ ...item, originalIdx: idx })).filter((it) => !it.isAdded)

        for (let i = 0; i < pendingItems.length; i++) {
            const item = pendingItems[i]
            setAddingProgress(i + 1)

            try {
                await itemsApi.create({
                    trip_id: activeTripId,
                    day: item.day_number,
                    time: item.time_slot,
                    place: item.place_name,
                    category: item.category || "sightseeing",
                    desc: item.desc || "",
                    lat: item.lat,
                    lng: item.lng,
                    link_url: item.link_url,
                    sub_items: item.sub_items,
                    user_id: userId || undefined,
                })

                setItemsState((prev) =>
                    prev.map((it, idx) => (idx === item.originalIdx ? { ...it, isAdded: true } : it))
                )
                successCount++
            } catch (err) {
                console.error(`Failed to add item: ${item.place_name}`, err)
            }
        }

        setIsAddingAll(false)
        setAddingProgress(null)

        if (successCount > 0) {
            toast.success(zh ? `🎉 成功加入 ${successCount} 個行程項目！` : `Added ${successCount} places!`)
            mutate()
            if (userId) {
                globalMutate([`/api/trips/${activeTripId}`, userId])
            }
            if (onAllAdded) onAllAdded()
        }
    }

    return (
        <div className="relative my-2.5 max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden transition-all">
            {/* 頂部裝飾條 (靛藍轉綠漸層) */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-blue-500 via-indigo-500 to-emerald-500" />

            {/* 標頭 */}
            <div className="p-3.5 pb-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        {zh ? `批次行程規劃 (${itemsState.length} 個地點)` : `Batch Plan (${itemsState.length} Places)`}
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {zh ? "點擊膠囊可微調天數與時間" : "Tap capsules to adjust day and time"}
                    </p>
                </div>

                {allAdded && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                        <Check className="w-3 h-3" />
                        {zh ? "全部已加入" : "All Added"}
                    </span>
                )}
            </div>

            {/* 地點項目清單 */}
            <div className="p-3 space-y-2 max-h-80 overflow-y-auto no-scrollbar divide-y divide-slate-100 dark:divide-slate-800/80">
                {itemsState.map((item, idx) => (
                    <div key={idx} className={cn("pt-2 first:pt-0 space-y-1.5")}>
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                    {idx + 1}. {item.place_name}
                                </h4>
                                {item.desc && (
                                    <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                                        {item.desc}
                                    </p>
                                )}
                            </div>

                            {/* 單一加入按鈕 */}
                            <button
                                type="button"
                                disabled={item.isAdded || isAddingAll}
                                onClick={() => handleAddSingle(idx)}
                                className={cn(
                                    "shrink-0 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-0.5",
                                    item.isAdded
                                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300"
                                )}
                            >
                                {item.isAdded ? (
                                    <>
                                        <Check className="w-3 h-3" />
                                        {zh ? "已加" : "Added"}
                                    </>
                                ) : (
                                    <>
                                        <PlusCircle className="w-3 h-3" />
                                        {zh ? "加入" : "Add"}
                                    </>
                                )}
                            </button>
                        </div>

                        {/* 天數與時間微調膠囊 */}
                        <div className="flex items-center gap-1.5 pt-0.5">
                            <SingleDateCalendarPopover
                                dayNumber={item.day_number}
                                totalDays={activeTrip?.total_days || 7}
                                tripStartDate={activeTrip?.start_date}
                                onChangeDay={(newDay) => handleUpdateItemDay(idx, newDay)}
                            />
                            <ClockTimePickerPopover
                                time={item.time_slot}
                                onChangeTime={(newTime) => handleUpdateItemTime(idx, newTime)}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* 底部按鈕 */}
            <div className="p-3 pt-2 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
                <Button
                    type="button"
                    size="sm"
                    disabled={allAdded || isAddingAll || !activeTripId}
                    onClick={handleAddAll}
                    className={cn(
                        "w-full h-8 text-xs font-bold transition-all shadow-xs",
                        allAdded
                            ? "bg-emerald-600 hover:bg-emerald-600 cursor-default text-white"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    )}
                >
                    {isAddingAll ? (
                        <>
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            {zh
                                ? `正在批次加入 (${addingProgress || 0}/${itemsState.length})...`
                                : `Adding (${addingProgress || 0}/${itemsState.length})...`}
                        </>
                    ) : allAdded ? (
                        <>
                            <Check className="w-3.5 h-3.5 mr-1" />
                            {zh ? "全部已成功加入行程" : "All Added to Trip"}
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-3.5 h-3.5 mr-1" />
                            {zh ? "全部加入行程 (一鍵完成)" : "Add All to Itinerary"}
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}
