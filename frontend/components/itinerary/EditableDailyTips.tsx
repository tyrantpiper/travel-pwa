"use client"

import { useState, useMemo, useEffect } from "react"
import { AlertCircle, Wallet, Ticket, Plus, X, Check, Calculator, Eye, EyeOff, Loader2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useHaptic } from "@/lib/hooks"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/LanguageContext"

// Types
interface NoteItem {
    icon?: string
    title: string
    content: string
}

interface CostItem {
    item: string
    amount: string
    currency?: string
    note?: string
    is_private?: boolean
    private_owner_id?: string
}

interface TicketItem {
    name: string
    price: string
    currency?: string
    note?: string
    is_private?: boolean
    private_owner_id?: string
}

interface EditableDailyTipsProps {
    tripId: string
    day: number
    notes: NoteItem[]
    costs: CostItem[]
    tickets: TicketItem[]
    onUpdate: (type: "notes" | "costs" | "tickets", data: NoteItem[] | CostItem[] | TicketItem[]) => Promise<boolean>
    readOnly?: boolean
    userId?: string  // 🆕 For tracking who set privacy
}

// Constants
// 🎨 圖標庫 - 分類排列，方便用戶快速找到
const NOTE_ICONS = [
    // 🔔 警告 & 提示
    "⚠️", "💡", "📢", "🔔",
    // ✈️ 交通
    "✈️", "🚇", "🚌", "🚗", "🚶",
    // 🏨 住宿
    "🏨", "🏠", "🔑",
    // 🍽️ 餐飲
    "🍽️", "☕", "🍜",
    // 🛒 購物 & 實用
    "🛒", "🛍️", "💳", "🏧", "📦",
    // 🎫 票券 & 活動
    "🎫", "🎭", "🎢",
    // 📍 時間地點
    "📍", "⏰", "📅",
    // 🎒 其他實用
    "🎒", "📸", "💊", "☂️", "🔋"
]

