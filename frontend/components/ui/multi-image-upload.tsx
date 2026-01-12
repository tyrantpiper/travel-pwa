"use client"

/**
 * MultiImageUpload - 多圖片上傳元件
 * 
 * 功能:
 * - 📷 支援多張圖片上傳 (最多 5 張)
 * - 🗑️ 刪除單張圖片
 * - 👆 點擊預覽放大
 * - 📊 上傳進度顯示
 * - 🔄 自動同步到 image_urls 陣列
 * - 🆕 拖曳排序 (長按啟動，觸控友好)
 */

import { useState, useRef, useCallback } from "react"
import Image from "next/image"
import { Loader2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogTitle, DialogHeader } from "@/components/ui/dialog"
import { ZoomableImage } from "@/components/ui/zoomable-image"

// 🆕 DND-Kit imports
import {
    DndContext,
    closestCenter,
    TouchSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from "@dnd-kit/core"
import {
    arrayMove,
    SortableContext,
    rectSortingStrategy
} from "@dnd-kit/sortable"
import { SortablePhoto } from "./sortable-photo"

interface MultiImageUploadProps {
    values: string[]
    onChange: (urls: string[]) => void
    maxImages?: number
    folder?: string
    className?: string
}

export function MultiImageUpload({
    values = [],
    onChange,
    maxImages = 5,
    folder = "ryan_travel/spots",
    className
}: MultiImageUploadProps) {
    const [loading, setLoading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [previewIndex, setPreviewIndex] = useState<number | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // 🆕 DND Sensors - 長按 250ms 才啟動拖曳，避免與捲動衝突
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8  // 滑鼠需拖曳 8px 才啟動
            }
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,     // 長按 250ms 才啟動
                tolerance: 5    // 容許 5px 抖動
            }
        })
    )

    // 🆕 拖曳結束處理
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event
        if (over && active.id !== over.id) {
            const oldIndex = values.indexOf(active.id as string)
            const newIndex = values.indexOf(over.id as string)
            const newOrder = arrayMove(values, oldIndex, newIndex)
            onChange(newOrder)
            toast.success("排序已更新")
        }
    }, [values, onChange])

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // 檢查是否已達上限
        if (values.length >= maxImages) {
            toast.error(`最多只能上傳 ${maxImages} 張圖片`)
            return
        }

        setLoading(true)
        setProgress(0)

        try {
            const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
            const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY

            if (!cloudName || !apiKey) {
                toast.error("環境變數缺失！")
                setLoading(false)
                return
            }

            const timestamp = Math.round((new Date).getTime() / 1000)
            const paramsToSign = { timestamp, folder }

            const res = await fetch("/api/sign-cloudinary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paramsToSign }),
            })

            const { signature } = await res.json()

            const formData = new FormData()
            formData.append("file", file)
            formData.append("api_key", apiKey)
            formData.append("timestamp", String(timestamp))
            formData.append("signature", signature)
            formData.append("folder", folder)

            // 上傳到 Cloudinary
            const xhr = new XMLHttpRequest()

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    setProgress(Math.round((e.loaded / e.total) * 100))
                }
            }

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const data = JSON.parse(xhr.responseText)
                    onChange([...values, data.secure_url])
                    toast.success("圖片上傳成功")
                } else {
                    toast.error("上傳失敗")
                }
                setLoading(false)
                setProgress(0)
            }

            xhr.onerror = () => {
                toast.error("上傳失敗")
                setLoading(false)
                setProgress(0)
            }

            xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`)
            xhr.send(formData)

        } catch (err) {
            console.error("Upload error:", err)
            toast.error("上傳發生錯誤")
            setLoading(false)
        }

        // 清空 input
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    const handleRemove = useCallback((index: number) => {
        const newValues = values.filter((_, i) => i !== index)
        onChange(newValues)
    }, [values, onChange])

    const canAddMore = values.length < maxImages

    // 🆕 Cloudinary 縮圖轉換 (200x200, 裁切填滿)
    const getThumbnailUrl = useCallback((url: string) => {
        if (!url.includes('cloudinary.com')) return url
        return url.replace('/upload/', '/upload/w_200,h_200,c_fill,q_auto/')
    }, [])

    return (
        <>
            <div className={cn("space-y-3", className)}>
                {/* 圖片網格 - 支援拖曳排序 */}
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={values} strategy={rectSortingStrategy}>
                        <div className="flex flex-wrap gap-2">
                            {/* 已上傳的圖片 - 可拖曳 */}
                            {values.map((url, index) => (
                                <SortablePhoto
                                    key={url}
                                    id={url}
                                    url={url}
                                    index={index}
                                    onRemove={() => handleRemove(index)}
                                    onPreview={() => setPreviewIndex(index)}
                                    getThumbnailUrl={getThumbnailUrl}
                                />
                            ))}

                            {/* 新增按鈕 */}
                            {canAddMore && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={loading}
                                    className={cn(
                                        "w-16 h-16 rounded-lg border-2 border-dashed border-slate-300",
                                        "flex flex-col items-center justify-center gap-1",
                                        "text-slate-400 hover:text-blue-500 hover:border-blue-500",
                                        "transition-colors cursor-pointer",
                                        loading && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span className="text-[10px]">{progress}%</span>
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-5 h-5" />
                                            <span className="text-[10px]">{values.length}/{maxImages}</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </SortableContext>
                </DndContext>

                {/* 隱藏的 file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    className="hidden"
                />
            </div>

            {/* 預覽 Dialog */}
            <Dialog open={previewIndex !== null} onOpenChange={() => setPreviewIndex(null)}>
                <DialogContent className="max-w-[95vw] max-h-[90vh] p-0 bg-black/95 border-0 flex items-center justify-center">
                    <DialogHeader className="sr-only">
                        <DialogTitle>圖片預覽</DialogTitle>
                    </DialogHeader>
                    {previewIndex !== null && values[previewIndex] && (
                        <div className="relative w-full h-[80vh]">
                            <ZoomableImage
                                src={values[previewIndex]}
                                alt={`預覽 ${previewIndex + 1}`}
                                onClose={() => setPreviewIndex(null)}
                            />
                            {/* 圖片導航指示器 */}
                            {values.length > 1 && (
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                                    {values.map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setPreviewIndex(i)}
                                            className={cn(
                                                "w-2 h-2 rounded-full transition-colors",
                                                i === previewIndex ? "bg-white" : "bg-white/40"
                                            )}
                                        />
                                    ))}
                                </div>
                            )}
                            {/* 左右切換按鈕 */}
                            {values.length > 1 && (
                                <>
                                    <button
                                        onClick={() => setPreviewIndex((previewIndex - 1 + values.length) % values.length)}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/60 text-white rounded-full hover:bg-black/80"
                                    >
                                        ←
                                    </button>
                                    <button
                                        onClick={() => setPreviewIndex((previewIndex + 1) % values.length)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/60 text-white rounded-full hover:bg-black/80"
                                    >
                                        →
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
