"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { ImageUpload } from "@/components/ui/image-upload"
import { CalendarRangeSheet } from "@/components/itinerary/CalendarRangeSheet"
import { AiGrillMeWizard } from "@/components/itinerary/AiGrillMeWizard"
import { AiImportTripWizard } from "@/components/itinerary/AiImportTripWizard"
import { useLanguage } from "@/lib/LanguageContext"
import { useHaptic } from "@/lib/hooks"
import { Plus, Hash, Loader2, Calendar, Sparkles, FileText, Compass, Check, ClipboardPaste, FolderInput } from "lucide-react"
import { tripsApi, aiApi } from "@/lib/api"
import { type Trip } from "@/lib/itinerary-types"
import { PushPermissionPrompt } from "@/components/notifications/push-permission-prompt"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface CreateTripModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    userId: string
    trips?: Trip[]
    onSuccess: (trip?: { id: string; title: string }) => void
}

const INSPIRATION_PILLS = [
    { label: "🇯🇵 東京 5 日遊", title: "東京 5 日遊", days: 5 },
    { label: "🌸 京都漫步 4 日", title: "京都古都漫步", days: 4 },
    { label: "🏖️ 沖繩度假 4 日", title: "沖繩海灘度假", days: 4 },
    { label: "🏔️ 北海道 6 日", title: "北海道雪國之旅", days: 6 },
    { label: "🇭🇰 香港美食 3 日", title: "香港美食探索", days: 3 },
]

function calculateDays(start: string, end: string): number {
    try {
        const s = new Date(start)
        const e = new Date(end)
        const diffTime = e.getTime() - s.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
        return Math.max(1, diffDays)
    } catch {
        return 1
    }
}

