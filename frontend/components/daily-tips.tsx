"use client"

import { AlertCircle, Wallet, Ticket, Info } from "lucide-react"

interface DailyTipsProps {
    day: number
    notes?: any[]
    costs?: any[]
    tickets?: any[]
}

export default function DailyTips({ day, notes, costs, tickets }: DailyTipsProps) {
    // 如果沒有任何資料就不顯示
    if ((!notes || notes.length === 0) && (!costs || costs.length === 0) && (!tickets || tickets.length === 0)) {
        return null
    }

    return (
        <div className="mx-5 mb-6 space-y-4">
            {/* ⚠️ 每日注意事項 */}
            {notes && notes.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3 text-amber-700">
                        <AlertCircle className="w-4 h-4" />
                        <h4 className="text-sm font-bold">每日重點提醒</h4>
                    </div>
                    <div className="space-y-3">
                        {notes.map((note, idx) => (
                            <div key={idx} className="flex gap-3 items-start">
                                <div className="text-lg leading-none mt-0.5">{note.icon || '⚠️'}</div>
                                <div>
                                    <div className="text-sm font-bold text-slate-800">{note.title}</div>
                                    <div className="text-xs text-slate-600 mt-0.5 whitespace-pre-line">{note.content}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 💰 預估花費 */}
                {costs && costs.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3 text-slate-600">
                            <Wallet className="w-4 h-4" />
                            <h4 className="text-sm font-bold">預估花費</h4>
                        </div>
                        <div className="space-y-2">
                            {costs.map((cost, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                                    <span className="text-slate-600 font-medium">{cost.item}</span>
                                    <div className="text-right">
                                        <div className="font-bold text-slate-800">{cost.amount}</div>
                                        {cost.note && <div className="text-[10px] text-slate-400">{cost.note}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 🎫 交通票券 */}
                {tickets && tickets.length > 0 && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3 text-blue-700">
                            <Ticket className="w-4 h-4" />
                            <h4 className="text-sm font-bold">交通票券</h4>
                        </div>
                        <div className="space-y-2">
                            {tickets.map((ticket, idx) => (
                                <div key={idx} className="bg-white/60 rounded-lg p-2 text-sm border border-blue-100">
                                    <div className="font-bold text-slate-800 flex justify-between">
                                        {ticket.name}
                                        <span className="text-blue-600">{ticket.price}</span>
                                    </div>
                                    {ticket.note && <div className="text-xs text-slate-500 mt-1">{ticket.note}</div>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
