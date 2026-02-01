"use client"

import { useState, useEffect, memo } from "react"
import {
    MapPin, Utensils, Train, ShoppingBag, Bed, Camera,
    StickyNote, MoreHorizontal, Edit, Trash2, ExternalLink, Lightbulb, X, Info, Plus
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Image from "next/image"
import { ZoomableImage } from "@/components/ui/zoomable-image"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RichTextarea } from "@/components/ui/rich-textarea"
import { RichDisplay } from "@/components/ui/rich-display"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Table, TableBody, TableCell, TableRow,
} from "@/components/ui/table"

import { Activity, SubItem } from "@/lib/itinerary-types"
import { toast } from "sonner"
import { useLanguage } from "@/lib/LanguageContext"

interface TimelineCardProps {
    activity: Activity
    isLast?: boolean
    index: number
    onEdit: (item: Activity) => void
    onDelete: (id: string) => void
    onUpdateActivity: (id: string, updates: Partial<Activity>) => Promise<boolean> // 整合更新
}

export const TimelineCard = memo(function TimelineCard({ activity, isLast, index, onEdit, onDelete, onUpdateActivity }: TimelineCardProps) {
    const { t } = useLanguage()
    const [showDetail, setShowDetail] = useState(false)
    const [showPhotoPreview, setShowPhotoPreview] = useState(false)  // 🆕 圖片預覽狀態

    if (!activity) return null;

    // 判斷是否為 Header 卡片
    const isHeader = activity.category === 'header' || (activity.time || activity.time_slot || "00:00") === '00:00'

    // 🔧 FIX: 導航按鈕邏輯 - sub_items 和導航應並存，不互斥
    // 只有在以下情況才隱藏導航按鈕：
    // 1. 地點名稱包含非實體地點關鍵字
    // 2. 是交通類別但沒有連結也沒有座標
    // 3. 是 Header 卡片
    // 🆕 移除：有 sub_items 就隱藏（這是錯誤的互斥邏輯）
    const hideMapBtn =
        activity.hide_navigation ||
        ["家中", "家裡", "機上", "飛機上", "等待登機"].some(k => (activity.place || "").includes(k)) ||
        (activity.category === 'transport' && !activity.link_url && !activity.lat) ||
        isHeader;

    const openGoogleMap = (e: React.MouseEvent) => {
        e.stopPropagation()
        const url = activity.link_url?.startsWith('http')
            ? activity.link_url
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.link_url || activity.place || "")}`;
        window.open(url, '_blank')
    }

    const getIcon = () => {
        if (isHeader) return <Lightbulb className="w-3.5 h-3.5" />
        const cat = activity.category ? activity.category.toLowerCase().trim() : "sightseeing"
        const title = (activity.place || "").toLowerCase()
        if (cat === "food" || title.includes("餐廳")) return <Utensils className="w-3.5 h-3.5" />
        if (cat === "transport" || title.includes("車站") || title.includes("機場")) return <Train className="w-3.5 h-3.5" />
        if (cat === "shopping" || title.includes("百貨") || title.includes("超市")) return <ShoppingBag className="w-3.5 h-3.5" />
        if (cat === "hotel" || title.includes("飯店") || title.includes("民宿")) return <Bed className="w-3.5 h-3.5" />
        return <Camera className="w-3.5 h-3.5" />
    }

    const renderContent = () => {
        // 🆕 支援多圖片：優先使用 image_urls，fallback 到 image_url
        // 🆕 Image Hunter: 若無上傳圖片，fallback 到 preview_metadata 的 OG/Map 圖片
        const uploadedImages = activity.image_urls?.length
            ? activity.image_urls
            : (activity.image_url ? [activity.image_url] : [])

        const previewImage = activity.preview_metadata?.map_image
            || activity.preview_metadata?.og_image

        const images = uploadedImages.length > 0
            ? uploadedImages
            : (previewImage ? [previewImage] : [])

        return (
            <>
                {/* Spot Photo - 可點擊預覽 */}
                {images.length > 0 && (
                    <div
                        className="mb-3 rounded-lg overflow-hidden w-full relative cursor-pointer hover:opacity-95 transition-opacity bg-slate-100/50 flex items-center justify-center border border-slate-200/10"
                        style={{ height: 'auto', minHeight: '160px', maxHeight: '400px' }}
                        onClick={() => setShowPhotoPreview(true)}
                    >
                        {/* 🆕 底部模糊層：增加質感並填充空白 */}
                        <div className="absolute inset-0 opacity-30 blur-2xl scale-110">
                            <Image
                                src={images[0]}
                                alt=""
                                fill
                                className="object-cover"
                                unoptimized
                            />
                        </div>

                        {/* 🆕 主圖片層：不裁切 (Contain) */}
                        <div className="relative w-full h-48 sm:h-64 flex justify-center">
                            <Image
                                src={images[0]}
                                alt={activity.place || "Activity"}
                                fill
                                className="object-contain z-10 drop-shadow-md"
                                unoptimized
                                decoding="async"
                                onError={(e) => { e.currentTarget.style.display = 'none' }}
                            />
                        </div>

                        {/* 🆕 多圖片指示器：升級樣式 */}
                        {images.length > 1 && (
                            <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg ring-1 ring-white/20 z-20">
                                <Camera className="w-3 h-3" />
                                <span>1 / {images.length}</span>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-between items-start mb-1 pr-6">
                    <h3 className={cn("font-bold text-slate-900 dark:text-white leading-tight", isHeader ? "text-xl" : "text-lg")}>
                        {activity.place || "Unknown Place"}
                    </h3>
                </div>

                {/* 編輯選單 - Mobile Friendly */}
                <div className="absolute top-3 right-2 z-20" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full touch-manipulation"
                            >
                                <MoreHorizontal className="w-5 h-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[140px]">
                            <DropdownMenuItem onClick={() => onEdit(activity)} className="py-3">
                                <Edit className="w-4 h-4 mr-2" /> 編輯全部
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600 py-3" onClick={() => onDelete(activity.id || '')}>
                                <Trash2 className="w-4 h-4 mr-2" /> 刪除
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={cn("text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border flex items-center gap-1",
                        isHeader ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-700 font-bold" :
                            (activity.category === 'transport' ? "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600" : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600")
                    )}>
                        {getIcon()} {isHeader ? "INFO" : activity.category}
                    </span>
                    {activity.is_private && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100 flex items-center gap-1 font-bold">
                            🔒 {t('private') || "Private"}
                        </span>
                    )}
                    {activity.tags?.map((tag: string) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100">#{tag}</span>
                    ))}
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 leading-relaxed font-light whitespace-pre-wrap line-clamp-3">
                    {activity.desc || "點擊新增備忘錄..."}
                </p>

                {/* 附屬表格 */}
                {activity.sub_items && activity.sub_items.length > 0 && (
                    <div className="mt-3 mb-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm bg-slate-50/50 dark:bg-slate-800/50">
                        <Table className="w-full table-fixed min-w-[280px]">
                            <TableBody>
                                {activity.sub_items.map((item: SubItem, i: number) => (
                                    <TableRow key={i} className="border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-white dark:hover:bg-slate-700 transition-colors">
                                        <TableCell className="py-2.5 px-3 align-top w-[calc(100%-44px)]">
                                            <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-0.5 break-words">{item.name}</div>
                                            {item.desc && <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight break-words whitespace-normal">{item.desc}</div>}
                                        </TableCell>
                                        {item.link ? (
                                            <TableCell className="py-2 px-2 text-right align-middle w-11 shrink-0">
                                                <button
                                                    className="p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                    onClick={(e) => { e.stopPropagation(); window.open(item.link, '_blank'); }}
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                </button>
                                            </TableCell>
                                        ) : <TableCell className="w-0 p-0" />}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {/* 按鈕區 */}
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    {!hideMapBtn && (
                        <Button variant="outline" size="sm" className="h-11 min-w-[44px] text-xs bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300" onClick={openGoogleMap}>
                            <MapPin className="w-3 h-3 mr-1" /> 導航
                        </Button>
                    )}

                    {/* 👇 改成此地備忘錄 */}
                    <Button variant="ghost" size="sm" className="h-11 min-w-[44px] text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700" onClick={(e) => { e.stopPropagation(); setShowDetail(true) }}>
                        <StickyNote className="w-3 h-3 mr-1" /> 此地備忘錄
                    </Button>
                </div>
            </>
        )
    }

    return (
        <div className="flex gap-3 relative group">
            {/* 左側：時間 + 序號 */}
            <div className="flex flex-col items-center w-12 shrink-0">
                {!isHeader && <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">{activity.time || activity.time_slot || "00:00"}</span>}
                {isHeader ? (
                    <div className="w-6 h-6 rounded-full mt-1 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm z-10">
                        <Lightbulb className="w-3 h-3" strokeWidth={3} />
                    </div>
                ) : (
                    <div className="w-5 h-5 rounded-full mt-1 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800 flex items-center justify-center text-[9px] font-bold z-10 border-2 border-white dark:border-slate-900 shadow-sm">{index}</div>
                )}
                {!isLast && <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 my-1" />}
            </div>
            {/* 右側：卡片內容 */}
            <div className={cn("timeline-card flex-1 min-w-0 mb-6 relative p-4 rounded-xl border cursor-default overflow-hidden transition-all duration-300",
                isHeader ? "bg-amber-50/30 dark:bg-amber-900/20 border-amber-200/50 dark:border-amber-700/50" :
                    "bg-white dark:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-600 shadow-sm dark:shadow-none"
            )}>
                {renderContent()}
            </div>

            {/* 傳遞 hideMapBtn 給彈窗 */}
            <DetailDialog
                open={showDetail}
                onOpenChange={setShowDetail}
                activity={activity}
                onMap={openGoogleMap}
                hideMapBtn={hideMapBtn}
                onUpdateActivity={onUpdateActivity}
            />

            {/* 🆕 全螢幕圖片預覽 (支援多圖片) */}
            <Dialog open={showPhotoPreview} onOpenChange={setShowPhotoPreview}>
                <DialogContent className="max-w-[95vw] max-h-[90vh] p-0 bg-black/95 border-0 flex items-center justify-center">
                    <DialogHeader className="sr-only">
                        <DialogTitle>圖片預覽</DialogTitle>
                        <DialogDescription>
                            全螢幕預覽活動圖片
                        </DialogDescription>
                    </DialogHeader>
                    <PhotoGalleryPreview
                        activity={activity}
                        onClose={() => setShowPhotoPreview(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
})

// --- 升級版彈窗 (可編輯備忘錄) ---
interface DetailDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    activity: Activity
    onMap: (e: React.MouseEvent) => void
    hideMapBtn: boolean
    onUpdateActivity: (id: string, updates: Partial<Activity>) => Promise<boolean>
}

function DetailDialog({ open, onOpenChange, activity, onMap, hideMapBtn, onUpdateActivity }: DetailDialogProps) {
    const { t } = useLanguage()
    // Use activity.id + open as key to reset state when activity changes
    const [isEditing, setIsEditing] = useState(false)
    const [note, setNote] = useState(activity.memo || "")
    const [mediaLink, setMediaLink] = useState(activity.website_link || "")
    // 👇 新增：連結列表狀態
    const [links, setLinks] = useState<SubItem[]>(activity.sub_items || [])
    const [saving, setSaving] = useState(false)
    // 🔧 FIX: Use proper useEffect for state sync (was causing render-during-render)
    useEffect(() => {
        // Reset state when dialog opens or activity changes
        if (open) {
            setNote(activity.memo || "")
            setMediaLink(activity.website_link || "")
            setLinks(activity.sub_items || [])
            setIsEditing(false)
        }
    }, [open, activity.id, activity.memo, activity.sub_items, activity.website_link])

    const handleSave = async () => {
        if (saving) return // 防止重複點擊
        setSaving(true)
        try {
            // 🆕 優化：在儲存前過濾完全空白的連結
            const filteredLinks = links.filter(l => l.name?.trim() || l.link?.trim())

            // 🆕 關鍵修復：整合為單一 API 呼叫，徹底解決並發 500 錯誤與 UI 不同步
            const success = await onUpdateActivity(activity.id || '', {
                memo: note,
                website_link: mediaLink,
                sub_items: filteredLinks
            })

            if (success) {
                toast.success("已儲存")
                setIsEditing(false)
            }
        } finally {
            setSaving(false)
        }
    }

    // 連結操作
    const addLink = () => setLinks([...links, { name: "", desc: "", link: "" }])
    const removeLink = (idx: number) => setLinks(links.filter((_, i) => i !== idx))
    const updateLink = (idx: number, field: keyof SubItem, val: string) => {
        setLinks(prev => prev.map((link, i) =>
            i === idx ? { ...link, [field]: val } : link
        ))
    }

    // 🆕 核心解析邏輯 (神經網絡連動)
    const handleResolveLink = async (type: "map" | "media") => {
        const url = type === "map" ? activity.link_url : mediaLink
        if (!url) return

        setSaving(true)
        try {
            const res = await fetch("/api/geocode/resolve-link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, type })
            })
            const data = await res.json()

            if (data.success) {
                if (type === "map" && data.lat) {
                    await onUpdateActivity(activity.id || '', {
                        lat: data.lat,
                        lng: data.lng,
                        preview_metadata: { ...activity.preview_metadata, map_image: data.metadata?.image }
                    })
                    toast.success("座標與地圖預覽已更新")
                } else if (type === "media") {
                    // 解析首圖並存入 metadata
                    const meta = data.metadata || {}
                    await onUpdateActivity(activity.id || '', {
                        website_link: url,
                        preview_metadata: { ...activity.preview_metadata, og_image: meta.image, og_title: meta.title }
                    })

                    // 🔄 如果抓到首圖，自動詢問是否加入藝廊 (或是直接展示)
                    toast.success("首圖解析成功！")
                }
            } else {
                toast.error("無法解析網址：" + (data.error || "未知錯誤"))
            }
        } catch (error) {
            toast.error("解析發生錯誤")
            console.error(error)
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-stone-50 dark:bg-slate-900 gap-0">
                <div className="p-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-serif font-bold text-slate-900 dark:text-white">{activity.place || "Details"}</DialogTitle>
                        <DialogDescription className="sr-only">
                            活動詳細資訊與個人備忘錄
                        </DialogDescription>
                    </DialogHeader>
                </div>
                <ScrollArea className="max-h-[60vh]">
                    <div className="p-6 space-y-6">

                        {/* 1. 攻略/簡介 (唯讀) */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <Info className="w-3 h-3" /> Info & Guide
                                </h4>
                                <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm whitespace-pre-wrap">
                                    {activity.desc || "暫無簡介。"}
                                </div>
                            </div>

                            {/* 🆕 新增：主要地址與 Meta 資訊 */}
                            <div className="grid grid-cols-2 gap-3">
                                {activity.link_url && (
                                    <div className="col-span-2 p-3 bg-amber-50/30 dark:bg-amber-900/10 rounded-xl border border-amber-100/50 dark:border-amber-800/50">
                                        <div className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-bold mb-1 tracking-wider">📍 導航 / 地點連結</div>
                                        <div className="text-xs text-slate-600 dark:text-slate-300 break-all font-mono mb-2">{activity.link_url}</div>
                                        {activity.website_link && (
                                            <>
                                                <div className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold mb-1 tracking-wider border-t border-amber-100/50 pt-2">🔗 官網 / 媒體連結</div>
                                                <div className="text-xs text-slate-600 dark:text-slate-300 break-all font-mono">{activity.website_link}</div>
                                            </>
                                        )}
                                    </div>
                                )}
                                {activity.reservation_code && (
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <div className="text-[10px] text-slate-400 uppercase font-bold mb-1 tracking-wider">預約代碼</div>
                                        <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{activity.reservation_code}</div>
                                    </div>
                                )}
                                {activity.cost !== undefined && activity.cost !== null && (
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <div className="text-[10px] text-slate-400 uppercase font-bold mb-1 tracking-wider">預估花費</div>
                                        <div className="text-xs font-bold text-slate-700 dark:text-slate-200">¥{formatCurrency(activity.cost)}</div>
                                    </div>
                                )}
                            </div>

                            {/* 🆕 解析按鈕 UI 組件 (用於編輯模式) */}
                            {isEditing && (
                                <div className="space-y-4 pt-2">
                                    <div className="space-y-2 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800">
                                        <Label className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold">🔗 {t('media_link')}</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                className="h-9 text-xs flex-1"
                                                placeholder={t('media_link_placeholder')}
                                                value={mediaLink}
                                                onChange={e => setMediaLink(e.target.value)}
                                            />
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-9 text-[10px] bg-blue-600 text-white hover:bg-blue-700 hover:text-white border-0"
                                                onClick={() => handleResolveLink("media")}
                                                disabled={saving || !mediaLink}
                                            >
                                                {saving ? "..." : "解析美照"}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-2 p-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800">
                                        <Label className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-bold">📍 導航 / 地點連結 (Google Maps)</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                className="h-9 text-xs flex-1"
                                                placeholder="https://maps.app.goo.gl/..."
                                                value={activity.link_url || ""}
                                                readOnly
                                            />
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-9 text-[10px] bg-amber-500 text-white hover:bg-amber-600 hover:text-white border-0"
                                                onClick={() => handleResolveLink("map")}
                                                disabled={saving || !activity.link_url}
                                            >
                                                {saving ? "..." : "解析坐標"}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 2. Memo & Links (合併編輯區) */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <h4 className="text-xs font-bold text-amber-500 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2">
                                    <StickyNote className="w-3 h-3" /> Memo & Links
                                </h4>
                                {!isEditing && (
                                    <button onClick={() => setIsEditing(true)} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                                        <Edit className="w-3 h-3" /> 編輯
                                    </button>
                                )}
                            </div>

                            {isEditing ? (
                                <div className="space-y-4 bg-white dark:bg-slate-800 p-3 rounded-xl border border-amber-200 dark:border-amber-700">
                                    {/* Memo 編輯 - 使用 RichTextarea */}
                                    <RichTextarea
                                        value={note}
                                        onChange={setNote}
                                        placeholder="輸入私人備忘..."
                                        className="bg-yellow-50/30"
                                        minHeight="80px"
                                    />

                                    {/* 連結編輯 */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-slate-400 uppercase">相關連結 / 預約資訊</Label>
                                        {links.map((link, i) => (
                                            <div key={i} className="space-y-1 p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-700 relative">
                                                <button onClick={() => removeLink(i)} className="absolute top-1 right-1 text-slate-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                                                <Input className="h-7 text-xs" placeholder="標題 (e.g. 訂位連結)" value={link.name || ""} onChange={e => updateLink(i, 'name', e.target.value)} />
                                                <Input className="h-7 text-xs" placeholder="註解 (e.g. 記得先付訂金)" value={link.desc || ""} onChange={e => updateLink(i, 'desc', e.target.value)} />
                                                <Input className="h-7 text-xs font-mono text-blue-600" placeholder="https://..." value={link.link || ""} onChange={e => updateLink(i, 'link', e.target.value)} />
                                            </div>
                                        ))}
                                        <Button size="sm" variant="outline" onClick={addLink} className="w-full h-7 text-xs">+ 新增連結</Button>
                                    </div>

                                    <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-700">
                                        <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={saving}>取消</Button>
                                        <Button size="sm" onClick={handleSave} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-white">
                                            {saving ? "儲存中..." : "儲存變更"}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                // 唯讀顯示模式
                                <div className="space-y-3">
                                    {/* Memo 顯示 - 使用 RichDisplay */}
                                    <div
                                        className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-yellow-50/50 dark:bg-amber-900/20 p-4 rounded-xl border border-dashed border-amber-200 dark:border-amber-700 cursor-text hover:bg-yellow-50 dark:hover:bg-amber-900/30 transition-colors"
                                        onClick={() => setIsEditing(true)}
                                    >
                                        {note ? <RichDisplay text={note} /> : <span className="text-slate-400 italic flex items-center gap-2"><Plus className="w-3 h-3" /> 新增備忘...</span>}
                                    </div>

                                    {/* Links 顯示 (如果有) */}
                                    {links.length > 0 && (
                                        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
                                            <Table>
                                                <TableBody>
                                                    {links.map((item: SubItem, i: number) => (
                                                        <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                                                            <TableCell className="py-2 px-3 align-top">
                                                                <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{item.name}</div>
                                                                {item.desc && <div className="text-[10px] text-slate-500 dark:text-slate-400">{item.desc}</div>}
                                                            </TableCell>
                                                            <TableCell className="py-2 px-2 text-right align-middle w-10">
                                                                {item.link && (
                                                                    <button
                                                                        className="p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100"
                                                                        onClick={(e) => { e.stopPropagation(); window.open(item.link, '_blank'); }}
                                                                    >
                                                                        <ExternalLink className="w-3 h-3" />
                                                                    </button>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>

                {/* 底部按鈕 */}
                <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-3">
                    {!hideMapBtn && (
                        <Button variant="outline" className="flex-1 dark:border-slate-600 dark:text-slate-300" onClick={onMap}>
                            <MapPin className="w-4 h-4 mr-2" /> Google Maps
                        </Button>
                    )}
                    <Button className={cn("flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100", hideMapBtn ? "w-full" : "")} onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// --- 🆕 多圖片藝廊預覽元件 ---
interface PhotoGalleryPreviewProps {
    activity: Activity
    onClose: () => void
}

function PhotoGalleryPreview({ activity, onClose }: PhotoGalleryPreviewProps) {
    // 🆕 Image Hunter: 與 renderContent() 保持一致的圖片來源邏輯
    const uploadedImages = activity.image_urls?.length
        ? activity.image_urls
        : (activity.image_url ? [activity.image_url] : [])

    const previewImage = activity.preview_metadata?.map_image
        || activity.preview_metadata?.og_image

    const images = uploadedImages.length > 0
        ? uploadedImages
        : (previewImage ? [previewImage] : [])

    const [currentIndex, setCurrentIndex] = useState(0)

    if (images.length === 0) return null

    return (
        <div className="relative w-full h-[80vh] flex flex-col justify-center">
            <ZoomableImage
                src={images[currentIndex]}
                alt={activity.place || "Preview"}
                onClose={onClose}
            />

            {/* 🆕 圖片導航指示器 (Dots) */}
            {images.length > 1 && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-50">
                    {images.map((_, i) => (
                        <button
                            key={i}
                            onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }}
                            className={cn(
                                "w-2 h-2 rounded-full transition-all duration-300",
                                i === currentIndex
                                    ? "bg-white scale-125 shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                                    : "bg-white/30 hover:bg-white/50"
                            )}
                        />
                    ))}
                </div>
            )}

            {/* 🆕 左右切換按鈕 (中心側邊) */}
            {images.length > 1 && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); setCurrentIndex((prev) => (prev - 1 + images.length) % images.length); }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-sm transition-all z-50"
                    >
                        <span className="text-xl">←</span>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setCurrentIndex((prev) => (prev + 1) % images.length); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-sm transition-all z-50"
                    >
                        <span className="text-xl">→</span>
                    </button>
                </>
            )}

            {/* 🆕 頁碼顯示 */}
            {images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm z-50">
                    {currentIndex + 1} / {images.length}
                </div>
            )}
        </div>
    )
}
