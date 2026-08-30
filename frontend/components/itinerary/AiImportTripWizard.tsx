"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useLanguage } from "@/lib/LanguageContext"
import { useHaptic } from "@/lib/hooks"
import { 
    FileText, 
    Image as ImageIcon, 
    Sparkles, 
    Loader2, 
    UploadCloud, 
    X, 
    CheckCircle2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { aiApi } from "@/lib/api"
import { motion, AnimatePresence } from "framer-motion"

interface AiImportTripWizardProps {
    userId: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onComplete: (parsedData: any) => void
}

// 經典範本快選
const TEMPLATE_PILLS = [
    {
        label: "🇯🇵 東京 5 日自由行",
        content: `# 東京 5 日遊行程表
## Day 1 (10/01)
- 10:30 抵達 成田機場 (搭乘 Skyliner 前往市區)
- 13:00 淺草寺 (參拜與雷門拍照)
- 15:30 晴空塔 (展望台眺望與逛街)
- 18:30 淺草今半 (壽喜燒百年名店晚餐)
- 20:30 隅田川水岸步道散步

## Day 2 (10/02)
- 09:00 築地場外市場 (生魚片丼飯早餐)
- 11:30 銀座商圈 (GINZA SIX 與文房具伊東屋)
- 15:00 皇居外苑與二重橋
- 18:00 六本木之丘 (森大樓 52F 觀景台看東京鐵塔夜景)
- 20:30 六本木 一蘭拉麵

## Day 3 (10/03)
- 09:30 明治神宮 (森林散步參拜)
- 11:30 原宿竹下通與表參道 (咖啡廳跑店)
- 15:00 澀谷 SHIBUYA SKY (夕陽展望台)
- 18:30 澀谷十字路口與居酒屋街`
    },
    {
        label: "🍵 京都 3 日古城漫遊",
        content: `# 京都古都悠閒 3 日遊
## Day 1 (11/10)
- 08:30 伏見稻荷大社 (千本鳥居晨間清幽參拜)
- 11:30 錦市場 (京都人的廚房道地美食)
- 14:00 清水寺 (清水舞台與二年坂、三年坂散策)
- 17:30 八坂神社 (祈園夜間點燈漫步)
- 19:30 鴨川納涼床晚餐

## Day 2 (11/11)
- 09:00 嵐山渡月橋與竹林小徑
- 11:30 嵐山天龍寺與野宮神社
- 14:00 金閣寺 (鹿苑寺金色倒影)
- 16:30 北野天滿宮 (祈求學業與古風散步)
- 19:00 京都車站拉麵小路`
    },
    {
        label: "🏖️ 沖繩 4 日自駕度假",
        content: `# 沖繩海灘自駕 4 日行程
## Day 1 (07/15)
- 11:00 那霸機場抵達與 OTS 取車
- 12:30 瀨長島 Umikaji Terrace (幸福鬆餅與海景午餐)
- 15:30 國際通大道 (特色伴手禮採買)
- 18:30 琉球之牛 (頂級石垣牛燒肉)

## Day 2 (07/16)
- 09:30 萬座毛 (象鼻岩海景斷崖)
- 12:00 古宇利島與古宇利大橋 (蝦蝦飯午餐)
- 14:30 美麗海水族館 (黑潮之海鯨鯊餵食秀)
- 18:00 美國村 (日落步道與異國美食)`
    }
]

export function AiImportTripWizard({ userId, onComplete }: AiImportTripWizardProps) {
    const { t } = useLanguage()
    const haptic = useHaptic()

    const [importText, setImportText] = useState("")
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [progressText, setProgressText] = useState<string | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // 📋 支援剪貼簿 Paste (文字 / 圖片)
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items
            if (!items) return

            for (let i = 0; i < items.length; i++) {
                const item = items[i]
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile()
                    if (file) {
                        handleFileSelected(file)
                        haptic.success()
                        toast.success("已從剪貼簿貼上行程圖片！")
                        break
                    }
                }
            }
        }

        window.addEventListener("paste", handlePaste)
        return () => window.removeEventListener("paste", handlePaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleFileSelected = (file: File) => {
        if (!file.type.startsWith("image/")) {
            toast.error("請上傳圖片檔案 (PNG, JPG, WEBP)")
            return
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error("圖片檔案請小於 10MB")
            return
        }

        const reader = new FileReader()
        reader.onload = (e) => {
            const b64 = e.target?.result as string
            setImagePreview(b64)
            haptic.selection()
        }
        reader.readAsDataURL(file)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelected(e.dataTransfer.files[0])
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleApplyTemplate = (content: string) => {
        haptic.selection()
        setImportText(content)
        toast.info("已填入範本，點擊下方按鈕開始解析！")
    }

    const handleStartParse = async () => {
        if (!importText.trim() && !imagePreview) {
            haptic.error()
            toast.error("請貼上文字行程或上傳行程圖片")
            return
        }

        haptic.tap()
        setIsLoading(true)
        setProgressText(imagePreview ? "Gemini 正在辨識圖片與文字內容..." : t('ai_importing_step'))
        const activeUserId = localStorage.getItem("user_uuid") || userId

        try {
            const data = await aiApi.parseMarkdown({
                markdown_text: importText.trim(),
                user_id: activeUserId,
                image_base64: imagePreview || undefined
            })

            setProgressText(t('ai_geocoding_step'))

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parsedData = (data as any).data || data
            if (!parsedData.items || parsedData.items.length === 0) {
                toast.error("未能從內容中辨識出有效景點，請確認內容格式或清晰度")
                return
            }

            haptic.success()
            toast.success(t('tv_ai_parsed', { count: String(parsedData.items?.length || 0) }))
            onComplete(parsedData)
        } catch (error) {
            haptic.error()
            const msg = error instanceof Error ? error.message : "解析失敗"
            toast.error(`解析失敗: ${msg}`)
        } finally {
            setIsLoading(false)
            setProgressText(null)
        }
    }

    return (
        <div ref={containerRef} className="space-y-3.5 py-1 select-none">
            {/* 💡 經典範本快選膠囊 */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>範本快選體驗</span>
                    </span>
                    <span className="text-[11px] text-slate-400">點擊一鍵帶入</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {TEMPLATE_PILLS.map((tmpl, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => handleApplyTemplate(tmpl.content)}
                            className="px-2.5 py-1 text-xs rounded-full border border-stone-200/80 dark:border-slate-700 bg-stone-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-700 transition-all cursor-pointer active:scale-95"
                        >
                            {tmpl.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 🖼️ 圖片/截圖拖曳上傳與貼上區域 */}
            <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                        行程截圖 / 旅行社DM / LINE 對話 (選填)
                    </span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-normal">
                        支援 Ctrl+V 貼上截圖
                    </span>
                </Label>

                {imagePreview ? (
                    <div className="relative rounded-2xl border border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-2.5 flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                            src={imagePreview} 
                            alt="Preview" 
                            className="w-16 h-16 object-cover rounded-xl border border-emerald-200 dark:border-emerald-800 shrink-0" 
                        />
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                截圖已就緒
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                將使用多模態視覺模型深度識別景點
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                haptic.tap()
                                setImagePreview(null)
                            }}
                            className="w-7 h-7 rounded-full bg-stone-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-red-100 hover:text-red-600 cursor-pointer transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ) : (
                    <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                            "p-3 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex items-center justify-center gap-3 text-center",
                            isDragging
                                ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 scale-[0.99]"
                                : "border-stone-200 dark:border-slate-700 bg-stone-100/60 dark:bg-slate-800/60 hover:bg-stone-200/50"
                        )}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={e => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
                            className="hidden"
                        />
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-400/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <UploadCloud className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                            <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                點擊或拖曳行程截圖至此
                            </div>
                            <div className="text-[10px] text-slate-400">
                                支援小紅書、旅行社DM、LINE 行程圖片
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 📝 文字與 Markdown 輸入區 */}
            <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-500" />
                    {t('ai_import_label')}
                </Label>
                <Textarea
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    placeholder={t('ai_import_placeholder')}
                    rows={4}
                    className="resize-none font-mono text-xs rounded-xl bg-stone-100 dark:bg-slate-800"
                />
            </div>

            {/* 🔄 解析中進度狀態 */}
            <AnimatePresence>
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex flex-col items-center justify-center text-center gap-2"
                    >
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 dark:bg-emerald-400/20 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-spin" />
                        </div>
                        <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                            {progressText || t('ai_importing_step')}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 🚀 啟動解析按鈕 */}
            {!isLoading && (
                <Button
                    type="button"
                    onClick={handleStartParse}
                    disabled={!importText.trim() && !imagePreview}
                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md cursor-pointer transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                >
                    <Sparkles className="w-4 h-4" />
                    <span>{t('ai_import_btn')}</span>
                </Button>
            )}
        </div>
    )
}
