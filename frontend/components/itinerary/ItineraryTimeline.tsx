"use client"

import { Plus } from "lucide-react"
import { Virtuoso, VirtuosoHandle } from "react-virtuoso"
import { createPortal } from "react-dom"
import { DndContext, closestCorners, DragOverlay, DragStartEvent, DragEndEvent, SensorDescriptor, SensorOptions } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { SortableTimelineCard } from "@/components/itinerary/SortableTimelineCard"
import { TimelineCardOverlay } from "@/components/itinerary/TimelineCardOverlay"
import { Button } from "@/components/ui/button"
import { Activity, Trip } from "@/lib/itinerary-types"
import { POIBasicData } from "@/components/POIDetailDrawer"
import dynamic from "next/dynamic"

type DndSensorDescriptor = SensorDescriptor<SensorOptions>;

const DayMap = dynamic(() => import("@/components/day-map"), { ssr: false, loading: () => <div className="h-64 w-full bg-slate-100 animate-pulse rounded-xl" /> })

interface ItineraryTimelineProps {
    currentDayData: Activity[]
    dndSensors: DndSensorDescriptor[]
    handleDragStart: (event: DragStartEvent) => void
    handleDragEnd: (event: DragEndEvent) => void
    handleDragCancel: () => void
    itnVirtuosoRef: React.RefObject<VirtuosoHandle | null>
    scrollerEl: HTMLElement | null
    onEditActivity: (item: Activity) => void
    onDeleteActivity: (id: string) => void
    onUpdateActivity: (id: string, updates: Partial<Activity>) => Promise<boolean>
    activeId: string | null
    isOnline: boolean
    mounted: boolean
    onAddActivity: () => void
    onAddPOI: (poi: POIBasicData, time: string, notes?: string) => void
    currentTrip?: Trip
}

export function ItineraryTimeline({
    currentDayData,
    dndSensors,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    itnVirtuosoRef,
    scrollerEl,
    onEditActivity,
    onDeleteActivity,
    onUpdateActivity,
    activeId,
    isOnline,
    mounted,
    onAddActivity,
    onAddPOI,
    currentTrip
}: ItineraryTimelineProps) {

    // 預先計算每個項目的 realIndex
    const realIndices: number[] = [];
    let counter = 0;
    currentDayData.forEach((item: Activity) => {
        // 🛡️ Defensive Check: Ensure item exists before access
        const isHeader = item?.category === 'header' || (item?.time || "00:00") === '00:00' || item?.time_slot === '00:00';
        if (!isHeader) counter++;
        realIndices.push(counter);
    });

    return (
        <div className="px-5 py-6">
            <DndContext
                sensors={dndSensors}
                collisionDetection={closestCorners}
                autoScroll={{
                    threshold: { x: 0, y: 0.15 },
                    acceleration: 25,
                    interval: 10,
                }}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <SortableContext
                    items={currentDayData.map((a: Activity) => a.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {currentDayData.length > 0 ? (
                        <Virtuoso
                            ref={itnVirtuosoRef}
                            customScrollParent={scrollerEl || undefined}
                            useWindowScroll={false}
                            data={currentDayData}
                            increaseViewportBy={500} // 🆕 預渲染緩衝：改善快速滑動時的空白
                            initialItemCount={10}    // 🆕 初始載入項：優化首屏感官
                            itemContent={(idx, item) => {
                                // 🛡️ Defensive Check: Ensure item exists. Never return null to Virtuoso as it causes 'zero-sized' errors.
                                if (!item) return <div className="h-1" />

                                const isHeader = item.category === 'header' || (item.time || "00:00") === '00:00' || item.time_slot === '00:00'
                                return (
                                    <div className="pb-4 min-h-[40px]">
                                        <SortableTimelineCard
                                            activity={item}
                                            index={realIndices[idx] || 0}
                                            isLast={idx === currentDayData.length - 1}
                                            isDragDisabled={isHeader || !isOnline}
                                            onEdit={onEditActivity}
                                            onDelete={onDeleteActivity}
                                            onUpdateActivity={onUpdateActivity}
                                        />
                                    </div>
                                )
                            }}
                        />
                    ) : (
                        /* 🆕 穩定空狀態：防止卡片倏忽消失 */
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 mb-6">
                            <div className="text-4xl mb-4 opacity-50">🎑</div>
                            <p className="text-sm font-medium">今天尚未安排行程</p>
                            <p className="text-xs opacity-60 mt-1">點擊下方按鈕開始規劃冒險</p>
                        </div>
                    )}
                </SortableContext>

                {mounted && createPortal(
                    <DragOverlay
                        dropAnimation={{
                            duration: 250,
                            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                        }}
                    >
                        {activeId && (() => {
                            const activity = currentDayData.find((a: Activity) => a.id === activeId)
                            return activity ? <TimelineCardOverlay activity={activity} /> : null
                        })()}
                    </DragOverlay>,
                    document.body
                )}
            </DndContext>

            <div className="py-4 text-center">
                <Button
                    variant="outline"
                    className="w-full border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-medium h-12 rounded-xl"
                    disabled={!isOnline}
                    onClick={onAddActivity}
                >
                    <Plus className="w-4 h-4 mr-2" />{isOnline ? "Add Activity" : "✈️ 離線模式"}
                </Button>
            </div>

            <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-8">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest">Daily Route Map</h3>
                </div>
                <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                    <DayMap
                        activities={currentDayData}
                        onAddPOI={onAddPOI}
                        tripTitle={currentTrip?.title}
                    />
                </div>
            </div>
        </div>
    )
}
