"use client"

import { useState } from "react"
import { Share2, Check, Copy } from "lucide-react"
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

    const handleShare = async () => {
        const shareUrl = `${window.location.origin}/share/${publicId}`

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
                if ((err as Error).name !== 'AbortError') {
                    console.error("Share failed:", err)
                } else {
                    return // User cancelled
                }
            }
        }

        // 2. Fallback: Clipboard Copy
        try {
            await navigator.clipboard.writeText(shareUrl)
            setIsCopied(true)
            toast.success("連結已複製到剪貼簿")
            setTimeout(() => setIsCopied(false), 2000)
        } catch (err) {
            toast.error("無法複製連結")
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
