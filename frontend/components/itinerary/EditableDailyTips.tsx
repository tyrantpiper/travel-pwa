"use client"

import { useState } from "react"
import { AlertCircle, Wallet, Ticket, Plus, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useHaptic } from "@/lib/hooks"
import { toast } from "sonner"

// Types
interface NoteItem {
    icon?: string
    title: string
    content: string
}

interface CostItem {
    item: string
    amount: string
    note?: string
}

interface TicketItem {
    name: string
    price: string
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

// Emoji picker for notes
const NOTE_ICONS = ["⚠️", "✈️", "🚇", "🏨", "🍽️", "🎫", "💡", "📍", "⏰", "🎒"]

export default function EditableDailyTips({
    tripId: _tripId,  // Reserved for future direct API calls
    day: _day,        // Reserved for future direct API calls
    notes,
    costs,
    tickets,
    onUpdate,
    readOnly = false
}: EditableDailyTipsProps) {
    const haptic = useHaptic()

    // Local state for editing
    const [localNotes, setLocalNotes] = useState<NoteItem[]>(notes || [])
    const [localCosts, setLocalCosts] = useState<CostItem[]>(costs || [])
    const [localTickets, setLocalTickets] = useState<TicketItem[]>(tickets || [])

    // Adding new item state
    const [addingNote, setAddingNote] = useState(false)
    const [addingCost, setAddingCost] = useState(false)
    const [addingTicket, setAddingTicket] = useState(false)

    // New item forms
    const [newNote, setNewNote] = useState<NoteItem>({ icon: "⚠️", title: "", content: "" })
    const [newCost, setNewCost] = useState<CostItem>({ item: "", amount: "", note: "" })
    const [newTicket, setNewTicket] = useState<TicketItem>({ name: "", price: "", note: "" })

    // Saving state
    const [saving, setSaving] = useState(false)

    // === Notes Section ===
    const handleAddNote = async () => {
        if (!newNote.title.trim()) {
            toast.error("請輸入標題")
            return
        }
        setSaving(true)
        haptic.tap()
        const updated = [...localNotes, newNote]
        const success = await onUpdate("notes", updated)
        if (success) {
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
        const success = await onUpdate("notes", updated)
        if (success) {
            setLocalNotes(updated)
            toast.success("已移除")
        }
    }

    // === Costs Section ===
    const handleAddCost = async () => {
        if (!newCost.item.trim() || !newCost.amount.trim()) {
            toast.error("請輸入項目和金額")
            return
        }
        setSaving(true)
        haptic.tap()
        const updated = [...localCosts, newCost]
        const success = await onUpdate("costs", updated)
        if (success) {
            setLocalCosts(updated)
            setNewCost({ item: "", amount: "", note: "" })
            setAddingCost(false)
            toast.success("已新增花費")
        }
        setSaving(false)
    }

    const handleRemoveCost = async (idx: number) => {
        haptic.tap()
        const updated = localCosts.filter((_, i) => i !== idx)
        const success = await onUpdate("costs", updated)
        if (success) {
            setLocalCosts(updated)
            toast.success("已移除")
        }
    }

    // === Tickets Section ===
    const handleAddTicket = async () => {
        if (!newTicket.name.trim() || !newTicket.price.trim()) {
            toast.error("請輸入票券名稱和價格")
            return
        }
        setSaving(true)
        haptic.tap()
        const updated = [...localTickets, newTicket]
        const success = await onUpdate("tickets", updated)
        if (success) {
            setLocalTickets(updated)
            setNewTicket({ name: "", price: "", note: "" })
            setAddingTicket(false)
            toast.success("已新增票券")
        }
        setSaving(false)
    }

    const handleRemoveTicket = async (idx: number) => {
        haptic.tap()
        const updated = localTickets.filter((_, i) => i !== idx)
        const success = await onUpdate("tickets", updated)
        if (success) {
            setLocalTickets(updated)
            toast.success("已移除")
        }
    }

    return (
        <div className="mx-5 mb-6 space-y-4">
            {/* ⚠️ 每日重點提醒 */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <AlertCircle className="w-4 h-4" />
                        <h4 className="text-sm font-bold">每日重點提醒</h4>
                    </div>
                    {!readOnly && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                            onClick={() => setAddingNote(true)}
                        >
                            <Plus className="w-3 h-3 mr-1" /> 新增
                        </Button>
                    )}
                </div>

                {/* Notes list */}
                <div className="space-y-3">
                    {localNotes.map((note, idx) => (
                        <div key={idx} className="flex gap-3 items-start group">
                            <div className="text-lg leading-none mt-0.5">{note.icon || '⚠️'}</div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{note.title}</div>
                                <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 whitespace-pre-line">{note.content}</div>
                            </div>
                            {!readOnly && (
                                <button
                                    onClick={() => handleRemoveNote(idx)}
                                    className="p-1.5 text-slate-300 hover:text-red-500 active:text-red-600 transition-all touch-manipulation"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}

                    {/* Empty state */}
                    {localNotes.length === 0 && !addingNote && (
                        <p className="text-xs text-amber-600/60 dark:text-amber-400/60 italic text-center py-2">
                            尚無提醒，點擊「新增」添加
                        </p>
                    )}

                    {/* Add new note form */}
                    {addingNote && (
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-amber-200 dark:border-amber-700 space-y-2">
                            <div className="flex gap-2">
                                <select
                                    className="w-12 h-9 text-lg bg-transparent border border-slate-200 dark:border-slate-600 rounded"
                                    value={newNote.icon}
                                    onChange={(e) => setNewNote({ ...newNote, icon: e.target.value })}
                                >
                                    {NOTE_ICONS.map(icon => (
                                        <option key={icon} value={icon}>{icon}</option>
                                    ))}
                                </select>
                                <Input
                                    placeholder="標題 (如：入境提醒)"
                                    className="flex-1 h-9 text-sm"
                                    value={newNote.title}
                                    onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                                />
                            </div>
                            <Input
                                placeholder="說明內容..."
                                className="h-9 text-sm"
                                value={newNote.content}
                                onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                            />
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setAddingNote(false)}>取消</Button>
                                <Button size="sm" onClick={handleAddNote} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-white">
                                    <Check className="w-3 h-3 mr-1" /> 確定
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom grid: Costs & Tickets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 💰 預估花費 */}
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Wallet className="w-4 h-4" />
                            <h4 className="text-sm font-bold">預估花費</h4>
                        </div>
                        {!readOnly && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                                onClick={() => setAddingCost(true)}
                            >
                                <Plus className="w-3 h-3 mr-1" /> 新增
                            </Button>
                        )}
                    </div>

                    <div className="space-y-2">
                        {localCosts.map((cost, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-700 last:border-0 pb-2 last:pb-0 group">
                                <span className="text-slate-600 dark:text-slate-400 font-medium">{cost.item}</span>
                                <div className="flex items-center gap-2">
                                    <div className="text-right">
                                        <div className="font-bold text-slate-800 dark:text-slate-200">{cost.amount}</div>
                                        {cost.note && <div className="text-[10px] text-slate-400">{cost.note}</div>}
                                    </div>
                                    {!readOnly && (
                                        <button
                                            onClick={() => handleRemoveCost(idx)}
                                            className="p-1 text-slate-300 hover:text-red-500 active:text-red-600 transition-all touch-manipulation"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {localCosts.length === 0 && !addingCost && (
                            <p className="text-xs text-slate-400 italic text-center py-2">
                                尚無花費記錄
                            </p>
                        )}

                        {addingCost && (
                            <div className="bg-white dark:bg-slate-700 rounded-lg p-2 border border-slate-200 dark:border-slate-600 space-y-2">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="項目"
                                        className="flex-1 h-8 text-xs"
                                        value={newCost.item}
                                        onChange={(e) => setNewCost({ ...newCost, item: e.target.value })}
                                    />
                                    <Input
                                        placeholder="¥1,200"
                                        className="w-24 h-8 text-xs"
                                        value={newCost.amount}
                                        onChange={(e) => setNewCost({ ...newCost, amount: e.target.value })}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="備註 (選填)"
                                        className="flex-1 h-8 text-xs"
                                        value={newCost.note}
                                        onChange={(e) => setNewCost({ ...newCost, note: e.target.value })}
                                    />
                                    <Button size="sm" className="h-8 px-2" onClick={handleAddCost} disabled={saving}>
                                        <Check className="w-3 h-3" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setAddingCost(false)}>
                                        <X className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 🎫 交通票券 */}
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                            <Ticket className="w-4 h-4" />
                            <h4 className="text-sm font-bold">交通票券</h4>
                        </div>
                        {!readOnly && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                                onClick={() => setAddingTicket(true)}
                            >
                                <Plus className="w-3 h-3 mr-1" /> 新增
                            </Button>
                        )}
                    </div>

                    <div className="space-y-2">
                        {localTickets.map((ticket, idx) => (
                            <div key={idx} className="bg-white/60 dark:bg-slate-800/60 rounded-lg p-2 text-sm border border-blue-100 dark:border-blue-800 group">
                                <div className="font-bold text-slate-800 dark:text-slate-200 flex justify-between">
                                    <span>{ticket.name}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-blue-600 dark:text-blue-400">{ticket.price}</span>
                                        {!readOnly && (
                                            <button
                                                onClick={() => handleRemoveTicket(idx)}
                                                className="p-1 text-slate-300 hover:text-red-500 active:text-red-600 transition-all touch-manipulation"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {ticket.note && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{ticket.note}</div>}
                            </div>
                        ))}

                        {localTickets.length === 0 && !addingTicket && (
                            <p className="text-xs text-blue-400/60 italic text-center py-2">
                                尚無票券記錄
                            </p>
                        )}

                        {addingTicket && (
                            <div className="bg-white dark:bg-slate-700 rounded-lg p-2 border border-blue-200 dark:border-blue-700 space-y-2">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="票券名稱"
                                        className="flex-1 h-8 text-xs"
                                        value={newTicket.name}
                                        onChange={(e) => setNewTicket({ ...newTicket, name: e.target.value })}
                                    />
                                    <Input
                                        placeholder="¥1,200"
                                        className="w-24 h-8 text-xs"
                                        value={newTicket.price}
                                        onChange={(e) => setNewTicket({ ...newTicket, price: e.target.value })}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="備註 (選填)"
                                        className="flex-1 h-8 text-xs"
                                        value={newTicket.note}
                                        onChange={(e) => setNewTicket({ ...newTicket, note: e.target.value })}
                                    />
                                    <Button size="sm" className="h-8 px-2 bg-blue-500 hover:bg-blue-600" onClick={handleAddTicket} disabled={saving}>
                                        <Check className="w-3 h-3" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setAddingTicket(false)}>
                                        <X className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
