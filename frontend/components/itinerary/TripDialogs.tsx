"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { ImageUpload } from "@/components/ui/image-upload"
import { useLanguage } from "@/lib/LanguageContext"
import { useHaptic } from "@/lib/hooks"
import { Plus, Hash, Loader2 } from "lucide-react"
import { tripsApi } from "@/lib/api"
import { PushPermissionPrompt } from "@/components/notifications/push-permission-prompt"

interface CreateTripModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    userId: string
    onSuccess: (trip?: { id: string; title: string }) => void
}

export function CreateTripModal({
    isOpen,
    onOpenChange,
    userId,
    onSuccess,
}: CreateTripModalProps) {
    const { t } = useLanguage()
    const haptic = useHaptic()
    const [title, setTitle] = useState("")
    const [startDate, setStartDate] = useState("2026-02-02")
    const [endDate, setEndDate] = useState("2026-02-10")
    const [coverImage, setCoverImage] = useState("")
    const [isCreating, setIsCreating] = useState(false)

    const handleCreate = async () => {
        if (isCreating) return
        haptic.tap()

        const userName = localStorage.getItem("user_nickname")
        const activeUserId = localStorage.getItem("user_uuid") || userId
        if (!activeUserId || !title) {
            haptic.error()
            return
        }

        setIsCreating(true)
        try {
            const newTrip = await tripsApi.create({
                title,
                start_date: startDate,
                end_date: endDate,
                creator_name: userName || undefined,
                user_id: activeUserId,
                cover_image: coverImage || undefined
            })
            haptic.success()
            onOpenChange(false)
            setCoverImage("")
            setTitle("")
            onSuccess(newTrip) // Pass the new trip back
        } catch (error) {
            haptic.error()
            // 🆕 Phase 2: 顯示後端返回的錯誤訊息（如行程上限）
            const message = error instanceof Error ? error.message : "建立行程失敗"
            toast.error(message)
        }
        finally { setIsCreating(false) }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button className="h-24 border-2 border-dashed border-slate-300 bg-transparent text-slate-400 hover:bg-slate-100 rounded-2xl flex flex-col gap-2">
                    <Plus className="w-6 h-6" />
                    <span className="text-xs font-bold uppercase">{t('new_trip')}</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('create_trip')}</DialogTitle>
                    <DialogDescription className="sr-only">
                        建立一個新的旅遊行程並設定基本資訊
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="flex justify-center">
                        <ImageUpload
                            value={coverImage}
                            onChange={setCoverImage}
                            onRemove={() => setCoverImage("")}
                            folder="ryan_travel/covers"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{t('trip_name')}</Label>
                        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tokyo 2026" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('start_date')}</Label>
                            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('end_date')}</Label>
                            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button className="flex-1" onClick={handleCreate} disabled={isCreating}>
                            {isCreating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />創建中...</> : t('create')}
                        </Button>
                        <Button variant="outline" className="flex-1" onClick={() => toast.info("Go to Tools page for AI import")}>
                            {t('ai_import')}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

interface JoinTripDialogProps {
    userId: string
    onSuccess: () => void
}

export function JoinTripDialog({
    userId,
    onSuccess,
}: JoinTripDialogProps) {
    const { t } = useLanguage()
    const [joinCode, setJoinCode] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [showPushPrompt, setShowPushPrompt] = useState(false)

    const handleJoin = async () => {
        if (joinCode.length < 4 || joinCode.length > 6) {
            toast.warning(t('warning_code_length') || "請輸入 4 到 6 位數代碼")
            return
        }
        setIsLoading(true)
        const userName = localStorage.getItem("user_nickname")
        const activeUserId = localStorage.getItem("user_uuid") || userId
        try {
            await tripsApi.join({
                share_code: joinCode,
                user_id: activeUserId,
                user_name: userName || undefined
            })
            toast.success("Joined!")
            setJoinCode("")
            onSuccess()
            // 🔔 加入行程成功後，引導推播授權
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
                setTimeout(() => setShowPushPrompt(true), 800)
            }
        } catch { toast.error("Trip not found") }
        finally { setIsLoading(false) }
    }

    return (
        <>
        <Dialog>
            <DialogTrigger asChild>
                <Button className="h-24 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl flex flex-col gap-2 shadow-lg">
                    <Hash className="w-6 h-6 text-amber-400" />
                    <span className="text-xs font-bold uppercase">{t('join_code')}</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xs">
                <DialogHeader>
                    <DialogTitle>{t('enter_trip_code')}</DialogTitle>
                    <DialogDescription className="sr-only">
                        輸入 4 到 6 位數共享代碼加入現有行程
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Input
                        placeholder={t('join_trip_placeholder') || "輸入代碼"}
                        className="text-center text-2xl tracking-[0.3em] font-mono uppercase h-14"
                        maxLength={6}
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                    />
                    <Button className="w-full" onClick={handleJoin} disabled={isLoading}>
                        {isLoading ? t('joining') : t('join_trip')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
        <PushPermissionPrompt
            isOpen={showPushPrompt}
            onClose={() => setShowPushPrompt(false)}
        />
        </>
    )
}
