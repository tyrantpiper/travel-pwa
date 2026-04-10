"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

interface Member {
    name: string
}

interface Expense {
    title: string
    amount_twd: number
    original_amount: number
    currency: string
    payer_name: string
    notes: string | null
    date: string
}

interface LedgerData {
    trip_name: string
    date_range: { start: string; end: string }
    total_twd: number
    expenses: Expense[]
    members: Member[]
}

export function LedgerClient({ code }: { code: string }) {
    const [data, setData] = useState<LedgerData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    useEffect(() => {
        if (!code) return

        const fetchLedger = async () => {
            try {
                const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
                const res = await fetch(`${API_BASE}/api/ledger/${code}`)
                if (!res.ok) {
                    throw new Error("Not Found")
                }
                const result = await res.json()
                setData(result)
            } catch (err) {
                console.error(err)
                setError(true)
            } finally {
                setLoading(false)
            }
        }

        fetchLedger()
    }, [code])

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                <p className="text-slate-500 text-sm">Loading ledger data...</p>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-sm w-full">
                    <div className="text-4xl mb-4">🔗</div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">連結已失效</h2>
                    <p className="text-slate-500 text-sm">
                        此公帳分享連結可能已被收回，或行程已刪除。請向行程建立者索取新連結。
                    </p>
                </div>
            </div>
        )
    }

    const { trip_name, date_range, total_twd, expenses, members } = data
    const memberNames = members.map(m => m.name).join('、')

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-md mx-auto p-4 sm:p-6 pb-20">
                <div className="mb-8 mt-6">
                    <h1 className="text-2xl font-bold text-slate-900 mb-1">
                        🧾 {trip_name}
                    </h1>
                    <div className="text-sm border bg-slate-50 rounded-lg p-3 mt-4 space-y-1">
                        <p className="text-slate-600 flex items-center justify-between">
                            <span>📅 日期</span>
                            <span className="font-medium text-slate-800">
                                {date_range.start || "未定"} ～ {date_range.end || "未定"}
                            </span>
                        </p>
                        <p className="text-slate-600 flex items-center justify-between">
                            <span>👥 成員</span>
                            <span className="font-medium text-slate-800 max-w-[60%] truncate text-right">
                                {memberNames || "無"}
                            </span>
                        </p>
                    </div>
                </div>

                <div className="bg-slate-900 rounded-2xl p-5 mb-8 shadow-lg text-white selection:bg-indigo-500/30">
                    <p className="text-slate-300 text-sm mb-1 font-medium tracking-wide">💰 總花費</p>
                    <p className="text-4xl font-extrabold tracking-tight">
                        NT$ {total_twd.toLocaleString()}
                    </p>
                </div>

                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span>明細列表</span>
                        <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-medium">
                            {expenses.length} 筆
                        </span>
                    </h2>

                    {expenses.length === 0 ? (
                        <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <p className="text-slate-400 text-sm">目前尚無公開帳目</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {expenses.map((expense, idx) => (
                                <div key={idx} className="p-4 rounded-xl border border-slate-100 shadow-sm bg-white hover:border-slate-200 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1 pr-3">
                                            <h3 className="font-bold text-slate-800 leading-tight">
                                                {expense.title}
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {expense.date || "未指定日期"}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-bold text-slate-900 text-lg tabular-nums">
                                                NT${expense.amount_twd.toLocaleString()}
                                            </p>
                                            {expense.currency !== 'TWD' && (
                                                <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums uppercase">
                                                    {expense.currency} {expense.original_amount.toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-slate-50 mt-1">
                                        <div className="flex items-center gap-1.5 opacity-80">
                                            <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                                                {expense.payer_name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-xs text-slate-600 font-medium">
                                                {expense.payer_name} 先付
                                            </span>
                                        </div>
                                        {expense.notes && (
                                            <p className="text-xs text-slate-400 truncate max-w-[50%] bg-slate-50 px-2 py-0.5 rounded">
                                                {expense.notes}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-12 mb-6 pt-6 border-t border-slate-100 text-center">
                    <p className="text-sm font-medium text-slate-900 mb-1">🤖 想知道怎麼分最準確嗎？</p>
                    <p className="text-xs text-slate-500 mb-4 transition-colors">
                        使用 Ryan Travel App 的「AI 一鍵精算」功能
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer">
                        了解更多
                    </div>
                </div>
            </div>
        </div>
    )
}
