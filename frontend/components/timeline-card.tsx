"use client"

import { useState, useEffect } from "react"
import {
    MapPin, Utensils, Train, ShoppingBag, Bed, Camera,
    StickyNote, MoreHorizontal, Edit, Trash2, ExternalLink, Lightbulb, X, Info, Plus
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Table, TableBody, TableCell, TableRow,
} from "@/components/ui/table"

import { Activity, SubItem } from "@/lib/itinerary-types"
import { toast } from "sonner"

interface TimelineCardProps {
    activity: Activity
    isLast?: boolean
    index: number
    onEdit: (item: Activity) => void
    onDelete: (id: string) => void
    onUpdateMemo: (id: string, memo: string) => Promise<boolean>
    onUpdateSubItems: (id: string, items: SubItem[]) => Promise<boolean> // 新增：更新連結列表
}

export function TimelineCard({ activity, isLast, index, onEdit, onDelete, onUpdateMemo, onUpdateSubItems }: TimelineCardProps) {
    const [showDetail, setShowDetail] = useState(false)

    // 判斷是否為 Header 卡片
    const isHeader = activity.category === 'header' || (activity.time || activity.time_slot || "00:00") === '00:00'

    // 🔧 FIX: 導航按鈕邏輯 - sub_items 和導航應並存，不互斥
    // 只有在以下情況才隱藏導航按鈕：
    // 1. 地點名稱包含非實體地點關鍵字
    // 2. 是交通類別但沒有連結也沒有座標
    // 3. 是 Header 卡片
    // 🆕 移除：有 sub_items 就隱藏（這是錯誤的互斥邏輯）
    const hideMapBtn =
        ["家中", "家裡", "機上", "飛機上", "等待登機"].some(k => (activity.place || "").includes(k)) ||
        (activity.category === 'transport' && !activity.link_url && !activity.lat) ||
        isHeader;

    const openGoogleMap = (e: React.MouseEvent) => {
        e.stopPropagation()
        let url = ""
        if (activity.link_url) {
            url = activity.link_url
        } else if (activity.lat && activity.lng && activity.place) {
            // 使用經緯度定位 + 商家名稱搜尋（最精準）
            url = `https://www.google.com/maps/search/${encodeURIComponent(activity.place)}/@${activity.lat},${activity.lng},17z`
        } else if (activity.lat && activity.lng) {
            // 只有經緯度
            url = `https://www.google.com/maps/search/?api=1&query=${activity.lat},${activity.lng}`
        } else {
            // 只有名稱
            url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.place || "")}`
        }
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

    const renderContent = () => (
        <>
            {/* Spot Photo */}
            {activity.image_url && (
                <div className="mb-3 rounded-lg overflow-hidden h-32 w-full relative">
                    <Image
                        src={activity.image_url}
                        alt={activity.place || "Activity"}
                        fill
                        className="object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                </div>
            )}

            <div className="flex justify-between items-start mb-1 pr-6">
                <h3 className={cn("font-bold text-slate-900 leading-tight", isHeader ? "text-xl" : "text-lg")}>
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
                    isHeader ? "bg-amber-100 text-amber-600 border-amber-200 font-bold" :
                        (activity.category === 'transport' ? "bg-slate-100 text-slate-500 border-slate-200" : "bg-white text-slate-500 border-slate-200")
                )}>
                    {getIcon()} {isHeader ? "INFO" : activity.category}
                </span>
                {activity.tags?.map((tag: string) => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100">#{tag}</span>
                ))}
            </div>

            <p className="text-sm text-slate-600 mb-3 leading-relaxed font-light whitespace-pre-wrap line-clamp-3">
                {activity.desc || "點擊新增備忘錄..."}
            </p>

            {/* 附屬表格 */}
            {activity.sub_items && activity.sub_items.length > 0 && (
                <div className="mt-3 mb-2 overflow-x-auto rounded-lg border border-slate-200 shadow-sm bg-slate-50/50">
                    <Table className="w-full table-fixed min-w-[280px]">
                        <TableBody>
                            {activity.sub_items.map((item: SubItem, i: number) => (
                                <TableRow key={i} className="border-b border-slate-100 last:border-0 hover:bg-white transition-colors">
                                    <TableCell className="py-2.5 px-3 align-top w-[calc(100%-44px)]">
                                        <div className="text-xs font-bold text-slate-700 mb-0.5 break-words">{item.name}</div>
                                        {item.desc && <div className="text-[10px] text-slate-500 leading-tight break-words whitespace-normal">{item.desc}</div>}
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
                    <Button variant="outline" size="sm" className="h-8 text-xs bg-white hover:bg-slate-50 border-slate-200 text-slate-600" onClick={openGoogleMap}>
                        <MapPin className="w-3 h-3 mr-1" /> 導航
                    </Button>
                )}

                {/* 👇 改成此地備忘錄 */}
                <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100" onClick={(e) => { e.stopPropagation(); setShowDetail(true) }}>
                    <StickyNote className="w-3 h-3 mr-1" /> 此地備忘錄
                </Button>
            </div>
        </>
    )

    return (
        <div className="flex gap-3 relative group">
            {/* 左側：時間 + 序號 */}
            <div className="flex flex-col items-center w-12 shrink-0">
                {!isHeader && <span className="text-xs font-mono font-bold text-slate-500">{activity.time || activity.time_slot || "00:00"}</span>}
                {isHeader ? (
                    <div className="w-6 h-6 rounded-full mt-1 bg-amber-100 text-amber-600 flex items-center justify-center border-2 border-white shadow-sm z-10">
                        <Lightbulb className="w-3 h-3" strokeWidth={3} />
                    </div>
                ) : activity.is_highlight ? (
                    <div className="w-5 h-5 rounded-full mt-1 bg-amber-500 ring-4 ring-amber-100 z-10 flex items-center justify-center text-[9px] text-white font-bold">{index}</div>
                ) : (
                    <div className="w-5 h-5 rounded-full mt-1 bg-slate-800 text-white flex items-center justify-center text-[9px] font-bold z-10 border-2 border-white shadow-sm">{index}</div>
                )}
                {!isLast && <div className="w-px flex-1 bg-slate-200 my-1" />}
            </div>
            {/* 右側：卡片內容 */}
            <div className={cn("timeline-card flex-1 min-w-0 mb-6 relative p-4 rounded-xl border cursor-default overflow-hidden",
                isHeader ? "bg-amber-50/30 border-amber-200/50" :
                    activity.is_highlight ? "bg-amber-50/50 border-amber-200" : "bg-white border-transparent hover:border-slate-200 shadow-sm"
            )}>
                {activity.is_highlight && <div className="absolute top-0 left-0 w-1 h-full bg-amber-400 rounded-l-xl" />}
                {renderContent()}
            </div>

            {/* 傳遞 hideMapBtn 給彈窗 */}
            <DetailDialog
                open={showDetail}
                onOpenChange={setShowDetail}
                activity={activity}
                onMap={openGoogleMap}
                hideMapBtn={hideMapBtn}
                onUpdateMemo={onUpdateMemo}
                onUpdateSubItems={onUpdateSubItems}
            />
        </div>
    )
}

// --- 升級版彈窗 (可編輯備忘錄) ---
interface DetailDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    activity: Activity
    onMap: (e: React.MouseEvent) => void
    hideMapBtn: boolean
    onUpdateMemo: (id: string, memo: string) => Promise<boolean>
    onUpdateSubItems: (id: string, items: SubItem[]) => Promise<boolean> // 新增
}

function DetailDialog({ open, onOpenChange, activity, onMap, hideMapBtn, onUpdateMemo, onUpdateSubItems }: DetailDialogProps) {
    // Use activity.id + open as key to reset state when activity changes
    const [isEditing, setIsEditing] = useState(false)
    const [note, setNote] = useState(activity.memo || "")
    // 👇 新增：連結列表狀態
    const [links, setLinks] = useState<SubItem[]>(activity.sub_items || [])
    const [saving, setSaving] = useState(false)
    // 🔧 FIX: Use proper useEffect for state sync (was causing render-during-render)
    useEffect(() => {
        // Reset state when dialog opens or activity changes
        if (open) {
            setNote(activity.memo || "")
            setLinks(activity.sub_items || [])
            setIsEditing(false)
        }
    }, [open, activity.id, activity.memo, activity.sub_items])

    const handleSave = async () => {
        if (saving) return // 防止重複點擊
        setSaving(true)
        try {
            // 同時更新 memo 和 sub_items
            const [memoSuccess, linksSuccess] = await Promise.all([
                onUpdateMemo(activity.id || '', note),
                onUpdateSubItems(activity.id || '', links)
            ])
            if (memoSuccess && linksSuccess) {
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
        const newLinks = [...links]; newLinks[idx][field] = val; setLinks(newLinks)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-stone-50 gap-0">
                <div className="p-6 bg-white border-b border-slate-100">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-serif font-bold text-slate-900">{activity.place || "Details"}</DialogTitle>
                    </DialogHeader>
                </div>
                <ScrollArea className="max-h-[60vh]">
                    <div className="p-6 space-y-6">

                        {/* 1. 攻略/簡介 (唯讀) */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Info className="w-3 h-3" /> Info & Guide
                            </h4>
                            <div className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm whitespace-pre-wrap">
                                {activity.desc || "暫無簡介。"}
                            </div>
                        </div>

                        {/* 2. Memo & Links (合併編輯區) */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
                                    <StickyNote className="w-3 h-3" /> Memo & Links
                                </h4>
                                {!isEditing && (
                                    <button onClick={() => setIsEditing(true)} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                                        <Edit className="w-3 h-3" /> 編輯
                                    </button>
                                )}
                            </div>

                            {isEditing ? (
                                <div className="space-y-4 bg-white p-3 rounded-xl border border-amber-200">
                                    {/* Memo 編輯 */}
                                    <Textarea
                                        value={note} onChange={(e) => setNote(e.target.value)}
                                        className="min-h-[80px] bg-yellow-50/30 text-sm" placeholder="輸入私人備忘..."
                                    />

                                    {/* 連結編輯 */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-slate-400 uppercase">相關連結 / 預約資訊</Label>
                                        {links.map((link, i) => (
                                            <div key={i} className="space-y-1 p-2 bg-slate-50 rounded border border-slate-100 relative">
                                                <button onClick={() => removeLink(i)} className="absolute top-1 right-1 text-slate-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                                                <Input className="h-7 text-xs" placeholder="標題 (e.g. 訂位連結)" value={link.name} onChange={e => updateLink(i, 'name', e.target.value)} />
                                                <Input className="h-7 text-xs" placeholder="註解 (e.g. 記得先付訂金)" value={link.desc} onChange={e => updateLink(i, 'desc', e.target.value)} />
                                                <Input className="h-7 text-xs font-mono text-blue-600" placeholder="https://..." value={link.link} onChange={e => updateLink(i, 'link', e.target.value)} />
                                            </div>
                                        ))}
                                        <Button size="sm" variant="outline" onClick={addLink} className="w-full h-7 text-xs">+ 新增連結</Button>
                                    </div>

                                    <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                                        <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={saving}>取消</Button>
                                        <Button size="sm" onClick={handleSave} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-white">
                                            {saving ? "儲存中..." : "儲存變更"}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                // 唯讀顯示模式
                                <div className="space-y-3">
                                    {/* Memo 顯示 */}
                                    <div
                                        className="text-sm text-slate-600 leading-relaxed bg-yellow-50/50 p-4 rounded-xl border border-dashed border-amber-200 cursor-text hover:bg-yellow-50 transition-colors whitespace-pre-wrap"
                                        onClick={() => setIsEditing(true)}
                                    >
                                        {note || <span className="text-slate-400 italic flex items-center gap-2"><Plus className="w-3 h-3" /> 新增備忘...</span>}
                                    </div>

                                    {/* Links 顯示 (如果有) */}
                                    {links.length > 0 && (
                                        <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm bg-white">
                                            <Table>
                                                <TableBody>
                                                    {links.map((item: SubItem, i: number) => (
                                                        <TableRow key={i} className="hover:bg-slate-50">
                                                            <TableCell className="py-2 px-3 align-top">
                                                                <div className="text-xs font-bold text-slate-700">{item.name}</div>
                                                                {item.desc && <div className="text-[10px] text-slate-500">{item.desc}</div>}
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
                <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
                    {!hideMapBtn && (
                        <Button variant="outline" className="flex-1" onClick={onMap}>
                            <MapPin className="w-4 h-4 mr-2" /> Google Maps
                        </Button>
                    )}
                    <Button className={cn("flex-1 bg-slate-900 text-white hover:bg-slate-800", hideMapBtn ? "w-full" : "")} onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