export function CreateTripModal({
    isOpen,
    onOpenChange,
    userId,
    trips,
    onSuccess,
}: CreateTripModalProps) {
    const { t } = useLanguage()
    const haptic = useHaptic()

    // 1. 導航分段狀態
    const [activeTab, setActiveTab] = useState<'manual' | 'ai_generate' | 'ai_import'>('manual')

    // 2. 手動建立狀態 (動態明日起算 5 天)
    const [title, setTitle] = useState("")
    const [startDate, setStartDate] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        return d.toISOString().split('T')[0]
    })
    const [endDate, setEndDate] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() + 5)
        return d.toISOString().split('T')[0]
    })
    const [coverImage, setCoverImage] = useState("")
    const [isCreating, setIsCreating] = useState(false)
    const [isCalendarOpen, setIsCalendarOpen] = useState(false)

    // 3. 原地 AI 智能生成狀態
    const [aiMode, setAiMode] = useState<'wizard' | 'freeform'>('wizard')
    const [aiPrompt, setAiPrompt] = useState("")
    const [isAiLoading, setIsAiLoading] = useState(false)
    const [aiProgress, setAiProgress] = useState<string | null>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [aiResult, setAiResult] = useState<any | null>(null)

    // 4. 原地 AI 匯入狀態
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [importResult, setImportResult] = useState<any | null>(null)

    // 5. 儲存目標選擇 (建立新行程 vs 合併現有行程)
    const [saveTarget, setSaveTarget] = useState<'new' | 'existing'>('new')
    const [selectedTripId, setSelectedTripId] = useState<string>(() => trips?.[0]?.id || "")

    useEffect(() => {
        if (trips && trips.length > 0 && !selectedTripId) {
            setSelectedTripId(trips[0].id)
        }
    }, [trips, selectedTripId])

    // 手動建立提交
    const handleCreate = async () => {
        if (isCreating) return
        haptic.tap()

        const userName = localStorage.getItem("user_nickname")
        const activeUserId = localStorage.getItem("user_uuid") || userId
        if (!activeUserId || !title.trim()) {
            haptic.error()
            toast.warning(t('ts_title_required') || "請輸入行程名稱")
            return
        }

        setIsCreating(true)
        try {
            const newTrip = await tripsApi.create({
                title: title.trim(),
                start_date: startDate,
                end_date: endDate,
                creator_name: userName || undefined,
                user_id: activeUserId,
                cover_image: coverImage || undefined
            })
            haptic.success()
            toast.success(t('trip_created_success'))
            onOpenChange(false)
            setCoverImage("")
            setTitle("")
            onSuccess(newTrip)
        } catch (error) {
            haptic.error()
            const message = error instanceof Error ? error.message : "建立行程失敗"
            toast.error(message)
        } finally {
            setIsCreating(false)
        }
    }

    // AI 智能生成 (支援直接傳入結構化 XML Prompt 或自由文字)
    const handleAiGenerate = async (customPrompt?: string) => {
        const promptToSend = (customPrompt || aiPrompt).trim()
        if (!promptToSend || isAiLoading) return
        haptic.tap()
        setIsAiLoading(true)
        setAiProgress(t('ai_generating_step'))
        const activeUserId = localStorage.getItem("user_uuid") || userId

        try {
            const response = await aiApi.generateTrip({
                prompt: promptToSend,
                user_id: activeUserId
            })
            setAiProgress(t('ai_geocoding_step'))

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const itineraryData = (response as any).data || response
            if (!itineraryData.items || itineraryData.items.length === 0) {
                setAiResult(null)
                toast.error("AI 未能生成有效的景點列表，請再試一次")
                return
            }

            setAiResult(itineraryData)
            haptic.success()
            toast.success(t('tv_ai_generated', { count: String(itineraryData.items?.length || 0) }))
        } catch (error) {
            haptic.error()
            const msg = error instanceof Error ? error.message : "生成失敗"
            toast.error(`生成失敗: ${msg}`)
            setAiResult(null)
        } finally {
            setIsAiLoading(false)
            setAiProgress(null)
        }
    }

    // 儲存 AI 生成 / 匯入為新行程或合併至現有行程
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleSaveAiOrImportTrip = async (result: any) => {
        if (!result?.items) return
        haptic.tap()
        setIsCreating(true)

        const activeUserId = localStorage.getItem("user_uuid") || userId
        const userName = localStorage.getItem("user_nickname")

        if (!activeUserId) {
            toast.error("Please login first")
            setIsCreating(false)
            return
        }

        try {
            if (saveTarget === 'existing' && (selectedTripId || trips?.[0]?.id)) {
                const targetId = selectedTripId || trips![0].id
                const data = await tripsApi.importToTrip(targetId, {
                    items: result.items,
                    daily_locations: result.daily_locations || {},
                    day_notes: result.day_notes || {},
                    day_costs: result.day_costs || {},
                    day_tickets: result.day_tickets || {},
                    day_checklists: result.day_checklists || {},
                    ai_review: result.ai_review,
                    user_id: activeUserId
                })

                haptic.success()
                toast.success(data.message || t('trip_merged_success'))
                onOpenChange(false)
                setAiResult(null)
                setImportResult(null)
                setAiPrompt("")
                setSaveTarget('new')
                const matchedTrip = trips?.find(t => t.id === targetId)
                onSuccess({ id: targetId, title: matchedTrip?.title || "Updated Trip" })
            } else {
                // 建立為全新行程
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const maxDay = result.items?.length > 0 ? Math.max(...result.items.map((it: any) => it.day_number || it.day || 1)) : 1
                const startDateStr = result.start_date || new Date().toISOString().split('T')[0]
                const startDateObj = new Date(startDateStr)
                const calculatedEndDateObj = new Date(startDateObj)
                calculatedEndDateObj.setDate(calculatedEndDateObj.getDate() + (maxDay - 1))
                const endDateStr = result.end_date || calculatedEndDateObj.toISOString().split('T')[0]

                const data = await tripsApi.saveItinerary({
                    title: result.title || "New AI Trip",
                    start_date: startDateStr,
                    end_date: endDateStr,
                    items: result.items,
                    user_id: activeUserId,
                    creator_name: userName || "Traveler",
                    daily_locations: result.daily_locations || {},
                    day_notes: result.day_notes || {},
                    day_costs: result.day_costs || {},
                    day_tickets: result.day_tickets || {},
                    day_checklists: result.day_checklists || {},
                    ai_review: result.ai_review
                })

                haptic.success()
                toast.success(t('trip_created_success'))
                onOpenChange(false)
                setAiResult(null)
                setImportResult(null)
                setAiPrompt("")
                setSaveTarget('new')
                onSuccess({ id: data.id, title: data.title || result.title || "New AI Trip" })
            }
        } catch (error) {
            haptic.error()
            toast.error(error instanceof Error ? error.message : "儲存行程失敗")
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button className="h-24 border-2 border-dashed border-slate-300 dark:border-slate-700 bg-transparent text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl flex flex-col gap-2 cursor-pointer transition-all active:scale-[0.98]">
                    <Plus className="w-6 h-6 text-amber-500" />
                    <span className="text-xs font-bold uppercase tracking-wider">{t('new_trip')}</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader className="pb-2">
                    <DialogTitle className="text-xl font-serif">{t('create_trip')}</DialogTitle>
                    <DialogDescription className="sr-only">
                        建立一個新的旅遊行程並設定基本資訊
                    </DialogDescription>

                    {/* iOS Swift Segmented Control */}
                    <div className="flex bg-stone-100 dark:bg-slate-800/90 p-1 rounded-xl border border-stone-200/60 dark:border-slate-700/60 mt-3 select-none">
                        <button
                            type="button"
                            onClick={() => {
                                haptic.selection()
                                setActiveTab('manual')
                            }}
                            className={cn(
                                "flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                                activeTab === 'manual'
                                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs"
                                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            )}
                        >
                            <Compass className="w-3.5 h-3.5 text-amber-500" />
                            <span>{t('tab_manual_create')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                haptic.selection()
                                setActiveTab('ai_generate')
                            }}
                            className={cn(
                                "flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                                activeTab === 'ai_generate'
                                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs"
                                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            )}
                        >
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{t('tab_ai_generate')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                haptic.selection()
                                setActiveTab('ai_import')
                            }}
                            className={cn(
                                "flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                                activeTab === 'ai_import'
                                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs"
                                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            )}
                        >
                            <FileText className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{t('tab_ai_import')}</span>
                        </button>
                    </div>
                </DialogHeader>

                <AnimatePresence mode="wait">
                    {/* 1. 手動建立模式 (Manual Create) */}
                    {activeTab === 'manual' && (
                        <motion.div
                            key="manual-tab"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className="space-y-4 py-2"
                        >
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
                                <Input
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder={t('trip_name_placeholder') || "例如：東京自由行 2026"}
                                    className="h-11"
                                />

                                {/* Inspiration Pills */}
                                <div className="pt-1">
                                    <div className="flex items-center gap-1.5 mb-1.5 text-xs text-slate-400 font-medium">
                                        <Sparkles className="w-3 h-3 text-amber-500" />
                                        <span>{t('inspire_pills_label')}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {INSPIRATION_PILLS.map((pill) => (
                                            <button
                                                key={pill.label}
                                                type="button"
                                                onClick={() => {
                                                    haptic.selection()
                                                    setTitle(pill.title)
                                                    const startObj = new Date(startDate)
                                                    const endObj = new Date(startObj)
                                                    endObj.setDate(endObj.getDate() + (pill.days - 1))
                                                    setEndDate(endObj.toISOString().split('T')[0])
                                                }}
                                                className="px-2.5 py-1 text-xs rounded-full bg-stone-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-700 hover:text-amber-700 dark:hover:text-amber-300 border border-stone-200/60 dark:border-slate-700/60 transition-colors cursor-pointer select-none active:scale-95"
                                            >
                                                {pill.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* 超強 CalendarRangeSheet 日期膠囊 */}
                            <div className="space-y-2">
                                <Label>{t('travel_dates')}</Label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        haptic.selection()
                                        setIsCalendarOpen(true)
                                    }}
                                    className="w-full h-12 px-4 rounded-xl bg-stone-100 dark:bg-slate-800/80 border border-stone-200/80 dark:border-slate-700 flex items-center justify-between hover:bg-stone-200/60 dark:hover:bg-slate-700/60 active:scale-[0.99] transition-all cursor-pointer select-none shadow-2xs"
                                >
                                    <div className="flex items-center gap-2.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                                        <Calendar className="w-4 h-4 text-amber-500" />
                                        <span>{startDate} ~ {endDate}</span>
                                    </div>
                                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-400/20 text-amber-600 dark:text-amber-400 font-bold">
                                        {calculateDays(startDate, endDate)} {t('days_suffix')}
                                    </span>
                                </button>
                            </div>

                            <div className="pt-3">
                                <Button
                                    className="w-full h-11 bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-900 text-white font-bold rounded-xl shadow-md cursor-pointer transition-all active:scale-[0.99]"
                                    onClick={handleCreate}
                                    disabled={isCreating}
                                >
                                    {isCreating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />創建中...</> : t('create')}
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {/* 2. AI 智能生成模式 (AI Generate with Grill-Me Wizard) */}
                    {activeTab === 'ai_generate' && (
                        <motion.div
                            key="ai-generate-tab"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className="space-y-3 py-1"
                        >
                            {/* Generating Progress State */}
                            {isAiLoading && (
                                <div className="p-5 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex flex-col items-center justify-center text-center gap-3 my-4">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-400/20 flex items-center justify-center">
                                        <Loader2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400 animate-spin" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
                                            {aiProgress || t('ai_generating_step')}
                                        </div>
                                        <div className="text-xs text-indigo-600/80 dark:text-indigo-400/80 font-medium">
                                            正在為您客製化最流暢的每日時光動線...
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Generated Result Preview */}
                            {aiResult && !isAiLoading && (
                                <div className="p-4 rounded-2xl bg-stone-100 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-indigo-500" />
                                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{aiResult.title || "AI 生成行程"}</span>
                                        </div>
                                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 font-semibold">
                                            {aiResult.items?.length || 0} {t('trip_preview_spots')}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        📅 {aiResult.start_date} ~ {aiResult.end_date}
                                    </p>

                                    {/* 📥 儲存目標選擇 (新建 vs 合併) */}
                                    <div className="space-y-2 pt-2 border-t border-stone-200/80 dark:border-slate-700/80">
                                        <div className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                                            <span>{t('save_target_label')}</span>
                                            <span className="text-[11px] font-normal text-slate-400">{t('save_target_desc')}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    haptic.selection()
                                                    setSaveTarget('new')
                                                }}
                                                className={cn(
                                                    "p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer select-none active:scale-98",
                                                    saveTarget === 'new'
                                                        ? "bg-indigo-500/10 dark:bg-indigo-400/15 border-indigo-500 dark:border-indigo-400 text-indigo-700 dark:text-indigo-300 font-bold shadow-2xs"
                                                        : "bg-stone-50 dark:bg-slate-900 border-stone-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                                )}
                                            >
                                                <Plus className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
                                                <span className="text-xs">{t('save_as_new_trip')}</span>
                                            </button>
                                            <button
                                                type="button"
                                                disabled={!trips || trips.length === 0}
                                                onClick={() => {
                                                    haptic.selection()
                                                    setSaveTarget('existing')
                                                    if (!selectedTripId && trips && trips.length > 0) {
                                                        setSelectedTripId(trips[0].id)
                                                    }
                                                }}
                                                className={cn(
                                                    "p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer select-none active:scale-98 disabled:opacity-40",
                                                    saveTarget === 'existing'
                                                        ? "bg-indigo-500/10 dark:bg-indigo-400/15 border-indigo-500 dark:border-indigo-400 text-indigo-700 dark:text-indigo-300 font-bold shadow-2xs"
                                                        : "bg-stone-50 dark:bg-slate-900 border-stone-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                                )}
                                            >
                                                <FolderInput className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
                                                <span className="text-xs">{t('merge_into_existing_trip')}</span>
                                            </button>
                                        </div>

                                        {saveTarget === 'existing' && trips && trips.length > 0 && (
                                            <div className="pt-1">
                                                <select
                                                    value={selectedTripId || trips[0]?.id}
                                                    onChange={e => setSelectedTripId(e.target.value)}
                                                    className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer outline-hidden focus:border-indigo-500"
                                                >
                                                    {trips.map(tr => (
                                                        <option key={tr.id} value={tr.id}>
                                                            {tr.title} ({tr.start_date} ~ {tr.end_date})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 pt-1">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                haptic.tap()
                                                setAiResult(null)
                                            }}
                                            className="h-10 px-3 text-xs rounded-xl cursor-pointer"
                                        >
                                            {t('replan_btn')}
                                        </Button>
                                        <Button
                                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl h-10 shadow-sm cursor-pointer"
                                            onClick={() => handleSaveAiOrImportTrip(aiResult)}
                                            disabled={isCreating}
                                        >
                                            {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
                                            {saveTarget === 'existing' ? t('save_and_merge') : t('save_as_trip')}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Dual Mode Switcher (Wizard vs Freeform) */}
                            {!aiResult && !isAiLoading && (
                                <>
                                    <div className="flex bg-stone-100 dark:bg-slate-800 p-0.5 rounded-xl border border-stone-200/80 dark:border-slate-700/80 text-xs font-semibold select-none">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                haptic.selection()
                                                setAiMode('wizard')
                                            }}
                                            className={cn(
                                                "flex-1 py-1 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5",
                                                aiMode === 'wizard'
                                                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs font-bold"
                                                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                            )}
                                        >
                                            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                                            <span>{t('mode_grill_me')}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                haptic.selection()
                                                setAiMode('freeform')
                                            }}
                                            className={cn(
                                                "flex-1 py-1 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5",
                                                aiMode === 'freeform'
                                                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs font-bold"
                                                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                            )}
                                        >
                                            <span>{t('mode_freeform')}</span>
                                        </button>
                                    </div>

                                    {/* 1. 🧙‍♂️ 智能引導模式 (Grill-Me Wizard) */}
                                    {aiMode === 'wizard' && (
                                        <AiGrillMeWizard
                                            onComplete={(xmlPrompt) => {
                                                handleAiGenerate(xmlPrompt)
                                            }}
                                        />
                                    )}

                                    {/* 2. ✍️ 自由輸入模式 (Freeform Prompt) */}
                                    {aiMode === 'freeform' && (
                                        <div className="space-y-4 pt-1">
                                            <div className="space-y-2">
                                                <Label>{t('ai_prompt_label')}</Label>
                                                <Textarea
                                                    value={aiPrompt}
                                                    onChange={e => setAiPrompt(e.target.value)}
                                                    placeholder={t('ai_prompt_placeholder')}
                                                    rows={4}
                                                    className="resize-none font-sans"
                                                />
                                                <p className="text-xs text-slate-400">{t('ai_prompt_hint')}</p>
                                            </div>

                                            <Button
                                                className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md cursor-pointer transition-all active:scale-[0.99]"
                                                onClick={() => handleAiGenerate()}
                                                disabled={isAiLoading || !aiPrompt.trim()}
                                            >
                                                <Sparkles className="w-4 h-4 mr-2" />
                                                {t('ai_generate_btn')}
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </motion.div>
                    )}

                    {/* 3. 筆記/圖片多模態匯入模式 (AI Multimodal Import) */}
                    {activeTab === 'ai_import' && (
                        <motion.div
                            key="ai-import-tab"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className="space-y-4 py-1"
                        >
                            {/* Imported Result Preview */}
                            {importResult ? (
                                <div className="p-4 rounded-2xl bg-stone-100 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-emerald-500" />
                                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{importResult.title || "匯入行程"}</span>
                                        </div>
                                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 font-semibold">
                                            {importResult.items?.length || 0} {t('trip_preview_spots')}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        📅 {importResult.start_date || startDate} ~ {importResult.end_date || endDate}
                                    </p>

                                    {/* 📥 儲存目標選擇 (新建 vs 合併) */}
                                    <div className="space-y-2 pt-2 border-t border-stone-200/80 dark:border-slate-700/80">
                                        <div className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                                            <span>{t('save_target_label')}</span>
                                            <span className="text-[11px] font-normal text-slate-400">{t('save_target_desc')}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    haptic.selection()
                                                    setSaveTarget('new')
                                                }}
                                                className={cn(
                                                    "p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer select-none active:scale-98",
                                                    saveTarget === 'new'
                                                        ? "bg-emerald-500/10 dark:bg-emerald-400/15 border-emerald-500 dark:border-emerald-400 text-emerald-700 dark:text-emerald-300 font-bold shadow-2xs"
                                                        : "bg-stone-50 dark:bg-slate-900 border-stone-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                                )}
                                            >
                                                <Plus className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                                                <span className="text-xs">{t('save_as_new_trip')}</span>
                                            </button>
                                            <button
                                                type="button"
                                                disabled={!trips || trips.length === 0}
                                                onClick={() => {
                                                    haptic.selection()
                                                    setSaveTarget('existing')
                                                    if (!selectedTripId && trips && trips.length > 0) {
                                                        setSelectedTripId(trips[0].id)
                                                    }
                                                }}
                                                className={cn(
                                                    "p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer select-none active:scale-98 disabled:opacity-40",
                                                    saveTarget === 'existing'
                                                        ? "bg-emerald-500/10 dark:bg-emerald-400/15 border-emerald-500 dark:border-emerald-400 text-emerald-700 dark:text-emerald-300 font-bold shadow-2xs"
                                                        : "bg-stone-50 dark:bg-slate-900 border-stone-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                                )}
                                            >
                                                <FolderInput className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                                                <span className="text-xs">{t('merge_into_existing_trip')}</span>
                                            </button>
                                        </div>

                                        {saveTarget === 'existing' && trips && trips.length > 0 && (
                                            <div className="pt-1">
                                                <select
                                                    value={selectedTripId || trips[0]?.id}
                                                    onChange={e => setSelectedTripId(e.target.value)}
                                                    className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer outline-hidden focus:border-emerald-500"
                                                >
                                                    {trips.map(tr => (
                                                        <option key={tr.id} value={tr.id}>
                                                            {tr.title} ({tr.start_date} ~ {tr.end_date})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 pt-1">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                haptic.tap()
                                                setImportResult(null)
                                            }}
                                            className="h-10 px-3 text-xs rounded-xl cursor-pointer"
                                        >
                                            {t('replan_btn')}
                                        </Button>
                                        <Button
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-10 shadow-sm cursor-pointer"
                                            onClick={() => handleSaveAiOrImportTrip(importResult)}
                                            disabled={isCreating}
                                        >
                                            {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
                                            {saveTarget === 'existing' ? t('save_and_merge') : t('save_as_trip')}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <AiImportTripWizard
                                    userId={userId}
                                    onComplete={(data) => setImportResult(data)}
                                />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>

            {/* 📅 整合全站超強 12 個月連續日曆系統 */}
            <CalendarRangeSheet
                isOpen={isCalendarOpen}
                onOpenChange={setIsCalendarOpen}
                currentStartDate={startDate}
                currentEndDate={endDate}
                onConfirm={async (newStart, newEnd) => {
                    setStartDate(newStart)
                    setEndDate(newEnd)
                }}
            />
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
    const haptic = useHaptic()
    const [isOpen, setIsOpen] = useState(false)
    const [joinCode, setJoinCode] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [showPushPrompt, setShowPushPrompt] = useState(false)
    const [clipboardCode, setClipboardCode] = useState<string | null>(null)

    // 📋 自動偵測剪貼簿是否含有 4~6 位英數旅程代碼
    useEffect(() => {
        if (!isOpen) {
            setClipboardCode(null)
            return
        }

        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
            navigator.clipboard.readText().then(text => {
                const clean = (text || "").trim().toUpperCase()
                if (/^[A-Z0-9]{4,6}$/.test(clean) && clean !== joinCode) {
                    setClipboardCode(clean)
                }
            }).catch(() => {
                // 剪貼簿讀取未授權或無焦點時靜默忽略
            })
        }
    }, [isOpen, joinCode])

    // 一鍵貼上剪貼簿代碼
    const handlePasteClipboard = () => {
        if (!clipboardCode) return
        haptic.selection()
        setJoinCode(clipboardCode)
        toast.info(`${t('code_copied_from_clipboard')}: ${clipboardCode}`)
    }

    const handleJoin = async (codeToSubmit?: string) => {
        const targetCode = (codeToSubmit || joinCode).trim().toUpperCase()
        if (targetCode.length < 4 || targetCode.length > 6) {
            haptic.error()
            toast.warning(t('warning_code_length') || "請輸入 4 到 6 位數代碼")
            return
        }
        haptic.tap()
        setIsLoading(true)
        const userName = localStorage.getItem("user_nickname")
        const activeUserId = localStorage.getItem("user_uuid") || userId
        try {
            await tripsApi.join({
                share_code: targetCode,
                user_id: activeUserId,
                user_name: userName || undefined
            })
            haptic.success()
            toast.success("Joined!")
            setJoinCode("")
            setIsOpen(false)
            onSuccess()
            // 🔔 加入行程成功後，引導推播授權
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
                setTimeout(() => setShowPushPrompt(true), 800)
            }
        } catch {
            haptic.error()
            toast.error("Trip not found")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    onClick={() => {
                        haptic.selection()
                        setIsOpen(true)
                    }}
                    className="h-24 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-2xl flex flex-col gap-2 shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer active:scale-[0.98] select-none"
                >
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/20 flex items-center justify-center">
                        <Hash className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider">{t('join_code')}</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl">
                <DialogHeader className="flex flex-col items-center text-center space-y-2 pb-1">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-400/20 flex items-center justify-center text-amber-500 dark:text-amber-400 shadow-2xs">
                        <Hash className="w-6 h-6" />
                    </div>
                    <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 font-serif">
                        {t('enter_trip_code')}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-2">
                        {t('enter_code_desc')}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        handleJoin()
                    }}
                    className="space-y-4 pt-2"
                >
                    {/* 📋 剪貼簿快速填入膠囊 */}
                    {clipboardCode && (
                        <motion.button
                            type="button"
                            initial={{ opacity: 0, y: -6, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            onClick={handlePasteClipboard}
                            className="w-full py-2 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 flex items-center justify-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100/70 dark:hover:bg-amber-900/50 transition-all cursor-pointer active:scale-98"
                        >
                            <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
                            <span>{t('paste_clipboard_code')}: <strong className="font-mono tracking-wider">{clipboardCode}</strong></span>
                        </motion.button>
                    )}

                    {/* 🔠 iOS Swift 驗證碼大字號輸入框 */}
                    <div className="relative">
                        <Input
                            id="trip-join-code-input"
                            placeholder={t('join_trip_placeholder') || "輸入代碼"}
                            className="text-center text-2xl tracking-[0.35em] font-mono uppercase h-14 bg-stone-100/80 dark:bg-slate-800/90 rounded-2xl border-2 border-stone-200 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-400 focus:ring-0 transition-colors shadow-inner"
                            maxLength={6}
                            value={joinCode}
                            autoFocus
                            autoComplete="off"
                            autoCapitalize="characters"
                            onChange={(e) => {
                                const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                                setJoinCode(val)
                                if (val.length > 0) {
                                    haptic.selection()
                                }
                            }}
                        />
                    </div>

                    {/* 🚀 加入按鈕 */}
                    <Button
                        type="submit"
                        className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-900 text-white font-bold shadow-md cursor-pointer transition-all active:scale-[0.99]"
                        disabled={isLoading || joinCode.trim().length < 4}
                    >
                        {isLoading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('joining')}</>
                        ) : (
                            <><Check className="w-4 h-4 mr-2" />{t('join_trip')}</>
                        )}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
        <PushPermissionPrompt
            isOpen={showPushPrompt}
            onClose={() => setShowPushPrompt(false)}
        />
        </>
    )
}
