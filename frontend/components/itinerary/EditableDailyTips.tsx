"use client"

import { useState, useMemo } from "react"
import { AlertCircle, Wallet, Ticket, Plus, X, Check, Calculator } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useHaptic } from "@/lib/hooks"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// Types
interface NoteItem {
    icon?: string
    title: string
    content: string
}

interface CostItem {
    item: string
    amount: string  // Keep as string for input flexibility, but parse for total
    currency?: string // 🆕 Currency support
    note?: string
}

interface TicketItem {
    name: string
    price: string
    currency?: string // 🆕 Currency support
    note?: string
}

interface EditableDailyTipsProps {
    tripId: string
    day: number
    notes: NoteItem[]
    costs: CostItem[]
    tickets: TicketItem[]
    onUpdate: (type: "notes" | "costs" | "tickets", data: NoteItem[] | CostItem[] | TicketItem[]) => Promise<boolean>
    readOnly?: boolean
}

// Constants
const NOTE_ICONS = ["⚠️", "✈️", "🚇", "🏨", "🍽️", "🎫", "💡", "📍", "⏰", "🎒"]
const CURRENCIES = ["JPY", "TWD", "USD", "EUR", "KRW", "HKD"]
const DEFAULT_CURRENCY = "JPY"

export default function EditableDailyTips({
    tripId: _tripId,
    day: _day,
    notes,
    costs,
    tickets,
    onUpdate,
    readOnly = false
}: EditableDailyTipsProps) {
    const haptic = useHaptic()

    // Local state (initialized from props, synced via key prop from parent)
    // Note: Parent component should use `key={day}` to force re-mount on day change
    const [localNotes, setLocalNotes] = useState<NoteItem[]>(notes || [])
    const [localCosts, setLocalCosts] = useState<CostItem[]>(costs || [])
    const [localTickets, setLocalTickets] = useState<TicketItem[]>(tickets || [])

    // Adding state
    const [addingNote, setAddingNote] = useState(false)
    const [addingCost, setAddingCost] = useState(false)
    const [addingTicket, setAddingTicket] = useState(false)

    // Forms
    const [newNote, setNewNote] = useState<NoteItem>({ icon: "⚠️", title: "", content: "" })
    const [newCost, setNewCost] = useState<CostItem>({ item: "", amount: "", currency: DEFAULT_CURRENCY, note: "" })
    const [newTicket, setNewTicket] = useState<TicketItem>({ name: "", price: "", currency: DEFAULT_CURRENCY, note: "" })

    const [saving, setSaving] = useState(false)

    // === Helpers ===
    const formatCurrency = (amount: string, currency: string = DEFAULT_CURRENCY) => {
        // Try to parse number
        const num = parseFloat(amount.replace(/,/g, ''))
        if (isNaN(num)) return amount // invalid number
        return `${currency} ${num.toLocaleString()}`
    }

    const calculateTotal = (items: { amount?: string, price?: string, currency?: string }[]) => {
        const totals: Record<string, number> = {}
        items.forEach(item => {
            const amtStr = item.amount || item.price || "0"
            const cur = item.currency || DEFAULT_CURRENCY
            const val = parseFloat(amtStr.replace(/,/g, ''))
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
        if (!newNote.title.trim()) { toast.error("請輸入標題"); return }
        setSaving(true); haptic.tap()
        const updated = [...localNotes, newNote]
        if (await onUpdate("notes", updated)) {
            setLocalNotes(updated)
            setNewNote({ icon: "⚠️", title: "", content: "" })
            setAddingNote(false)
            toast.success("已新增提醒")
        }
        setSaving(false)
    }

    const handleRemoveNote = async (idx: number) => {
        haptic.tap()
        const updated = localNotes.filter((_, i) => i !== idx)
        if (await onUpdate("notes", updated)) {
            setLocalNotes(updated)
            toast.success("已移除")
        }
    }

    // Costs
    const handleAddCost = async () => {
        if (!newCost.item.trim() || !newCost.amount.trim()) { toast.error("請輸入項目和金額"); return }
        setSaving(true); haptic.tap()
        const updated = [...localCosts, newCost]
        if (await onUpdate("costs", updated)) {
            setLocalCosts(updated)
            setNewCost({ item: "", amount: "", currency: DEFAULT_CURRENCY, note: "" })
            setAddingCost(false)
            toast.success("已新增花費")
        }
        setSaving(false)
    }

    const handleRemoveCost = async (idx: number) => {
        haptic.tap()
        const updated = localCosts.filter((_, i) => i !== idx)
        if (await onUpdate("costs", updated)) {
            setLocalCosts(updated)
            toast.success("已移除")
        }
    }

    // Tickets
    const handleAddTicket = async () => {
        if (!newTicket.name.trim() || !newTicket.price.trim()) { toast.error("請輸入票券名稱和價格"); return }
        setSaving(true); haptic.tap()
        const updated = [...localTickets, newTicket]
        if (await onUpdate("tickets", updated)) {
            setLocalTickets(updated)
            setNewTicket({ name: "", price: "", currency: DEFAULT_CURRENCY, note: "" })
            setAddingTicket(false)
            toast.success("已新增票券")
        }
        setSaving(false)
    }

    const handleRemoveTicket = async (idx: number) => {
        haptic.tap()
        const updated = localTickets.filter((_, i) => i !== idx)
        if (await onUpdate("tickets", updated)) {
            setLocalTickets(updated)
            toast.success("已移除")
        }
    }

    return (
        <div className="mx-5 mb-6 space-y-4">
            {/* ⚠️ Notes Section */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <AlertCircle className="w-4 h-4" />
                        <h4 className="text-sm font-bold">每日重點提醒</h4>
                    </div>
                    {!readOnly && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-100" onClick={() => setAddingNote(true)}>
                            <Plus className="w-3 h-3 mr-1" /> 新增
                        </Button>
                    )}
                </div>

                <div className="space-y-3">
                    {localNotes.map((note, idx) => (
                        <div key={idx} className="flex gap-3 items-start group">
                            <div className="text-lg leading-none mt-0.5">{note.icon || '⚠️'}</div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{note.title}</div>
                                <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 whitespace-pre-line">{note.content}</div>
                            </div>
                            {!readOnly && (
                                <button onClick={() => handleRemoveNote(idx)} className="p-1.5 text-slate-300 hover:text-red-500 active:text-red-600 transition-all touch-manipulation">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                    {localNotes.length === 0 && !addingNote && (
                        <p className="text-xs text-amber-600/60 dark:text-amber-400/60 italic text-center py-2">尚無提醒，點擊「新增」添加</p>
                    )}
                    {addingNote && (
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-amber-200 dark:border-amber-700 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex gap-2">
                                <select className="w-12 h-9 text-lg bg-transparent border border-slate-200 dark:border-slate-600 rounded" value={newNote.icon} onChange={(e) => setNewNote({ ...newNote, icon: e.target.value })}>
                                    {NOTE_ICONS.map(icon => <option key={icon} value={icon}>{icon}</option>)}
                                </select>
                                <Input placeholder="標題" className="flex-1 h-9 text-sm" value={newNote.title} onChange={(e) => setNewNote({ ...newNote, title: e.target.value })} />
                            </div>
                            <Input placeholder="內容..." className="h-9 text-sm" value={newNote.content} onChange={(e) => setNewNote({ ...newNote, content: e.target.value })} />
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setAddingNote(false)}>取消</Button>
                                <Button size="sm" onClick={handleAddNote} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-white"><Check className="w-3 h-3 mr-1" /> 確定</Button>
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
                            <h4 className="text-sm font-bold">預估花費</h4>
                        </div>
                        {!readOnly && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100" onClick={() => setAddingCost(true)}>
                                <Plus className="w-3 h-3 mr-1" /> 新增
                            </Button>
                        )}
                    </div>

                    <div className="flex-1 space-y-2">
                        {localCosts.map((cost, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-700 last:border-0 pb-2 last:pb-0 group">
                                <span className="text-slate-600 dark:text-slate-400 font-medium">{cost.item}</span>
                                <div className="flex items-center gap-2">
                                    <div className="text-right">
                                        <div className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(cost.amount, cost.currency)}</div>
                                        {cost.note && <div className="text-[10px] text-slate-400">{cost.note}</div>}
                                    </div>
                                    {!readOnly && (
                                        <button onClick={() => handleRemoveCost(idx)} className="p-1 text-slate-300 hover:text-red-500 active:text-red-600 transition-all touch-manipulation">
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Auto Sum Footer */}
                        {localCosts.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs text-slate-500">
                                <span className="flex items-center gap-1"><Calculator className="w-3 h-3" /> 小計</span>
                                <div className="flex gap-2">
                                    {Object.entries(costsTotal).map(([curr, total]) => (
                                        <span key={curr} className="font-mono font-bold text-slate-700 dark:text-slate-300">{curr} {total.toLocaleString()}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {localCosts.length === 0 && !addingCost && (
                            <p className="text-xs text-slate-400 italic text-center py-2">尚無花費記錄</p>
                        )}

                        {addingCost && (
                            <div className="bg-white dark:bg-slate-700 rounded-lg p-2 border border-slate-200 dark:border-slate-600 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex gap-2">
                                    <Input placeholder="項目" className="flex-1 h-8 text-xs" value={newCost.item} onChange={(e) => setNewCost({ ...newCost, item: e.target.value })} />
                                    <div className="flex gap-1 w-32">
                                        <select className="h-8 text-xs bg-slate-50 border rounded w-[4.5rem]" value={newCost.currency} onChange={e => setNewCost({ ...newCost, currency: e.target.value })}>
                                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <Input placeholder="金額" className="flex-1 h-8 text-xs" type="number" value={newCost.amount} onChange={(e) => setNewCost({ ...newCost, amount: e.target.value })} />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Input placeholder="備註 (選填)" className="flex-1 h-8 text-xs" value={newCost.note} onChange={(e) => setNewCost({ ...newCost, note: e.target.value })} />
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
                            <h4 className="text-sm font-bold">交通票券</h4>
                        </div>
                        {!readOnly && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100" onClick={() => setAddingTicket(true)}>
                                <Plus className="w-3 h-3 mr-1" /> 新增
                            </Button>
                        )}
                    </div>

                    <div className="flex-1 space-y-2">
                        {localTickets.map((ticket, idx) => (
                            <div key={idx} className="bg-white/60 dark:bg-slate-800/60 rounded-lg p-2 text-sm border border-blue-100 dark:border-blue-800 group">
                                <div className="font-bold text-slate-800 dark:text-slate-200 flex justify-between">
                                    <span>{ticket.name}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-blue-600 dark:text-blue-400">{formatCurrency(ticket.price, ticket.currency)}</span>
                                        {!readOnly && (
                                            <button onClick={() => handleRemoveTicket(idx)} className="p-1 text-slate-300 hover:text-red-500 active:text-red-600 transition-all touch-manipulation">
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {ticket.note && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{ticket.note}</div>}
                            </div>
                        ))}

                        {/* Auto Sum Footer */}
                        {localTickets.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs text-slate-500">
                                <span className="flex items-center gap-1"><Calculator className="w-3 h-3" /> 小計</span>
                                <div className="flex gap-2">
                                    {Object.entries(ticketsTotal).map(([curr, total]) => (
                                        <span key={curr} className="font-mono font-bold text-blue-700 dark:text-blue-300">{curr} {total.toLocaleString()}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {localTickets.length === 0 && !addingTicket && (
                            <p className="text-xs text-blue-400/60 italic text-center py-2">尚無票券記錄</p>
                        )}

                        {addingTicket && (
                            <div className="bg-white dark:bg-slate-700 rounded-lg p-2 border border-blue-200 dark:border-blue-700 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex gap-2">
                                    <Input placeholder="票券名稱" className="flex-1 h-8 text-xs" value={newTicket.name} onChange={(e) => setNewTicket({ ...newTicket, name: e.target.value })} />
                                    <div className="flex gap-1 w-32">
                                        <select className="h-8 text-xs bg-slate-50 border rounded w-[4.5rem]" value={newTicket.currency} onChange={e => setNewTicket({ ...newTicket, currency: e.target.value })}>
                                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <Input placeholder="金額" className="flex-1 h-8 text-xs" type="number" value={newTicket.price} onChange={(e) => setNewTicket({ ...newTicket, price: e.target.value })} />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Input placeholder="備註 (選填)" className="flex-1 h-8 text-xs" value={newTicket.note} onChange={(e) => setNewTicket({ ...newTicket, note: e.target.value })} />
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
