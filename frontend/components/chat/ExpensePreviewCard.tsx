"use client"

import { useState } from "react"
import { Receipt, Check, Loader2, X, Calendar, Wallet, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useTripContext } from "@/lib/trip-context"
import { expensesApi } from "@/lib/api"
import { useLanguage } from "@/lib/LanguageContext"
import { useSWRConfig } from "swr"

export interface ExpenseData {
    title: string
    amount: number
    day: number
    currency?: string
    category?: string
    payment_method?: string
    expense_date?: string
    notes?: string
    items?: { original_name: string; translated_name?: string; amount: number }[]
}

interface ExpensePreviewCardProps {
    expenseData: ExpenseData
    onDismiss?: () => void
}

/**
 * 🧾 擬真電子發票/收據風預覽卡片
 */
export default function ExpensePreviewCard({ expenseData, onDismiss }: ExpensePreviewCardProps) {
    const { activeTripId, activeTrip, userId } = useTripContext()
    const { mutate: globalMutate } = useSWRConfig()
    const { lang } = useLanguage()
    const zh = lang === 'zh'
    
    const [isAdding, setIsAdding] = useState(false)
    const [isAdded, setIsAdded] = useState(false)
    const [isDismissed, setIsDismissed] = useState(false)

    // 🟢 [極致對齊] 動態計算日期：結合 start_date 與 1-indexed day
    const getExpenseDate = () => {
        const startStr = activeTrip?.start_date
        if (!startStr) return new Date().toISOString().split('T')[0]
        try {
            const baseDate = new Date(startStr)
            if (isNaN(baseDate.getTime())) return new Date().toISOString().split('T')[0]
            const offsetDays = Math.max(0, expenseData.day - 1)
            const targetDate = new Date(baseDate.getTime() + offsetDays * 24 * 60 * 60 * 1000)
            return targetDate.toISOString().split('T')[0]
        } catch {
            return new Date().toISOString().split('T')[0]
        }
    }

    const handleConfirmExpense = async () => {
        if (!activeTripId) {
            toast.error(zh ? "請先選擇一個行程" : "Please select a trip first")
            return
        }
        setIsAdding(true)
        try {
            const targetDate = getExpenseDate()
            await expensesApi.create({
                itinerary_id: activeTripId,
                title: expenseData.title,
                amount_jpy: expenseData.amount,
                total_amount: expenseData.amount,
                currency: expenseData.currency || "JPY",
                category: expenseData.category || "其他",
                payment_method: expenseData.payment_method || "現金",
                expense_date: targetDate,
                notes: expenseData.notes || "",
                items: expenseData.items,
            }, userId || undefined)

            setIsAdded(true)
            toast.success(zh ? `💰 記帳成功：${expenseData.title}` : `💰 Expense saved: ${expenseData.title}`)

            // 🟢 即時 invalidate 費用清單 SWR 快取，消除快取空洞
            if (userId) {
                globalMutate([`/api/trips/${activeTripId}/expenses`, userId])
            }
        } catch (error) {
            console.error("Create expense failed:", error)
            toast.error(zh ? "記帳失敗，請重試" : "Failed to record expense, please try again")
        } finally {
            setIsAdding(false)
        }
    }

    if (isDismissed) return null

    return (
        <div className={cn(
            "relative overflow-hidden rounded-xl border-2 shadow-sm my-2 max-w-sm transition-all duration-300",
            isAdded ? "border-green-300 bg-green-50/50" : "border-amber-200 bg-amber-50/20"
        )}>
            {/* 🧾 票券頂部漸層條 */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />

            <div className="p-4 pt-5 space-y-3">
                {/* 標題與排除按鈕 */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                            <Receipt className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {zh ? "記帳預覽" : "Expense Receipt"}
                        </span>
                    </div>
                    {!isAdded && (
                        <button 
                            onClick={() => {
                                setIsDismissed(true)
                                onDismiss?.()
                            }} 
                            className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-full hover:bg-slate-100"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* 發票紙張撕裂設計 */}
                <div className="border-t border-dashed border-slate-200 my-2 pt-2 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-700">{expenseData.title}</span>
                        <span className="text-lg font-black text-amber-600">
                            {expenseData.currency || "JPY"} {expenseData.amount.toLocaleString()}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-y-1.5 text-xs text-slate-500 pt-1">
                        <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>Day {expenseData.day} ({getExpenseDate()})</span>
                        </div>
                        <div className="flex items-center gap-1 justify-end">
                            <Wallet className="w-3 h-3 text-slate-400" />
                            <span>{expenseData.payment_method || (zh ? "現金" : "Cash")}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Tag className="w-3 h-3 text-slate-400" />
                            <span>{expenseData.category || (zh ? "其他" : "Other")}</span>
                        </div>
                    </div>
                </div>

                {/* 操作按鈕 */}
                <div className="flex gap-2 pt-1">
                    {isAdded ? (
                        <div className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold text-green-700 bg-green-100 rounded-lg">
                            <Check className="w-4 h-4" />
                            {zh ? "已記入帳本" : "Recorded to Ledger"}
                        </div>
                    ) : (
                        <Button
                            size="sm"
                            className="w-full h-8 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-all active:scale-95 gap-1.5"
                            disabled={isAdding}
                            onClick={handleConfirmExpense}
                        >
                            {isAdding ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    {zh ? "寫入帳本中..." : "Recording..."}
                                </>
                            ) : (
                                <>
                                    <Check className="w-3.5 h-3.5" />
                                    {zh ? "確認記帳" : "Confirm Expense"}
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}

/**
 * 🧠 智能記帳工具呼叫提取器
 */
export function extractExpenseFunctionCall(rawParts: unknown[]): ExpenseData | null {
    if (!rawParts || !Array.isArray(rawParts)) return null

    for (const part of rawParts) {
        if (part && typeof part === 'object') {
            const partObj = part as {
                functionCall?: { name: string; args?: Record<string, unknown> }
                function_call?: { name: string; args?: Record<string, unknown> }
            }
            const fc = partObj.functionCall || partObj.function_call
            if (fc && fc.name === "add_expense") {
                const args = fc.args || {}
                const dayVal = args.day ?? args.day_number ?? args.dayNumber ?? 1
                const amountVal = args.amount ?? args.amount_jpy ?? args.total_amount ?? 0
                return {
                    title: String(args.title || args.name || ""),
                    amount: typeof amountVal === "number" ? amountVal : parseFloat(String(amountVal)) || 0,
                    day: typeof dayVal === "number" ? dayVal : parseInt(String(dayVal)) || 1,
                    currency: String(args.currency || "JPY"),
                    category: String(args.category || "其他"),
                    payment_method: String(args.payment_method || "現金"),
                    expense_date: String(args.expense_date || args.date || ""),
                    notes: String(args.notes || args.desc || args.description || "")
                }
            }
        }
    }
    return null
}
