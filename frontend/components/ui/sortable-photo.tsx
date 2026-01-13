"use client"

/**
 * SortablePhoto - 可拖曳排序的照片項目
 * 
 * 使用 @dnd-kit 實作，支援：
 * - 📱 觸控拖曳 (長按 250ms 啟動)
 * - 🖱️ 滑鼠拖曳
 * - ✨ 拖曳動畫效果
 */

import { memo } from "react"
import Image from "next/image"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { X, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"

interface SortablePhotoProps {
    id: string
    url: string
    index: number
    onRemove: () => void
    onPreview: () => void
    getThumbnailUrl: (url: string) => string
}

export const SortablePhoto = memo(function SortablePhoto({
    id,
    url,
    index,
    onRemove,
    onPreview,
    getThumbnailUrl
}: SortablePhotoProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id })

    // 🔧 修復抖動：使用 Translate (純平移)，不含 scale
    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.85 : 1,
        boxShadow: isDragging ? "0 8px 20px rgba(0,0,0,0.25)" : undefined,
        // 🆕 iOS 優化：防止 3D Touch 干擾
        WebkitTouchCallout: 'none',
        userSelect: 'none',
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "relative group w-16 h-16 rounded-lg overflow-hidden border",
                isDragging
                    ? "border-blue-500 ring-2 ring-blue-300"  // ✅ 移除 scale-105
                    : "border-slate-200 cursor-pointer hover:ring-2 hover:ring-blue-500",
                !isDragging && "transition-shadow transition-colors"  // ✅ 拖曳時無 transition
            )}
        >
            {/* 圖片 - 點擊預覽 */}
            <div onClick={onPreview} className="w-full h-full">
                <Image
                    src={getThumbnailUrl(url)}
                    alt={`圖片 ${index + 1}`}
                    fill
                    className="object-cover pointer-events-none"
                    unoptimized
                />
            </div>

            {/* 拖曳把手 - 長按/滑鼠拖曳 */}
            <div
                {...attributes}
                {...listeners}
                className={cn(
                    "absolute top-0 left-0 w-full h-full",
                    "flex items-center justify-center",
                    "bg-black/0 hover:bg-black/20 transition-colors",
                    "touch-none cursor-grab active:cursor-grabbing"
                )}
            >
                {/* 拖曳圖示 - hover 時顯示 */}
                <GripVertical
                    className="w-5 h-5 text-white drop-shadow-md opacity-0 group-hover:opacity-70 transition-opacity"
                />
            </div>

            {/* 刪除按鈕 */}
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    onRemove()
                }}
                className="absolute top-0.5 right-0.5 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
                <X className="w-3 h-3" />
            </button>

            {/* 序號 */}
            <div className="absolute bottom-0.5 left-0.5 px-1.5 py-0.5 bg-black/60 text-white text-xs rounded z-10">
                {index + 1}
            </div>
        </div>
    )
})
