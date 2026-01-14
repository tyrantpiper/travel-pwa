"use client"

/**
 * ZoomableImage - 可縮放圖片預覽元件
 * 
 * 功能:
 * - 📱 手機雙指縮放 (Pinch to Zoom)
 * - 🖱️ 桌面滾輪縮放 (Wheel Zoom)
 * - 👆 雙擊放大/還原 (Double Click)
 * - ✋ 拖曳平移 (Pan/Drag)
 * - 🔄 縮放控制按鈕 (+/-/Reset)
 * 
 * 使用方式:
 * <ZoomableImage src={imageUrl} alt="Description" />
 */

import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch"
import Image from "next/image"
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

interface ZoomableImageProps {
    src: string
    alt: string
    className?: string
    containerClassName?: string
    showControls?: boolean
    minScale?: number
    maxScale?: number
    onClose?: () => void
}

// 縮放控制按鈕元件
function ZoomControls({ onClose }: { onClose?: () => void }) {
    const { zoomIn, zoomOut, resetTransform } = useControls()

    return (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-2 z-10">
            <button
                onClick={() => zoomOut()}
                className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
                aria-label="縮小"
            >
                <ZoomOut className="w-5 h-5" />
            </button>
            <button
                onClick={() => resetTransform()}
                className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
                aria-label="重置"
            >
                <RotateCcw className="w-5 h-5" />
            </button>
            <button
                onClick={() => zoomIn()}
                className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
                aria-label="放大"
            >
                <ZoomIn className="w-5 h-5" />
            </button>
            {onClose && (
                <>
                    <div className="w-px h-6 bg-white/30" />
                    <button
                        onClick={onClose}
                        className="px-3 py-1 text-white text-sm hover:bg-white/20 rounded-full transition-colors"
                    >
                        關閉
                    </button>
                </>
            )}
        </div>
    )
}

export function ZoomableImage({
    src,
    alt,
    className,
    containerClassName,
    showControls = true,
    minScale = 1,
    maxScale = 5,
    onClose
}: ZoomableImageProps) {
    return (
        <div className={cn("relative w-full h-full", containerClassName)}>
            <TransformWrapper
                initialScale={1}
                minScale={minScale}
                maxScale={maxScale}
                centerOnInit={true}
                doubleClick={{ mode: "toggle", step: 2 }}
                wheel={{ step: 0.1 }}
                pinch={{ step: 5 }}
                limitToBounds={true}
                velocityAnimation={{
                    sensitivity: 1,
                    animationTime: 200
                }}
            >
                {showControls && <ZoomControls onClose={onClose} />}
                <TransformComponent
                    wrapperStyle={{
                        width: "100%",
                        height: "100%",
                    }}
                    contentStyle={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",  // Required for Next.js Image fill
                    }}
                >
                    <Image
                        src={src}
                        alt={alt}
                        fill
                        className={cn("object-contain", className)}
                        unoptimized
                        draggable={false}
                        style={{
                            touchAction: "none",  // 防止觸控滾動衝突
                            userSelect: "none"    // 防止選取
                        }}
                    />
                </TransformComponent>
            </TransformWrapper>
        </div>
    )
}
