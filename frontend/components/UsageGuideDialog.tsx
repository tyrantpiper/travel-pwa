"use client"

import { BookOpen } from "lucide-react"
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useLanguage } from "@/lib/LanguageContext"
import { UsageGuideContent } from "@/components/UsageGuideContent"

interface UsageGuideDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function UsageGuideDialog({ open, onOpenChange }: UsageGuideDialogProps) {
    const { lang } = useLanguage()
    const zh = lang === 'zh'

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0 gap-0">
                <DialogHeader className="sticky top-0 z-10 bg-white dark:bg-slate-800 p-5 pb-3 border-b border-slate-200 dark:border-slate-700">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                        {zh ? '使用說明' : 'Usage Guide'}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-400">
                        {zh ? '了解如何使用 Tabidachi 的所有功能' : 'Learn how to use all Tabidachi features'}
                    </DialogDescription>
                </DialogHeader>

                <div className="p-4">
                    <UsageGuideContent />
                </div>
            </DialogContent>
        </Dialog>
    )
}
