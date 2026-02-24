"use client"

import { useState, useEffect, useRef, ComponentType } from "react"
import {
    Loader2,
    Wallet, CreditCard, Train, Utensils, ShoppingBag, Bed, Ticket, Receipt,
    Users, User, CheckCircle2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ImageUpload } from "@/components/ui/image-upload"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useLanguage } from "@/lib/LanguageContext"
import { useHaptic } from "@/lib/hooks"
import { getExchangeRate } from "@/lib/currency"
import { expensesApi } from "@/lib/api"

// Shared Constants (Sync with ToolsView)
const PAYMENT_METHODS = [
    { id: "Cash", label: "Cash", icon: Wallet, color: "text-green-600" },
    { id: "Suica", label: "Suica", icon: Train, color: "text-teal-600" },
    { id: "JCB", label: "JCB", icon: CreditCard, color: "text-blue-600" },
    { id: "VisaMaster", label: "Visa/MC", icon: CreditCard, color: "text-orange-600" },
]

const CATEGORIES: Record<string, { label: string; icon: ComponentType<{ className?: string }>; color: string }> = {
    food: { label: "Food", icon: Utensils, color: "bg-orange-100 text-orange-600" },
    transport: { label: "Transport", icon: Train, color: "bg-teal-100 text-teal-600" },
    shopping: { label: "Shopping", icon: ShoppingBag, color: "bg-pink-100 text-pink-600" },
    hotel: { label: "Hotel", icon: Bed, color: "bg-indigo-100 text-indigo-600" },
    ticket: { label: "Ticket", icon: Ticket, color: "bg-purple-100 text-purple-600" },
    general: { label: "Other", icon: Receipt, color: "bg-slate-100 text-slate-600" },
}

const CURRENCIES = [
    { code: 'JPY', symbol: '¥', name: '日幣', flag: '🇯🇵' },
    { code: 'USD', symbol: '$', name: '美元', flag: '🇺🇸' },
    { code: 'EUR', symbol: '€', name: '歐元', flag: '🇪🇺' },
    { code: 'KRW', symbol: '₩', name: '韓圓', flag: '🇰🇷' },
    { code: 'CNY', symbol: '¥', name: '人民幣', flag: '🇨🇳' },
    { code: 'THB', symbol: '฿', name: '泰銖', flag: '🇹🇭' },
    { code: 'SGD', symbol: 'S$', name: '新幣', flag: '🇸🇬' },
    { code: 'HKD', symbol: 'HK$', name: '港幣', flag: '🇭🇰' },
    { code: 'TWD', symbol: 'NT$', name: '台幣', flag: '🇹🇼' },
] as const

interface Expense {
    id: string
    title: string
    amount: number
    payment_method?: string
    category?: string
    is_public: boolean
    image_url?: string
    expense_date?: string
    incurred_at?: string
    created_at?: string
    exchange_rate?: number
    cashback_rate?: number
    currency?: string
    trip_id?: string
    card_name?: string
    creator_name?: string
}

interface Trip {
    id: string
    title: string
    start_date?: string
    end_date?: string
    days?: unknown[]
}

