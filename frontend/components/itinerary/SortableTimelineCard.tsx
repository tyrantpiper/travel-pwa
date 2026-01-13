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
    // 🔧 FIX 3: 半透明佔位器 (opacity 0.3 而非 0)
    const style: CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.3 : 1,  // 🔧 FIX: 顯示佔位器
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
                "relative select-none",  // 🔧 FIX 2: 阻止文字選取
                isDragging && "ring-2 ring-blue-400 ring-offset-2 rounded-xl",
                !isDragging && "transition-shadow"
            )}
        >
            {/* 拖曳把手 - 始終可見 */}
            {!isHeader && !isDragDisabled && (
                <div
                    {...attributes}
                    {...listeners}
                    className={cn(
                        "absolute -left-1 top-1/2 -translate-y-1/2 z-10",
                        "p-2 rounded-lg",
                        "text-slate-400 hover:text-slate-600 hover:bg-slate-100",
                        "cursor-grab active:cursor-grabbing",
                        "touch-none select-none",  // 🔧 FIX 2: 阻止文字選取
                        "opacity-50 hover:opacity-100 active:opacity-100"  // 🔧 FIX 1: 始終可見
                    )}
                >
                    <GripVertical className="w-5 h-5" />
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
