"use client"

/**
 * SortableTimelineCard - 可拖曳排序的行程卡片包裝器
 * 
 * 使用 @dnd-kit 實作:
 * - 📱 觸控拖曳 (長按 250ms 啟動)
 * - 🖱️ 滑鼠拖曳
 * - ✨ 流暢動畫 (無抖動)
 */

import { memo, useEffect } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { TimelineCard } from "@/components/timeline-card"
import { Activity } from "@/lib/itinerary-types"
import { motion, useSpring } from "framer-motion"

interface SortableTimelineCardProps {
    activity: Activity
    index: number
    isLast: boolean
    isDragDisabled?: boolean
    onEdit: (item: Activity) => void
    onDelete: (id: string) => void
    onUpdateActivity: (id: string, updates: Partial<Activity>) => Promise<boolean>
}

// ⚡ 1. Memoized Inner Component: 防止拖曳時內容重繪
const MemoizedTimelineCard = memo(({ activity, index, isLast, onEdit, onDelete, onUpdateActivity }: SortableTimelineCardProps) => {
    return (
        <TimelineCard
            activity={activity}
            index={index}
            isLast={isLast}
            onEdit={onEdit}
            onDelete={onDelete}
            onUpdateActivity={onUpdateActivity}
        />
    )
}, (prev, next) => {
    // 自定義比較邏輯：只有 ID, Time, Memo, SubItems, Index, Last 狀態改變才重繪
    // 自定義比較邏輯：只有在關鍵資料變動時才重繪，以優化拖拽性能
    return prev.activity.id === next.activity.id &&
        prev.activity.time === next.activity.time &&
        (prev.activity.place_name || prev.activity.place) === (next.activity.place_name || next.activity.place) &&
        (prev.activity.notes || prev.activity.desc) === (next.activity.notes || next.activity.desc) &&
        prev.activity.category === next.activity.category &&
        prev.activity.memo === next.activity.memo &&
        prev.activity.lat === next.activity.lat &&
        prev.activity.lng === next.activity.lng &&
        prev.activity.image_url === next.activity.image_url &&
        JSON.stringify(prev.activity.image_urls) === JSON.stringify(next.activity.image_urls) &&
        JSON.stringify(prev.activity.preview_metadata) === JSON.stringify(next.activity.preview_metadata) &&  // 🆕 Image Hunter
        prev.activity.cost === next.activity.cost &&
        prev.activity.link_url === next.activity.link_url &&
        prev.activity.reservation_code === next.activity.reservation_code &&
        prev.activity.hide_navigation === next.activity.hide_navigation &&
        JSON.stringify(prev.activity.sub_items) === JSON.stringify(next.activity.sub_items) &&
        JSON.stringify(prev.activity.tags) === JSON.stringify(next.activity.tags) &&
        prev.index === next.index &&
        prev.isLast === next.isLast
})

MemoizedTimelineCard.displayName = "MemoizedTimelineCard"

export const SortableTimelineCard = memo(function SortableTimelineCard(props: SortableTimelineCardProps) {
    const { activity, isDragDisabled = false } = props

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        isDragging
    } = useSortable({
        id: activity?.id || 'null-activity',
        disabled: isDragDisabled || !activity
    })

    // ⚡ 2. Physics Engine: Spring Animation
    const springConfig = {
        stiffness: 400, // 緊實
        damping: 30,    // 微回彈
        mass: 0.8       // 輕盈
    }

    // 將 dnd-kit 的 transform 轉換為 Spring 值
    const x = useSpring(0, springConfig)
    const y = useSpring(0, springConfig)

    useEffect(() => {
        if (!transform) return
        x.set(transform.x)
        y.set(transform.y)
    }, [transform, x, y])

    if (!activity) return null;

    // Header 卡片 (00:00) 不可拖曳
    const isHeader = activity.category === 'header' ||
        (activity.time || activity.time_slot || "00:00") === '00:00'

    return (
        <motion.div
            ref={setNodeRef}
            data-testid="sortable-card"
            style={{
                x,
                y,
                scale: isDragging ? 1.02 : 1, // 🖱️ 拿起時微微放大
                zIndex: isDragging ? 50 : undefined,
                opacity: isDragging ? 0.3 : 1,
            }}
            className={cn(
                "relative select-none",
                // 🔧 FIX: Removed touch-none - it was blocking native scroll
                // touch-none is now ONLY on drag handle (line 116)
                "will-change-transform" // GPU Acceleration
            )}
        >
            {/* 拖曳把手 */}
            {!isHeader && !isDragDisabled && (
                <div
                    {...attributes}
                    {...listeners}
                    className={cn(
                        "absolute -left-1 top-1/2 -translate-y-1/2 z-10",
                        "p-2 rounded-lg",
                        "text-slate-400 hover:text-slate-600 hover:bg-slate-100",
                        "cursor-grab active:cursor-grabbing",
                        "touch-none select-none",
                        "opacity-50 hover:opacity-100 active:opacity-100"
                    )}
                >
                    <GripVertical className="w-5 h-5" />
                </div>
            )}

            {/* 原有的 TimelineCard (Memoized) */}
            <div className="group">
                <MemoizedTimelineCard {...props} />
            </div>
        </motion.div>
    )
})
