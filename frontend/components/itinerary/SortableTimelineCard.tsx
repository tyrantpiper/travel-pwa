"use client"

/**
 * SortableTimelineCard - 可拖曳排序的行程卡片包裝器
 * 
 * 使用 @dnd-kit 實作:
 * - 📱 觸控拖曳 (長按 250ms 啟動)
 * - 🖱️ 滑鼠拖曳
 * - ✨ 流暢動畫 (無抖動)
 */

import { memo, CSSProperties } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { TimelineCard } from "@/components/timeline-card"
import { Activity, SubItem } from "@/lib/itinerary-types"

interface SortableTimelineCardProps {
    activity: Activity
    index: number
    isLast: boolean
    isDragDisabled?: boolean
    onEdit: (item: Activity) => void
    onDelete: (id: string) => void
    onUpdateMemo: (id: string, memo: string) => Promise<boolean>
    onUpdateSubItems: (id: string, items: SubItem[]) => Promise<boolean>
}

export const SortableTimelineCard = memo(function SortableTimelineCard({
    activity,
    index,
    isLast,
    isDragDisabled = false,
    onEdit,
    onDelete,
    onUpdateMemo,
    onUpdateSubItems
}: SortableTimelineCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: activity.id,
        disabled: isDragDisabled
    })

    // 🔧 防抖動技術：使用 CSS.Translate 純平移
    // 🔑 拖曳時隱藏原項目 (由 DragOverlay 顯示)
    const style: CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0 : 1,  // 🆕 拖曳時完全隱藏
        WebkitTouchCallout: 'none',
        userSelect: 'none',
    }

    // Header 卡片 (00:00) 不可拖曳
    const isHeader = activity.category === 'header' ||
        (activity.time || activity.time_slot || "00:00") === '00:00'

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "relative",
                isDragging && "ring-2 ring-blue-400 ring-offset-2 rounded-xl",
                !isDragging && "transition-shadow"
            )}
        >
            {/* 拖曳把手 - 只在非 Header 時顯示 */}
            {!isHeader && !isDragDisabled && (
                <div
                    {...attributes}
                    {...listeners}
                    className={cn(
                        "absolute -left-2 top-1/2 -translate-y-1/2 z-10",
                        "p-2 rounded-lg",
                        "text-slate-300 hover:text-slate-500 hover:bg-slate-100",
                        "cursor-grab active:cursor-grabbing",
                        "touch-none transition-colors",
                        "opacity-0 group-hover:opacity-100 md:opacity-60"
                    )}
                >
                    <GripVertical className="w-4 h-4" />
                </div>
            )}

            {/* 原有的 TimelineCard */}
            <div className="group">
                <TimelineCard
                    activity={activity}
                    index={index}
                    isLast={isLast}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onUpdateMemo={onUpdateMemo}
                    onUpdateSubItems={onUpdateSubItems}
                />
            </div>
        </div>
    )
})