// 🆕 IconPicker Component for custom emoji selection
function IconPicker({ value, onChange }: { value: string, onChange: (val: string) => void }) {
    const [isOpen, setIsOpen] = useState(false)
    const [customValue, setCustomValue] = useState("")

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button
                    className="w-12 h-9 text-lg flex items-center justify-center bg-transparent border border-slate-200 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    title="Select or enter icon"
                >
                    {value || "⚠️"}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
                <div className="space-y-3">
                    <div className="grid grid-cols-6 gap-2">
                        {NOTE_ICONS.map(icon => (
                            <button
                                key={icon}
                                onClick={() => {
                                    onChange(icon)
                                    setIsOpen(false)
                                }}
                                className={cn(
                                    "text-lg p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
                                    value === icon && "bg-amber-100 dark:bg-amber-900/40"
                                )}
                            >
                                {icon}
                            </button>
                        ))}
                    </div>
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Paste custom emoji"
                                className="h-8 text-xs flex-1"
                                value={customValue}
                                onChange={(e) => {
                                    const val = e.target.value
                                    setCustomValue(val)
                                    // 🚀 如果輸入包含 emoji，自動應用第一個字元
                                    if (val.trim()) {
                                        onChange(val.trim())
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') setIsOpen(false)
                                }}
                            />
                            <Button size="sm" className="h-8 px-2" onClick={() => setIsOpen(false)}>
                                <Check className="w-3 h-3" />
                            </Button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Paste or type an emoji</p>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

// 🧠 AI Data Normalizer: 確保 AI 產出的 notes 能正確對應前端欄位
// 向下相容：舊格式 {item, content} → 新格式 {icon, title, content}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeNote(raw: any): NoteItem {
    if (!raw || typeof raw !== 'object') return { icon: '💡', title: '', content: '' }
    return {
        icon: raw.icon || undefined,
        title: raw.title || raw.item || '',
        content: raw.content || ''
    }
}

const CURRENCIES = ["JPY", "TWD", "USD", "EUR", "KRW", "HKD"]
const DEFAULT_CURRENCY = "JPY"

export default function EditableDailyTips({
    tripId: _tripId,  // eslint-disable-line @typescript-eslint/no-unused-vars
    day: _day,        // eslint-disable-line @typescript-eslint/no-unused-vars
    notes,
    costs,
    tickets,
    onUpdate,
    readOnly = false,
    userId
}: EditableDailyTipsProps) {
    const { lang } = useLanguage()
    const zh = lang === 'zh'
    const haptic = useHaptic()

    // Local state (initialized from props, synced via key prop from parent)
    // Note: Parent component should use `key={day}` to force re-mount on day change
    const [localNotes, setLocalNotes] = useState<NoteItem[]>((notes || []).map(normalizeNote))
    const [localCosts, setLocalCosts] = useState<CostItem[]>(costs || [])
    const [localTickets, setLocalTickets] = useState<TicketItem[]>(tickets || [])

    // Adding state
    const [addingNote, setAddingNote] = useState(false)
    const [addingCost, setAddingCost] = useState(false)
    const [addingTicket, setAddingTicket] = useState(false)

    // 🔧 FIX: Sync local state when props update (async data loading)
    // 🛡️ L4 Protection: Skip sync if user is currently adding an item to prevent "Renew Overwrite"
    useEffect(() => {
        if (!addingNote) setLocalNotes((notes || []).map(normalizeNote))
    }, [notes, addingNote])

    useEffect(() => {
        if (!addingCost) setLocalCosts(costs || [])
    }, [costs, addingCost])

    useEffect(() => {
        if (!addingTicket) setLocalTickets(tickets || [])
    }, [tickets, addingTicket])

    // Forms
    const [newNote, setNewNote] = useState<NoteItem>({ icon: "⚠️", title: "", content: "" })
    const [newCost, setNewCost] = useState<CostItem>({ item: "", amount: "", currency: DEFAULT_CURRENCY, note: "" })
    const [newTicket, setNewTicket] = useState<TicketItem>({ name: "", price: "", currency: DEFAULT_CURRENCY, note: "" })

    const [saving, setSaving] = useState(false)

    // 🆕 Per-item processing state for anti-spam
    const [processingNotes, setProcessingNotes] = useState<Set<number>>(new Set())
    const [processingCosts, setProcessingCosts] = useState<Set<number>>(new Set())
    const [processingTickets, setProcessingTickets] = useState<Set<number>>(new Set())

    // 🆕 編輯模式狀態
    const [editingNotes, setEditingNotes] = useState(false)
    const [editingCosts, setEditingCosts] = useState(false)
    const [editingTickets, setEditingTickets] = useState(false)

    // 🆕 編輯中的資料副本
    const [editNotesData, setEditNotesData] = useState<NoteItem[]>([])
    const [editCostsData, setEditCostsData] = useState<CostItem[]>([])
    const [editTicketsData, setEditTicketsData] = useState<TicketItem[]>([])

    // 🆕 Exchange rates for conversion display
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ JPY: 0.22 }) // Default JPY→TWD

    // Fetch exchange rates on mount
    useEffect(() => {
        const fetchRates = async () => {
            try {
                const res = await fetch(
                    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/twd.json"
                )
                const data = await res.json()
                if (data.twd) {
                    // Convert to "X currency → TWD" rates
                    const rates: Record<string, number> = {}
                    for (const [cur, rate] of Object.entries(data.twd)) {
                        if (typeof rate === 'number' && rate > 0) {
                            rates[cur.toUpperCase()] = 1 / rate // Invert: TWD per unit
                        }
                    }
                    setExchangeRates(rates)
                }
            } catch { /* Use default rates */ }
        }
        fetchRates()
    }, [])

    // === Helpers ===
    const formatCurrency = (amount: string | number, currency: string = DEFAULT_CURRENCY) => {
        // Try to parse number
        const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/,/g, ''))
        if (isNaN(num)) return String(amount) // invalid number

        // Base display
        const baseDisplay = `${currency} ${num.toLocaleString()}`

        // 🆕 Add TWD conversion if not already TWD
        if (currency !== 'TWD' && exchangeRates[currency]) {
            const twdAmount = Math.round(num * exchangeRates[currency])
            return `${baseDisplay} (≈NT$${twdAmount.toLocaleString()})`
        }

        return baseDisplay
    }

    const calculateTotal = (items: { amount?: string, price?: string, currency?: string }[]) => {
        const totals: Record<string, number> = {}
        items.forEach(item => {
            const valRaw = item.amount || item.price || "0"
            const cur = item.currency || DEFAULT_CURRENCY
            const val = typeof valRaw === 'number' ? valRaw : parseFloat(String(valRaw).replace(/,/g, ''))
            if (!isNaN(val)) {
                totals[cur] = (totals[cur] || 0) + val
            }
        })
        return totals
    }

    const costsTotal = useMemo(() => calculateTotal(localCosts), [localCosts])
    const ticketsTotal = useMemo(() => calculateTotal(localTickets), [localTickets])

    // === Handlers ===

    // Notes
    const handleAddNote = async () => {
        if (saving) return
        if (!newNote.title.trim()) { toast.error(zh ? "請輸入標題" : "Please enter a title"); return }
        setSaving(true); haptic.tap()
        try {
            const updated = [...localNotes, newNote]
            if (await onUpdate("notes", updated)) {
                setLocalNotes(updated)
                setNewNote({ icon: "⚠️", title: "", content: "" })
                setAddingNote(false)
                toast.success(zh ? "已新增提醒" : "Reminder added")
            }
        } finally {
            setSaving(false)
        }
    }

    const handleRemoveNote = async (idx: number) => {
        // 🛡️ Anti-spam: skip if already processing
        if (processingNotes.has(idx)) return

        haptic.tap()
        setProcessingNotes(prev => new Set(prev).add(idx))

        try {
            const updated = localNotes.filter((_, i) => i !== idx)
            if (await onUpdate("notes", updated)) {
                setLocalNotes(updated)
                toast.success(zh ? "已移除" : "Removed")
            }
        } finally {
            setProcessingNotes(prev => {
                const next = new Set(prev)
                next.delete(idx)
                return next
            })
        }
    }

    // 🆕 Notes 編輯模式
    const handleStartEditNotes = () => {
        setEditNotesData([...localNotes])
        setEditingNotes(true)
        setAddingNote(false)
        haptic.tap()
    }

    const handleSaveNotes = async () => {
        if (saving) return
        setSaving(true)
        haptic.tap()
        try {
            if (await onUpdate("notes", editNotesData)) {
                setLocalNotes(editNotesData)
                setEditingNotes(false)
                setEditNotesData([])
                toast.success(zh ? "已儲存修改" : "Changes saved")
            } else {
                toast.error(zh ? "儲存失敗" : "Save failed")
            }
        } finally {
            setSaving(false)
        }
    }

    const handleCancelEditNotes = () => {
        setEditingNotes(false)
        setEditNotesData([])
        haptic.tap()
    }

    const handleUpdateEditNote = (idx: number, field: keyof NoteItem, value: string) => {
        setEditNotesData(prev => prev.map((note, i) =>
            i === idx ? { ...note, [field]: value } : note
        ))
    }

    const handleAddCost = async () => {
        if (saving) return
        if (!newCost.item.trim() || !newCost.amount.trim()) { toast.error(zh ? "請輸入項目和金額" : "Please enter item and amount"); return }
        setSaving(true); haptic.tap()
        try {
            const updated = [...localCosts, newCost]
            if (await onUpdate("costs", updated)) {
                setLocalCosts(updated)
                setNewCost({ item: "", amount: "", currency: DEFAULT_CURRENCY, note: "" })
                setAddingCost(false)
                toast.success(zh ? "已新增花費" : "Cost added")
            }
        } finally {
            setSaving(false)
        }
    }

    const handleRemoveCost = async (idx: number) => {
        // 🛡️ Anti-spam: skip if already processing
        if (processingCosts.has(idx)) return

        haptic.tap()
        setProcessingCosts(prev => new Set(prev).add(idx))

        try {
            const updated = localCosts.filter((_, i) => i !== idx)
            if (await onUpdate("costs", updated)) {
                setLocalCosts(updated)
                toast.success("已移除")
            }
        } finally {
            setProcessingCosts(prev => {
                const next = new Set(prev)
                next.delete(idx)
                return next
            })
        }
    }

    // 🆕 Toggle privacy for costs
    const handleTogglePrivacyCost = async (idx: number) => {
        // 🛡️ Anti-spam: skip if already processing
        if (processingCosts.has(idx)) return

        haptic.tap()
        setProcessingCosts(prev => new Set(prev).add(idx))

        try {
            const updated: CostItem[] = localCosts.map((c, i) =>
                i === idx ? {
                    ...c,
                    is_private: !c.is_private,
                    // 🧠 Secure ID Assignment: Must use stable UUID
                    private_owner_id: !c.is_private ? (userId || localStorage.getItem("user_uuid") || undefined) : undefined
                } : c
            )
            if (await onUpdate("costs", updated)) {
                setLocalCosts(updated)
                toast.success(updated[idx].is_private ? (zh ? "已設為私人" : "Set to private") : (zh ? "已設為公開" : "Set to public"))
            }
        } finally {
            setProcessingCosts(prev => {
                const next = new Set(prev)
                next.delete(idx)
                return next
            })
        }
    }

    // 🆕 Costs 編輯模式
    const handleStartEditCosts = () => {
        setEditCostsData([...localCosts])
        setEditingCosts(true)
        setAddingCost(false)
        haptic.tap()
    }

    const handleSaveCosts = async () => {
        if (saving) return
        setSaving(true)
        haptic.tap()
        try {
            if (await onUpdate("costs", editCostsData)) {
                setLocalCosts(editCostsData)
                setEditingCosts(false)
                setEditCostsData([])
                toast.success(zh ? "已儲存修改" : "Changes saved")
            } else {
                toast.error(zh ? "儲存失敗" : "Save failed")
            }
        } finally {
            setSaving(false)
        }
    }

    const handleCancelEditCosts = () => {
        setEditingCosts(false)
        setEditCostsData([])
        haptic.tap()
    }

    const handleUpdateEditCost = (idx: number, field: keyof CostItem, value: string) => {
        setEditCostsData(prev => prev.map((cost, i) =>
            i === idx ? { ...cost, [field]: value } : cost
        ))
    }

    // Tickets
    const handleAddTicket = async () => {
        if (saving) return
        if (!newTicket.name.trim() || !newTicket.price.trim()) { toast.error(zh ? "請輸入票券名稱和價格" : "Please enter ticket name and price"); return }
        setSaving(true); haptic.tap()
        try {
            const updated = [...localTickets, newTicket]
            if (await onUpdate("tickets", updated)) {
                setLocalTickets(updated)
                setNewTicket({ name: "", price: "", currency: DEFAULT_CURRENCY, note: "" })
                setAddingTicket(false)
                toast.success(zh ? "已新增票券" : "Ticket added")
            }
        } finally {
            setSaving(false)
        }
    }

    const handleRemoveTicket = async (idx: number) => {
        // 🛡️ Anti-spam: skip if already processing
        if (processingTickets.has(idx)) return

        haptic.tap()
        setProcessingTickets(prev => new Set(prev).add(idx))

        try {
            const updated = localTickets.filter((_, i) => i !== idx)
            if (await onUpdate("tickets", updated)) {
                setLocalTickets(updated)
                toast.success("已移除")
            }
        } finally {
            setProcessingTickets(prev => {
                const next = new Set(prev)
                next.delete(idx)
                return next
            })
        }
    }

    // 🆕 Toggle privacy for tickets
    const handleTogglePrivacyTicket = async (idx: number) => {
        // 🛡️ Anti-spam: skip if already processing
        if (processingTickets.has(idx)) return

        haptic.tap()
        setProcessingTickets(prev => new Set(prev).add(idx))

        try {
            const updated: TicketItem[] = localTickets.map((t, i) =>
                i === idx ? {
                    ...t,
                    is_private: !t.is_private,
                    // 🧠 Secure ID Assignment: Must use stable UUID
                    private_owner_id: !t.is_private ? (userId || localStorage.getItem("user_uuid") || undefined) : undefined
                } : t
            )
            if (await onUpdate("tickets", updated)) {
                setLocalTickets(updated)
                toast.success(updated[idx].is_private ? (zh ? "已設為私人" : "Set to private") : (zh ? "已設為公開" : "Set to public"))
            }
        } finally {
            setProcessingTickets(prev => {
                const next = new Set(prev)
                next.delete(idx)
                return next
            })
        }
    }

    // 🆕 Tickets 編輯模式
    const handleStartEditTickets = () => {
        setEditTicketsData([...localTickets])
        setEditingTickets(true)
        setAddingTicket(false)
        haptic.tap()
    }

    const handleSaveTickets = async () => {
        if (saving) return
        setSaving(true)
        haptic.tap()
        try {
            if (await onUpdate("tickets", editTicketsData)) {
                setLocalTickets(editTicketsData)
                setEditingTickets(false)
                setEditTicketsData([])
                toast.success(zh ? "已儲存修改" : "Changes saved")
            } else {
                toast.error(zh ? "儲存失敗" : "Save failed")
            }
        } finally {
            setSaving(false)
        }
    }

    const handleCancelEditTickets = () => {
        setEditingTickets(false)
        setEditTicketsData([])
        haptic.tap()
    }

    const handleUpdateEditTicket = (idx: number, field: keyof TicketItem, value: string) => {
        setEditTicketsData(prev => prev.map((ticket, i) =>
            i === idx ? { ...ticket, [field]: value } : ticket
        ))
    }

    return (
        <div className="mx-5 mb-6 space-y-4">
            {/* ⚠️ Notes Section */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <AlertCircle className="w-4 h-4" />
                        <h4 className="text-sm font-bold">{zh ? '每日重點提醒' : 'Daily Reminders'}</h4>
                    </div>
                    {!readOnly && !editingNotes && (
                        <div className="flex gap-1">
                            {localNotes.length > 0 && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-100" onClick={handleStartEditNotes}>
                                    <Pencil className="w-3 h-3 mr-1" /> {zh ? '編輯' : 'Edit'}
                                </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-100" onClick={() => setAddingNote(true)}>
                                <Plus className="w-3 h-3 mr-1" /> {zh ? '新增' : 'Add'}
                            </Button>
                        </div>
                    )}
                    {editingNotes && (
                        <div className="flex gap-1">
                            <Button size="sm" className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white" onClick={handleSaveNotes} disabled={saving}>
                                {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />} {zh ? '儲存' : 'Save'}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCancelEditNotes}>
                                {zh ? '取消' : 'Cancel'}
                            </Button>
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    {/* 編輯模式：顯示所有條目的編輯表單 */}
                    {editingNotes && editNotesData.map((note, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-amber-200 dark:border-amber-700 space-y-2">
                            <div className="flex gap-2">
                                <IconPicker
                                    value={note.icon || "⚠️"}
                                    onChange={(val) => handleUpdateEditNote(idx, 'icon', val)}
                                />
                                <Input
                                    placeholder={zh ? "標題" : "Title"}
                                    className="flex-1 h-9 text-sm"
                                    value={note.title}
                                    onChange={(e) => handleUpdateEditNote(idx, 'title', e.target.value)}
                                />
                            </div>
                            <Input
                                placeholder={zh ? "內容..." : "Content..."}
                                className="h-9 text-sm"
                                value={note.content}
                                onChange={(e) => handleUpdateEditNote(idx, 'content', e.target.value)}
                            />
                        </div>
                    ))}

                    {/* 正常模式：顯示條目 */}
                    {!editingNotes && localNotes.map((note, idx) => (
                        <div key={idx} className="flex gap-3 items-start group">
                            <div className="text-lg leading-none mt-0.5">{note.icon || '⚠️'}</div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{note.title}</div>
                                <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 whitespace-pre-line">{note.content}</div>
                            </div>
                            {!readOnly && (
                                <button
                                    onClick={() => handleRemoveNote(idx)}
                                    disabled={processingNotes.has(idx)}
                                    className={cn(
                                        "p-1.5 transition-all touch-manipulation min-w-[32px] min-h-[32px] flex items-center justify-center",
                                        processingNotes.has(idx) ? "opacity-50 cursor-not-allowed" : "text-slate-300 hover:text-red-500 active:text-red-600"
                                    )}
                                >
                                    {processingNotes.has(idx) ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <X className="w-4 h-4" />
                                    )}
                                </button>
                            )}
                        </div>
                    ))}

                    {/* 空狀態提示 */}
                    {localNotes.length === 0 && !addingNote && !editingNotes && (
                        <p className="text-xs text-amber-600/60 dark:text-amber-400/60 italic text-center py-2">{zh ? '尚無提醒，點擊「新增」添加' : 'No reminders yet. Click "Add" to create one.'}</p>
                    )}

                    {/* 新增表單 */}
                    {addingNote && (
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-amber-200 dark:border-amber-700 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex gap-2">
                                <IconPicker
                                    value={newNote.icon || "⚠️"}
                                    onChange={(val) => setNewNote({ ...newNote, icon: val })}
                                />
                                <Input placeholder={zh ? "標題" : "Title"} className="flex-1 h-9 text-sm" value={newNote.title} onChange={(e) => setNewNote({ ...newNote, title: e.target.value })} />
                            </div>
                            <Input placeholder={zh ? "內容..." : "Content..."} className="h-9 text-sm" value={newNote.content} onChange={(e) => setNewNote({ ...newNote, content: e.target.value })} />
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setAddingNote(false)}>{zh ? '取消' : 'Cancel'}</Button>
                                <Button size="sm" onClick={handleAddNote} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-white"><Check className="w-3 h-3 mr-1" /> {zh ? '確定' : 'OK'}</Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 💰 Costs Section */}
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Wallet className="w-4 h-4" />
                            <h4 className="text-sm font-bold">{zh ? '預估花費' : 'Estimated Costs'}</h4>
                        </div>
                        {!readOnly && !editingCosts && (
                            <div className="flex gap-1">
                                {localCosts.length > 0 && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100" onClick={handleStartEditCosts}>
                                        <Pencil className="w-3 h-3 mr-1" /> {zh ? '編輯' : 'Edit'}
                                    </Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100" onClick={() => setAddingCost(true)}>
                                    <Plus className="w-3 h-3 mr-1" /> {zh ? '新增' : 'Add'}
                                </Button>
                            </div>
                        )}
                        {editingCosts && (
                            <div className="flex gap-1">
                                <Button size="sm" className="h-7 text-xs bg-slate-600 hover:bg-slate-700 text-white" onClick={handleSaveCosts} disabled={saving}>
                                    {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />} {zh ? '儲存' : 'Save'}
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCancelEditCosts}>
                                    {zh ? '取消' : 'Cancel'}
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 space-y-2">
                        {/* 編輯模式：顯示所有花費的編輯表單 */}
                        {editingCosts && editCostsData.map((cost, idx) => (
                            <div key={idx} className="bg-white dark:bg-slate-700 rounded-lg p-2 border border-slate-200 dark:border-slate-600 space-y-2">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder={zh ? "項目" : "Item"}
                                        className="flex-1 h-8 text-xs"
                                        value={cost.item}
                                        onChange={(e) => handleUpdateEditCost(idx, 'item', e.target.value)}
                                    />
                                    <div className="flex gap-1 w-32">
                                        <select
                                            className="h-8 text-xs bg-slate-50 dark:bg-slate-600 border rounded w-[4.5rem]"
                                            value={cost.currency || DEFAULT_CURRENCY}
                                            onChange={(e) => handleUpdateEditCost(idx, 'currency', e.target.value)}
                                        >
                                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <Input
                                            placeholder={zh ? "金額" : "Amount"}
                                            className="flex-1 h-8 text-xs"
                                            type="number"
                                            value={cost.amount}
                                            onChange={(e) => handleUpdateEditCost(idx, 'amount', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <Input
                                    placeholder={zh ? "備註 (選填)" : "Note (optional)"}
                                    className="h-8 text-xs"
                                    value={cost.note || ""}
                                    onChange={(e) => handleUpdateEditCost(idx, 'note', e.target.value)}
                                />
                            </div>
                        ))}

                        {/* 正常模式：顯示花費列表 */}
                        {!editingCosts && localCosts.map((cost, idx) => (
                            <div
                                key={idx}
                                className={cn(
                                    "flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-700 last:border-0 pb-2 last:pb-0 group",
                                    cost.is_private && "opacity-60 border-dashed"
                                )}
                            >
                                <span className="text-slate-600 dark:text-slate-400 font-medium">
                                    {cost.is_private && <EyeOff className="w-3 h-3 inline mr-1 text-slate-400" />}
                                    {cost.item}
                                </span>
                                <div className="flex items-center gap-2">
                                    <div className="text-right">
                                        <div className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(cost.amount, cost.currency)}</div>
                                        {cost.note && <div className="text-[10px] text-slate-400">{cost.note}</div>}
                                    </div>
                                    {!readOnly && (
                                        <>
                                            <button
                                                onClick={() => handleTogglePrivacyCost(idx)}
                                                disabled={processingCosts.has(idx)}
                                                className={cn(
                                                    "p-1 transition-all touch-manipulation min-w-[28px] min-h-[28px] flex items-center justify-center",
                                                    processingCosts.has(idx) && "opacity-50 cursor-not-allowed",
                                                    cost.is_private
                                                        ? "text-amber-500 hover:text-amber-600"
                                                        : "text-slate-300 hover:text-slate-500"
                                                )}
                                                title={cost.is_private ? (zh ? "設為公開" : "Make public") : (zh ? "設為私人" : "Make private")}
                                            >
                                                {processingCosts.has(idx) ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : cost.is_private ? (
                                                    <EyeOff className="w-3 h-3" />
                                                ) : (
                                                    <Eye className="w-3 h-3" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleRemoveCost(idx)}
                                                disabled={processingCosts.has(idx)}
                                                className={cn(
                                                    "p-1 text-slate-300 hover:text-red-500 active:text-red-600 transition-all touch-manipulation min-w-[28px] min-h-[28px] flex items-center justify-center",
                                                    processingCosts.has(idx) && "opacity-50 cursor-not-allowed"
                                                )}
                                            >
                                                {processingCosts.has(idx) ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <X className="w-3 h-3" />
                                                )}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Auto Sum Footer */}
                        {localCosts.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs text-slate-500">
                                <span className="flex items-center gap-1"><Calculator className="w-3 h-3" /> {zh ? '小計' : 'Subtotal'}</span>
                                <div className="flex gap-2">
                                    {Object.entries(costsTotal).map(([curr, total]) => (
                                        <span key={curr} className="font-mono font-bold text-slate-700 dark:text-slate-300">{curr} {total.toLocaleString()}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {localCosts.length === 0 && !addingCost && (
                            <p className="text-xs text-slate-400 italic text-center py-2">{zh ? '尚無花費記錄' : 'No costs recorded'}</p>
                        )}

                        {addingCost && (
                            <div className="bg-white dark:bg-slate-700 rounded-lg p-2 border border-slate-200 dark:border-slate-600 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex gap-2">
                                    <Input placeholder={zh ? "項目" : "Item"} className="flex-1 h-8 text-xs" value={newCost.item} onChange={(e) => setNewCost({ ...newCost, item: e.target.value })} />
                                    <div className="flex gap-1 w-32">
                                        <select className="h-8 text-xs bg-slate-50 border rounded w-[4.5rem]" value={newCost.currency} onChange={e => setNewCost({ ...newCost, currency: e.target.value })}>
                                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <Input placeholder={zh ? "金額" : "Amount"} className="flex-1 h-8 text-xs" type="number" value={newCost.amount} onChange={(e) => setNewCost({ ...newCost, amount: e.target.value })} />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Input placeholder={zh ? "備註 (選填)" : "Note (optional)"} className="flex-1 h-8 text-xs" value={newCost.note} onChange={(e) => setNewCost({ ...newCost, note: e.target.value })} />
                                    <Button size="sm" className="h-8 px-2" onClick={handleAddCost} disabled={saving}><Check className="w-3 h-3" /></Button>
                                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setAddingCost(false)}><X className="w-3 h-3" /></Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 🎫 Tickets Section */}
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                            <Ticket className="w-4 h-4" />
                            <h4 className="text-sm font-bold">{zh ? '交通票券' : 'Transport Tickets'}</h4>
                        </div>
                        {!readOnly && !editingTickets && (
                            <div className="flex gap-1">
                                {localTickets.length > 0 && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100" onClick={handleStartEditTickets}>
                                        <Pencil className="w-3 h-3 mr-1" /> {zh ? '編輯' : 'Edit'}
                                    </Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100" onClick={() => setAddingTicket(true)}>
                                    <Plus className="w-3 h-3 mr-1" /> {zh ? '新增' : 'Add'}
                                </Button>
                            </div>
                        )}
                        {editingTickets && (
                            <div className="flex gap-1">
                                <Button size="sm" className="h-7 text-xs bg-blue-500 hover:bg-blue-600 text-white" onClick={handleSaveTickets} disabled={saving}>
                                    {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />} {zh ? '儲存' : 'Save'}
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCancelEditTickets}>
                                    {zh ? '取消' : 'Cancel'}
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 space-y-2">
                        {/* 編輯模式：顯示所有票券的編輯表單 */}
                        {editingTickets && editTicketsData.map((ticket, idx) => (
                            <div key={idx} className="bg-white dark:bg-slate-700 rounded-lg p-2 border border-blue-200 dark:border-blue-600 space-y-2">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder={zh ? "票券名稱" : "Ticket name"}
                                        className="flex-1 h-8 text-xs"
                                        value={ticket.name}
                                        onChange={(e) => handleUpdateEditTicket(idx, 'name', e.target.value)}
                                    />
                                    <div className="flex gap-1 w-32">
                                        <select
                                            className="h-8 text-xs bg-slate-50 dark:bg-slate-600 border rounded w-[4.5rem]"
                                            value={ticket.currency || DEFAULT_CURRENCY}
                                            onChange={(e) => handleUpdateEditTicket(idx, 'currency', e.target.value)}
                                        >
                                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <Input
                                            placeholder={zh ? "價格" : "Price"}
                                            className="flex-1 h-8 text-xs"
                                            type="number"
                                            value={ticket.price}
                                            onChange={(e) => handleUpdateEditTicket(idx, 'price', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <Input
                                    placeholder={zh ? "備註 (選填)" : "Note (optional)"}
                                    className="h-8 text-xs"
                                    value={ticket.note || ""}
                                    onChange={(e) => handleUpdateEditTicket(idx, 'note', e.target.value)}
                                />
                            </div>
                        ))}

                        {/* 正常模式：顯示票券列表 */}
                        {!editingTickets && localTickets.map((ticket, idx) => (
                            <div
                                key={idx}
                                className={cn(
                                    "bg-white/60 dark:bg-slate-800/60 rounded-lg p-2 text-sm border border-blue-100 dark:border-blue-800 group",
                                    ticket.is_private && "opacity-60 border-dashed"
                                )}
                            >
                                <div className="font-bold text-slate-800 dark:text-slate-200 flex justify-between">
                                    <span>
                                        {ticket.is_private && <EyeOff className="w-3 h-3 inline mr-1 text-blue-400" />}
                                        {ticket.name}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-blue-600 dark:text-blue-400">{formatCurrency(ticket.price, ticket.currency)}</span>
                                        {!readOnly && (
                                            <>
                                                <button
                                                    onClick={() => handleTogglePrivacyTicket(idx)}
                                                    disabled={processingTickets.has(idx)}
                                                    className={cn(
                                                        "p-1 transition-all touch-manipulation min-w-[28px] min-h-[28px] flex items-center justify-center",
                                                        processingTickets.has(idx) && "opacity-50 cursor-not-allowed",
                                                        ticket.is_private
                                                            ? "text-amber-500 hover:text-amber-600"
                                                            : "text-blue-300 hover:text-blue-500"
                                                    )}
                                                    title={ticket.is_private ? (zh ? "設為公開" : "Make public") : (zh ? "設為私人" : "Make private")}
                                                >
                                                    {processingTickets.has(idx) ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : ticket.is_private ? (
                                                        <EyeOff className="w-3 h-3" />
                                                    ) : (
                                                        <Eye className="w-3 h-3" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveTicket(idx)}
                                                    disabled={processingTickets.has(idx)}
                                                    className={cn(
                                                        "p-1 text-slate-300 hover:text-red-500 active:text-red-600 transition-all touch-manipulation min-w-[28px] min-h-[28px] flex items-center justify-center",
                                                        processingTickets.has(idx) && "opacity-50 cursor-not-allowed"
                                                    )}
                                                >
                                                    {processingTickets.has(idx) ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <X className="w-3 h-3" />
                                                    )}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {ticket.note && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{ticket.note}</div>}
                            </div>
                        ))}

                        {/* Auto Sum Footer */}
                        {localTickets.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs text-slate-500">
                                <span className="flex items-center gap-1"><Calculator className="w-3 h-3" /> {zh ? '小計' : 'Subtotal'}</span>
                                <div className="flex gap-2">
                                    {Object.entries(ticketsTotal).map(([curr, total]) => (
                                        <span key={curr} className="font-mono font-bold text-blue-700 dark:text-blue-300">{curr} {total.toLocaleString()}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {localTickets.length === 0 && !addingTicket && (
                            <p className="text-xs text-blue-400/60 italic text-center py-2">{zh ? '尚無票券記錄' : 'No tickets recorded'}</p>
                        )}

                        {addingTicket && (
                            <div className="bg-white dark:bg-slate-700 rounded-lg p-2 border border-blue-200 dark:border-blue-700 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex gap-2">
                                    <Input placeholder={zh ? "票券名稱" : "Ticket name"} className="flex-1 h-8 text-xs" value={newTicket.name} onChange={(e) => setNewTicket({ ...newTicket, name: e.target.value })} />
                                    <div className="flex gap-1 w-32">
                                        <select className="h-8 text-xs bg-slate-50 border rounded w-[4.5rem]" value={newTicket.currency} onChange={e => setNewTicket({ ...newTicket, currency: e.target.value })}>
                                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <Input placeholder={zh ? "金額" : "Amount"} className="flex-1 h-8 text-xs" type="number" value={newTicket.price} onChange={(e) => setNewTicket({ ...newTicket, price: e.target.value })} />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Input placeholder={zh ? "備註 (選填)" : "Note (optional)"} className="flex-1 h-8 text-xs" value={newTicket.note} onChange={(e) => setNewTicket({ ...newTicket, note: e.target.value })} />
                                    <Button size="sm" className="h-8 px-2 bg-blue-500 hover:bg-blue-600" onClick={handleAddTicket} disabled={saving}><Check className="w-3 h-3" /></Button>
                                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setAddingTicket(false)}><X className="w-3 h-3" /></Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