interface ExpenseDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    editItem: Expense | null
    activeTripId: string | null
    activeTrip: Trip | null
    selectedCurrency: string | null
    onSaveSuccess: (targetDate: string) => void
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export function ExpenseDialog({
    open,
    onOpenChange,
    editItem,
    activeTripId,
    activeTrip,
    selectedCurrency,
    onSaveSuccess
}: ExpenseDialogProps) {
    const { t } = useLanguage()
    const haptic = useHaptic()

    // Internal Form State
    const [title, setTitle] = useState("")
    const [amountJPY, setAmountJPY] = useState("")
    const [method, setMethod] = useState("Cash")
    const [category, setCategory] = useState("general")
    const [isPublic, setIsPublic] = useState(true)
    const [cardName, setCardName] = useState("")
    const [cashback, setCashback] = useState("")
    const [receiptUrl, setReceiptUrl] = useState("")
    const [expenseDate, setExpenseDate] = useState("")
    const [isSavingExpense, setIsSavingExpense] = useState(false)
    const [inputCurrency, setInputCurrency] = useState("JPY")
    const [inputRate, setInputRate] = useState(0.22)

    // 🛡️ Guard: 防止 useEffect 在 dialog 開啟中重複初始化
    const formInitializedRef = useRef(false)
    // 🛡️ 編輯模式下跳過匯率自動 fetch（使用原始存儲匯率）
    const skipRateFetchRef = useRef(false)

    // Reset form when dialog opens or editItem changes
    useEffect(() => {
        if (open) {
            // 🛡️ Bug #1 Fix: 如果表單已初始化，跳過重複初始化（防止 activeTrip 變化覆蓋用戶選擇）
            if (formInitializedRef.current) return
            formInitializedRef.current = true

            if (editItem) {
                setTitle(editItem.title)
                setAmountJPY(editItem.amount.toString())
                setMethod(editItem.payment_method || "Cash")
                setCategory(editItem.category || "general")
                setIsPublic(editItem.is_public)
                setCardName(editItem.card_name || "")
                setCashback(editItem.cashback_rate?.toString() || "")
                setReceiptUrl(editItem.image_url || "")
                // 🆕 Safe date parsing — 🛡️ 防禦 ISO 時間戳
                const rawDate = editItem.expense_date || editItem.created_at || ''
                const dbDate = rawDate.split('T')[0]
                setExpenseDate(dbDate || formatLocalDate(new Date()))
                setInputCurrency(editItem.currency || "JPY")
                // 🛡️ Bug #4 Fix: 復原存儲匯率，跳過自動 fetch
                if (editItem.exchange_rate) {
                    skipRateFetchRef.current = true
                    setInputRate(editItem.exchange_rate)
                }
            } else {
                setTitle("")
                setAmountJPY("")
                setMethod("Cash")
                setCategory("general")
                setIsPublic(true)
                setCardName("")
                setCashback("")
                setReceiptUrl("")

                // 🆕 Smart Initialization for Date Drift Fix
                const todayStr = formatLocalDate(new Date())
                if (activeTrip?.start_date) {
                    const start = (activeTrip.start_date || '').split('T')[0]
                    const end = (activeTrip.end_date || activeTrip.start_date || '').split('T')[0]

                    // If today is before trip or after trip, default to Trip Start
                    if (todayStr < start || todayStr > end) {
                        console.log(`[Expense] Today (${todayStr}) is outside trip range (${start} to ${end}). Defaulting to ${start}`)
                        setExpenseDate(start)
                    } else {
                        setExpenseDate(todayStr)
                    }
                } else {
                    setExpenseDate(todayStr)
                }

                setInputCurrency(selectedCurrency || "JPY")
            }
        } else {
            // 🛡️ Dialog 關閉時重置 flag，確保下次開啟正常初始化
            formInitializedRef.current = false
        }
    }, [open, editItem, selectedCurrency, activeTrip])

    // Update rate when inputCurrency changes
    useEffect(() => {
        // 🛡️ Bug #4 Fix: 編輯模式首次載入時跳過（使用原始匯率）
        if (skipRateFetchRef.current) {
            skipRateFetchRef.current = false
            return
        }
        const updateRate = async () => {
            const r = await getExchangeRate(inputCurrency)
            setInputRate(r)
        }
        updateRate()
    }, [inputCurrency])

    const formatLocalDate = (d: Date): string => {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    const handleSaveExpense = async () => {
        if (isSavingExpense) return
        haptic.tap()

        const userId = localStorage.getItem("user_uuid")
        const userName = localStorage.getItem("user_nickname")
        if (!amountJPY || !title) {
            toast.error("Please fill in amount and title")
            haptic.error()
            return
        }

        if (!activeTripId) return
        setIsSavingExpense(true)

        const rateNum = parseFloat(cashback) || 0
        const payload = {
            itinerary_id: activeTripId,
            title,
            amount_jpy: parseFloat(amountJPY) || 0,  // 🛡️ Bug #6 Fix: parseFloat 保留非日幣小數
            exchange_rate: inputRate,
            currency: inputCurrency,
            payment_method: method,
            category: category,
            is_public: isPublic,
            created_by: userId,
            creator_name: userName,
            card_name: method === "JCB" || method === "VisaMaster" ? cardName : "",
            cashback_rate: method === "JCB" || method === "VisaMaster" ? rateNum : 0,
            image_url: receiptUrl || null,
            expense_date: expenseDate || formatLocalDate(new Date())
        }

        // 🛡️ Bug #2 Fix: 使用 expensesApi（含 offlineFetch 離線佇列）替代原生 fetch
        try {
            if (editItem) {
                await expensesApi.update(editItem.id, payload, userId || undefined)
            } else {
                await expensesApi.create(payload, userId || undefined)
            }
            haptic.success()
            toast.success(editItem ? "Updated" : "Saved")
            onOpenChange(false)
            onSaveSuccess(payload.expense_date)
        } catch (e) {
            haptic.error()
            toast.error(e instanceof Error ? `儲存失敗: ${e.message}` : "儲存失敗")
        } finally {
            setIsSavingExpense(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{editItem ? t('edit') : t('add')} {t('expense')}</DialogTitle>
                    <DialogDescription className="sr-only">
                        填寫消費資訊，包括金額、幣別、分類與付款方式。
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-5 py-2">
                    {/* 💰 Section 1: Amount Input (Hero Section) */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            💰 金額
                        </Label>

                        <Select value={inputCurrency} onValueChange={setInputCurrency}>
                            <SelectTrigger className="h-11 w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 font-bold text-base">
                                <SelectValue placeholder="選擇幣別" />
                            </SelectTrigger>
                            <SelectContent>
                                {CURRENCIES.map(c => (
                                    <SelectItem key={c.code} value={c.code} className="py-2.5">
                                        <span className="mr-2 text-lg">{c.flag}</span>
                                        <span className="font-mono font-bold">{c.code}</span>
                                        <span className="text-slate-400 ml-2">- {c.name}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="flex gap-3 items-stretch">
                            <div className="flex-1 relative">
                                <Input
                                    placeholder="0"
                                    type="number"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className="text-2xl font-mono font-bold h-12 text-center bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600"
                                    value={amountJPY}
                                    onChange={e => setAmountJPY(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl text-white whitespace-nowrap min-w-[8rem] justify-center font-bold shadow-lg">
                                <span className="text-emerald-200 text-xs mr-1">≈</span>
                                NT$ {Math.round((parseInt(amountJPY) || 0) * inputRate).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* 📝 Section 2: Basic Info */}
                    <div className="space-y-3">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            📝 明細
                        </Label>
                        <Input
                            placeholder="消費名稱"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="h-11 text-base"
                        />

                        {activeTrip?.start_date ? (
                            <select
                                value={expenseDate}
                                onChange={e => setExpenseDate(e.target.value)}
                                className="w-full h-11 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 font-medium"
                            >
                                {(() => {
                                    // 🆕 Caution: Use '/' replacement to force local timezone parsing (Fixes Phase 8 weekday drift)
                                    const startClean = (String(activeTrip.start_date!) || '').split('T')[0]
                                    const endClean = activeTrip.end_date ? (String(activeTrip.end_date) || '').split('T')[0] : null
                                    const startDate = new Date(startClean.replace(/-/g, '/'))
                                    const endDate = endClean ? new Date(endClean.replace(/-/g, '/')) : null
                                    const totalDays = activeTrip.days?.length ||
                                        (endDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 7)

                                    return Array.from({ length: totalDays }, (_, i) => {
                                        const date = new Date(startDate)
                                        date.setDate(date.getDate() + i)
                                        const dateStr = formatLocalDate(date)
                                        const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
                                        return (
                                            <option key={i} value={dateStr}>
                                                📅 Day {i + 1} ({date.getMonth() + 1}/{date.getDate()} {weekday})
                                            </option>
                                        )
                                    })
                                })()}
                            </select>
                        ) : (
                            <div className="text-xs text-slate-400 py-2 text-center bg-slate-50 rounded-lg">⚠️ 請先選擇行程</div>
                        )}
                    </div>

                    {/* 🏷️ Section 3: Category */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            🏷️ 分類
                        </Label>
                        <div className="grid grid-cols-3 gap-2">
                            {Object.entries(CATEGORIES).map(([key, info]) => (
                                <button
                                    key={key}
                                    onClick={() => setCategory(key)}
                                    className={cn(
                                        "flex items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 text-xs font-medium transition-all",
                                        category === key
                                            ? "border-slate-800 bg-slate-800 text-white shadow-md scale-105"
                                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400"
                                    )}
                                >
                                    <info.icon className="w-4 h-4" /> {info.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 💳 Section 4: Payment Method */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            💳 付款方式
                        </Label>
                        <div className="grid grid-cols-4 gap-2">
                            {PAYMENT_METHODS.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setMethod(m.id)}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-2.5 rounded-xl border-2 text-xs font-medium transition-all",
                                        method === m.id
                                            ? "border-slate-800 bg-slate-800 text-white shadow-md"
                                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                                    )}
                                >
                                    <m.icon className="w-5 h-5 mb-1" />{m.label}
                                </button>
                            ))}
                        </div>

                        {(method === "JCB" || method === "VisaMaster") && (
                            <div className="flex gap-2 mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                <Input placeholder="卡片名稱" value={cardName} onChange={e => setCardName(e.target.value)} className="flex-1" />
                                <Input placeholder="回饋%" value={cashback} onChange={e => setCashback(e.target.value)} className="w-20" />
                            </div>
                        )}
                    </div>

                    {/* 📸 Section 5: Receipt */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            📸 收據 / 照片
                        </Label>
                        <ImageUpload
                            value={receiptUrl}
                            onChange={(url) => setReceiptUrl(url)}
                            onRemove={() => setReceiptUrl("")}
                            folder="ryan_travel/receipts"
                        />
                    </div>

                    {/* 👥 Section 6: Visibility */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                        <Label className="text-sm font-medium flex items-center gap-2">
                            {isPublic ? <><Users className="w-5 h-5 text-blue-500" /> {t('shared')}</> : <><User className="w-5 h-5 text-amber-500" /> {t('private')}</>}
                        </Label>
                        <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                    </div>

                    <Button className="w-full h-12 bg-slate-900 text-white font-bold" onClick={handleSaveExpense} disabled={isSavingExpense}>
                        {isSavingExpense ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                        {t('save')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
