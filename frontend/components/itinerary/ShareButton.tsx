"use client"

import { useState } from "react"
import { Share2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface ShareButtonProps {
    publicId: string
    tripTitle: string
    className?: string
}

export function ShareButton({ publicId, tripTitle, className }: ShareButtonProps) {
    const [isCopied, setIsCopied] = useState(false)
    const [isSharing, setIsSharing] = useState(false)

    const handleShare = async () => {
        if (isSharing) return

        setIsSharing(true)
        const shareUrl = `${window.location.origin}/share/${publicId}`

        try {
            // 1. Try Web Share API (Mobile native share)
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: `${tripTitle} | Tabidachi`,
                        text: `查看我的行程規劃：${tripTitle}`,
                        url: shareUrl,
                    })
                    return
                } catch (err) {
                    const error = err as Error
                    // AbortError is normal (user cancelled)
                    // InvalidStateError means another share is active
                    if (error.name !== 'AbortError' && error.name !== 'InvalidStateError') {
                        console.error("Share failed:", err)
                    }
                }
            }

            // 2. Fallback: Clipboard Copy (or if navigator.share failed/unsupported)
            await navigator.clipboard.writeText(shareUrl)
            setIsCopied(true)
            toast.success("連結已複製到剪貼簿")
            setTimeout(() => setIsCopied(false), 2000)
        } catch {
            toast.error("無法分享或複製連結")
        } finally {
            setIsSharing(false)
        }
    }

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className={cn(
                "h-11 w-11 p-0 rounded-full border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm active:scale-90 transition-all text-slate-600 dark:text-slate-300",
                className
            )}
            title="分享行程"
        >
            {isCopied ? (
                <Check className="w-5 h-5 text-emerald-500" />
            ) : (
                <Share2 className="w-5 h-5" />
            )}
        </Button>
    )
}
