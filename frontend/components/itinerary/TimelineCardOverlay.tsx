"use client"

/**
 * TimelineCardOverlay - 拖曳時的覆蓋層卡片
 * 
 * 用於 DragOverlay，在拖曳時顯示卡片副本
 * 這是簡化版，只需視覺呈現
 */

import { memo } from "react"
import {
    MapPin, Utensils, Train, ShoppingBag, Bed, Camera, StickyNote
} from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { Activity } from "@/lib/itinerary-types"

const iconMap: Record<string, React.ElementType> = {
    sightseeing: Camera,
    food: Utensils,
    transport: Train,
    shopping: ShoppingBag,
    accommodation: Bed,
    note: StickyNote,
    default: MapPin,
}

interface TimelineCardOverlayProps {
    activity: Activity
}

export const TimelineCardOverlay = memo(function TimelineCardOverlay({
    activity
}: TimelineCardOverlayProps) {
    const Icon = iconMap[activity.category || "default"] || iconMap.default
    const isHeader = activity.category === 'header' ||
        (activity.time || activity.time_slot || "00:00") === '00:00'

    return (
        <div
            className={cn(
                "bg-white rounded-xl border-2 border-blue-400 shadow-2xl",
                "p-4 w-full max-w-md",
                "ring-4 ring-blue-200/50",
                "cursor-grabbing"
            )}
            style={{
                boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
                transform: "scale(1.02)",
            }}
        >
            <div className="flex items-start gap-3">
                {/* 時間 + 圖示 */}
                <div className="flex flex-col items-center gap-1 pt-0.5">
                    {!isHeader && (
                        <span className="text-xs font-mono font-bold text-blue-600">
                            {activity.time || activity.time_slot || "00:00"}
                        </span>
                    )}
                    <div className="p-2 rounded-full bg-blue-50">
                        <Icon className="w-4 h-4 text-blue-600" />
                    </div>
                </div>

                {/* 內容 */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 truncate">
                        {activity.place || activity.place_name || "未命名"}
                    </h3>
                    {activity.desc && (
                        <p className="text-sm text-slate-500 line-clamp-2 mt-1">
                            {activity.desc}
                        </p>
                    )}
                </div>

                {/* 縮圖 */}
                {activity.image_url && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border">
                        <Image
                            src={activity.image_url}
                            alt=""
                            width={48}
                            height={48}
                            className="object-cover w-full h-full"
                            unoptimized
                        />
                    </div>
                )}
            </div>

            {/* 拖曳提示 */}
            <div className="mt-2 text-center">
                <span className="text-xs text-blue-500 font-medium">
                    📍 移動到目標位置後放開
                </span>
            </div>
        </div>
    )
})
