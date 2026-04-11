"use client"

import { useState, useEffect, useMemo, useRef, ComponentType } from "react"
import {
    Loader2, Plus, Trash, Sparkles, SmilePlus,
    Wallet, CreditCard, Train, Utensils, ShoppingBag, Bed, Ticket, Receipt,
    Users, User, CheckCircle2, Calendar, History
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Check, ChevronsUpDown } from "lucide-react"
import { ImageUpload } from "@/components/ui/image-upload"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useLanguage } from "@/lib/LanguageContext"
import { translations, TranslationKey } from "@/lib/i18n"
import { useHaptic } from "@/lib/hooks"
import { getExchangeRate, getAllSupportedCurrencies, type CurrencyInfo } from "@/lib/currency"
import { expensesApi, aiApi } from "@/lib/api"
import { debugLog } from "@/lib/debug"
import { ScrollArea } from "@/components/ui/scroll-area"

// Shared Constants
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




const isValidTranslationKey = (key: string): key is TranslationKey => key in translations.zh

const CURRENCIES: (CurrencyInfo & { symbol: string })[] = [
    { code: 'JPY', symbol: '¥', flag: '🇯🇵', countryCode: 'jp', name: 'Japanese Yen' },
    { code: 'USD', symbol: '$', flag: '🇺🇸', countryCode: 'us', name: 'United States Dollar' },
    { code: 'EUR', symbol: '€', flag: '🇪🇺', countryCode: 'eu', name: 'Euro' },
    { code: 'KRW', symbol: '₩', flag: '🇰🇷', countryCode: 'kr', name: 'South Korean Won' },
    { code: 'CNY', symbol: '¥', flag: '🇨🇳', countryCode: 'cn', name: 'Chinese Yuan' },
    { code: 'THB', symbol: '฿', flag: '🇹🇭', countryCode: 'th', name: 'Thai Baht' },
    { code: 'SGD', symbol: 'S$', flag: '🇸🇬', countryCode: 'sg', name: 'Singapore Dollar' },
    { code: 'HKD', symbol: 'HK$', flag: '🇭🇰', countryCode: 'hk', name: 'Hong Kong Dollar' },
    { code: 'TWD', symbol: 'NT$', flag: '🇹🇼', countryCode: 'tw', name: 'New Taiwan Dollar' },
]

// 🛡️ 關鍵修復：移除千分位逗號，解析為純數字，防止 API 傳輸時因字串格式導致截斷
const cleanAmount = (val: string | number | undefined | null): number => {
    if (typeof val === 'number') return val
    if (!val) return 0
    const cleaned = val.toString().replace(/,/g, '').trim()
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
}

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
    amount_jpy?: number
    items?: { original_name: string, translated_name?: string, amount: number }[]
    subtotal_amount?: number
    tax_amount?: number
    tip_amount?: number
    service_charge_amount?: number
    discount_amount?: number
    total_amount?: number
    diagnostics?: {
        status: 'pass' | 'warning'
        source: 'ai' | 'user'
        code?: string | null
        message?: string | null
        mismatch_amount?: number
    }
    custom_icon?: string | null
    notes?: string | null
    payer_id?: string | null
}

interface TripMember {
    user_id: string;
    user_name: string;
    user_avatar: string;
}

interface Trip {
    id: string
    title: string
    start_date?: string
    end_date?: string
    days?: unknown[]
    members?: TripMember[]
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

export function ExpenseDialog({
    open,
    onOpenChange,
    editItem,
    activeTripId,
    activeTrip,
    selectedCurrency,
    onSaveSuccess,
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
    const [items, setItems] = useState<{ original_name: string, translated_name?: string, amount: number }[]>([])
    const [breakdown, setBreakdown] = useState({
        subtotal: 0,
        tax: 0,
        tip: 0,
        service: 0,
        discount: 0
    })
    const [diagnostics, setDiagnostics] = useState<Expense['diagnostics']>(undefined)
    const [customIcon, setCustomIcon] = useState("")
    const [isEditingIcon, setIsEditingIcon] = useState(false)
    const [notes, setNotes] = useState("")
    const [payerId, setPayerId] = useState("")

    const [payerOpen, setPayerOpen] = useState(false)
    const [payerSearch, setPayerSearch] = useState("")
    const [isSavingExpense, setIsSavingExpense] = useState(false)
    const [isParsing, setIsParsing] = useState(false)
    const [inputCurrency, setInputCurrency] = useState("JPY")
    const [inputRate, setInputRate] = useState(0.22)
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const [parseResult, setParseResult] = useState<Partial<Expense> | null>(null)
    const [allCurrencies, setAllCurrencies] = useState<CurrencyInfo[]>([])
    const [currencySearch, setCurrencySearch] = useState("")
    const [deferredShow, setDeferredShow] = useState(false) // 🆕 Phase 24: 防止主執行緒阻塞

    const formInitializedRef = useRef(false)
    const skipRateFetchRef = useRef(false)

    const markAsUserEdited = () => {
        setDiagnostics(prev => {
            if (!prev) return { status: 'pass', source: 'user', code: '', message: '', mismatch_amount: 0 };
            if (prev.source === 'user') return prev;
            return { ...prev, source: 'user' };
        });
    }

    const formatLocalDate = (d: Date): string => {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    // Initialization Logic
    useEffect(() => {
        if (open) {
            if (formInitializedRef.current) return
            formInitializedRef.current = true

            setIsEditingIcon(false)

            if (editItem) {
                setTitle(editItem.title)
                setAmountJPY((editItem.total_amount ?? editItem.amount ?? editItem.amount_jpy ?? 0).toString())
                setMethod(editItem.payment_method || "Cash")
                setCategory(editItem.category || "general")
                setIsPublic(editItem.is_public)
                setCardName(editItem.card_name || "")
                setCashback(editItem.cashback_rate?.toString() || "")
                setReceiptUrl(editItem.image_url || "")
                setItems(editItem.items || [])
                setBreakdown({
                    subtotal: editItem.subtotal_amount || 0,
                    tax: editItem.tax_amount || 0,
                    tip: editItem.tip_amount || 0,
                    service: editItem.service_charge_amount || 0,
                    discount: editItem.discount_amount || 0
                })
                setDiagnostics(editItem.diagnostics)
                setCustomIcon(editItem.custom_icon || "")
                setNotes(editItem.notes || "")
                setPayerId(editItem.payer_id || "")
                
                const rawDate = editItem.expense_date || editItem.created_at || ''
                const dbDate = rawDate.split('T')[0]
                setExpenseDate(dbDate || formatLocalDate(new Date()))
                setInputCurrency(editItem.currency || "JPY")
                
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
                setItems([])
                setBreakdown({ subtotal: 0, tax: 0, tip: 0, service: 0, discount: 0 })
                setDiagnostics(undefined)
                setCustomIcon("")
                setNotes("")
                setPayerId("")

                const todayStr = formatLocalDate(new Date())
                if (activeTrip?.start_date) {
                    const start = (activeTrip.start_date || '').split('T')[0]
                    const end = (activeTrip.end_date || activeTrip.start_date || '').split('T')[0]
                    if (todayStr < start || todayStr > end) {
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
            formInitializedRef.current = false
        }
    }, [open, editItem, selectedCurrency, activeTrip])

    useEffect(() => {
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

    const filteredCurrencies = useMemo(() => {
        if (!currencySearch) return allCurrencies;
        const s = currencySearch.toLowerCase();
        return allCurrencies.filter(c => 
            c.code.toLowerCase().includes(s) || 
            c.name.toLowerCase().includes(s) || 
            (c.zhName && c.zhName.includes(s))
        );
    }, [allCurrencies, currencySearch]);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        const loadAll = async () => {
            const list = await getAllSupportedCurrencies()
            if (list.length > 0) setAllCurrencies(list)
        }
        
        if (open) {
            loadAll()
            // 🆕 Phase 24: 延遲 150ms 再顯示重型組件，確保 Popover 彈出動畫流暢 (60fps)
            timer = setTimeout(() => {
                setDeferredShow(true)
            }, 150)
        } else {
            setDeferredShow(false)
        }

        return () => {
            if (timer) clearTimeout(timer)
        }
    }, [open])

    const doAiParse = async () => {
        if (!receiptUrl) {
            toast.error(t('exp_upload_receipt_first'))
            return
        }
        setIsParsing(true)
        haptic.tap()
        try {
            const response = await aiApi.parseReceipt(receiptUrl)
            debugLog("[AI Parse Result]", response)
            if (response && (response.total_amount || response.amount_jpy)) {
                setParseResult(response)
                setIsConfirmOpen(true)
            } else {
                toast.error(t('exp_ai_parse_failed_no_data'))
            }
        } catch (e) {
            toast.error(e instanceof Error ? `${t('exp_ai_parse_failed')}: ${e.message}` : t('exp_ai_parse_failed'))
        } finally {
            setIsParsing(false)
        }
    }

    const applyParseResult = () => {
        if (!parseResult) return

        setTitle(parseResult.title || "")
        const recognizedTotal = parseResult.total_amount || parseResult.amount_jpy || 0
        setAmountJPY(recognizedTotal.toString())
        setItems(parseResult.items || [])
        setBreakdown({
            // 🛡️ 關鍵修復：如果 AI 只有總額，則將其映射為小計，防止後端 Truth Source 抓到舊的隨便輸入的小計
            subtotal: parseResult.subtotal_amount || recognizedTotal,
            tax: parseResult.tax_amount || 0,
            tip: parseResult.tip_amount || 0,
            service: parseResult.service_charge_amount || 0,
            discount: parseResult.discount_amount || 0
        })
        setDiagnostics(parseResult.diagnostics)
        if (parseResult.custom_icon) setCustomIcon(parseResult.custom_icon)
        if (parseResult.notes) setNotes(parseResult.notes)

        if (parseResult.expense_date) {
            const parsedDate = parseResult.expense_date.split('T')[0]
            if (activeTrip?.start_date && activeTrip?.end_date) {
                const tripStart = (activeTrip.start_date || '').split('T')[0]
                const tripEnd = (activeTrip.end_date || '').split('T')[0]
                if (parsedDate >= tripStart && parsedDate <= tripEnd) {
                    setExpenseDate(parsedDate)
                } else {
                    toast.warning(t('exp_ai_date_outside_trip'))
                    setExpenseDate(tripStart)
                }
            } else {
                setExpenseDate(parsedDate)
            }
        }

        setInputCurrency(parseResult.currency || selectedCurrency || "JPY")
        if (parseResult.exchange_rate) {
            skipRateFetchRef.current = true
            setInputRate(parseResult.exchange_rate)
        }

        setIsConfirmOpen(false)
        setParseResult(null)
        haptic.success()
        toast.success(t('exp_ai_parse_applied'))
    }

    const handleAiParse = async (e: React.MouseEvent) => {
        e.preventDefault()
        doAiParse()
    }

    const handleSaveExpense = async () => {
        if (isSavingExpense) return
        haptic.tap()

        const userId = localStorage.getItem("user_uuid")
        const userName = localStorage.getItem("user_nickname")
        if (!amountJPY || !title) {
            haptic.error()
            toast.error(t('exp_fill_required'))
            return
        }

        if (!activeTripId) {
            haptic.error()
            toast.error(t('exp_trip_not_ready') || "行程資訊載入中，請稍後再試")
            return
        }
        setIsSavingExpense(true)

        const payload = {
            itinerary_id: activeTripId,
            title,
            amount_jpy: cleanAmount(amountJPY),
            exchange_rate: inputRate,
            currency: inputCurrency,
            payment_method: method,
            category: category,
            is_public: isPublic,
            created_by: userId || undefined,
            creator_name: userName || undefined,
            card_name: (method === "JCB" || method === "VisaMaster") ? cardName : "",
            cashback_rate: (method === "JCB" || method === "VisaMaster") ? (parseFloat(cashback) || 0) : 0,
            image_url: receiptUrl || null,
            expense_date: expenseDate || formatLocalDate(new Date()),
            items: items.map(it => ({
                original_name: it.original_name,
                translated_name: it.translated_name || "",
                amount: it.amount
            })),
            subtotal_amount: breakdown.subtotal,
            tax_amount: breakdown.tax,
            tip_amount: breakdown.tip,
            service_charge_amount: breakdown.service,
            discount_amount: breakdown.discount,
            total_amount: cleanAmount(amountJPY),
            diagnostics: diagnostics ? {
                status: diagnostics.status,
                source: diagnostics.source || "user",
                code: diagnostics.code || "",
                message: diagnostics.message || "",
                mismatch_amount: diagnostics.mismatch_amount || 0
            } : undefined,
            custom_icon: customIcon || null,
            notes: notes || null,
            payer_id: payerId || null
        }

        try {
            if (editItem) {
                await expensesApi.update(editItem.id, payload, userId || undefined)
            } else {
                await expensesApi.create(payload, userId || undefined)
            }
            haptic.success()
            toast.success(editItem ? t('exp_update_success') : t('exp_save_success'))
            onOpenChange(false)
            onSaveSuccess(payload.expense_date)
        } catch (e) {
            haptic.error()
            toast.error(e instanceof Error ? `${t('exp_save_failed')}: ${e.message}` : t('exp_save_failed'))
        } finally {
            setIsSavingExpense(false)
        }
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md pb-[calc(env(safe-area-inset-bottom)+60px)] max-h-[95vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl">
                    <DialogHeader>
                        <DialogTitle>{editItem ? t('edit') : t('add')} {t('expense')}</DialogTitle>
                        <DialogDescription className="sr-only">
                            Refine and save your expense details.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-5 py-2">
                        {/* Diagnostics Warning */}
                        {diagnostics?.status === 'warning' && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex gap-3 items-start shadow-sm border-l-4 border-l-amber-500 animate-in fade-in slide-in-from-top-2 duration-300">
                                <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <div className="flex-1 space-y-1">
                                    <div className="text-sm font-bold text-amber-800 dark:text-amber-200">
                                        {t('exp_diagnostic_warning') || "AI 辨識金額不一致"}
                                    </div>
                                    <div className="text-xs text-amber-700/80 dark:text-amber-300/80 leading-relaxed font-medium">
                                        {diagnostics.message || t('exp_diagnostic_mismatch_desc')}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Hero Amount Section */}
                        <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 space-y-3 shadow-inner">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                💰 {t('exp_amount')}
                            </Label>

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button 
                                        variant="outline" 
                                        className="h-11 w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 font-bold text-base rounded-xl justify-between px-3"
                                        disabled={isSavingExpense}
                                    >
                                        <div className="flex items-center gap-2">
                                            {(() => {
                                                const curr = CURRENCIES.find(c => c.code === inputCurrency) || allCurrencies.find(c => c.code === inputCurrency);
                                                return curr?.countryCode ? (
                                                    <div className="w-5 h-3.5 bg-slate-100 rounded-[2px] overflow-hidden border border-slate-200/50 shadow-sm flex-shrink-0">
                                                        <Image 
                                                            src={`https://flagcdn.com/w40/${curr.countryCode}.png`} 
                                                            alt={curr.code}
                                                            width={20}
                                                            height={14}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className="text-lg">{curr?.flag || '🌍'}</span>
                                                );
                                            })()}
                                            <span className="font-mono">{inputCurrency}</span>
                                        </div>
                                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0 rounded-xl shadow-2xl overflow-hidden" align="start">
                                    <div className="flex flex-col h-[400px] max-h-[80vh]">
                                        <div className="p-2 border-b bg-slate-50 dark:bg-slate-900">
                                            <div className="relative">
                                                <Input
                                                    placeholder="Search code/name (e.g. BRL, 巴西)..."
                                                    value={currencySearch}
                                                    onChange={e => setCurrencySearch(e.target.value)}
                                                    className="h-9 pr-8 focus-visible:ring-1"
                                                    autoFocus
                                                />
                                                {currencySearch && (
                                                    <button 
                                                        onClick={() => setCurrencySearch("")}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                    >
                                                        <Plus className="w-4 h-4 rotate-45" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <ScrollArea className="flex-1 min-h-0">
                                            <div className="p-1 pb-16">
                                                {!currencySearch && (
                                                    <>
                                                        <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Popular</div>
                                                        {CURRENCIES.map(c => (
                                                            <Button
                                                                key={c.code}
                                                                variant="ghost"
                                                                className={cn("w-full justify-start h-10 px-2 font-medium rounded-lg mb-0.5", inputCurrency === c.code && "bg-slate-100 dark:bg-slate-800")}
                                                                onClick={() => { setInputCurrency(c.code); setCurrencySearch(""); }}
                                                            >
                                                                {c.countryCode ? (
                                                                    <div className="w-5 h-3.5 bg-slate-100 rounded-[2px] overflow-hidden border border-slate-200/50 shadow-sm flex-shrink-0 mr-3">
                                                                        <Image 
                                                                            src={`https://flagcdn.com/w40/${c.countryCode}.png`} 
                                                                            alt={c.code}
                                                                            width={20}
                                                                            height={14}
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <span className="mr-3 text-lg">{c.flag}</span>
                                                                )}
                                                                <span className="font-mono font-bold mr-2 w-10 text-left">{c.code}</span>
                                                                <span className="text-xs text-slate-500 truncate">{isValidTranslationKey(`currency_${c.code}`) ? t(`currency_${c.code}` as TranslationKey) : c.code}</span>
                                                            </Button>
                                                        ))}
                                                        <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                                                    </>
                                                )}
                                                
                                                {deferredShow && (
                                                    <>
                                                        <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                            {currencySearch ? `Search Results (${filteredCurrencies.length})` : "All Currencies"}
                                                        </div>
                                                        {filteredCurrencies.slice(0, 100).map(c => (
                                                            <Button
                                                                key={c.code}
                                                                variant="ghost"
                                                                className={cn("w-full justify-start h-10 px-2 font-medium rounded-lg mb-0.5", inputCurrency === c.code && "bg-slate-100 dark:bg-slate-800")}
                                                                onClick={() => { setInputCurrency(c.code); setCurrencySearch(""); }}
                                                            >
                                                                {c.countryCode ? (
                                                                    <div className="w-5 h-3.5 bg-slate-100 rounded-[2px] overflow-hidden border border-slate-200/50 shadow-sm flex-shrink-0 mr-3">
                                                                        <Image 
                                                                            src={`https://flagcdn.com/w40/${c.countryCode}.png`} 
                                                                            alt={c.code}
                                                                            width={20}
                                                                            height={14}
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <span className="mr-3 text-lg">{c.flag || '🌏'}</span>
                                                                )}
                                                                <span className="font-mono font-bold mr-2 w-10 text-left">{c.code}</span>
                                                                <div className="flex flex-col items-start leading-none overflow-hidden">
                                                                    <span className="text-xs truncate max-w-[150px]">{c.zhName || c.name}</span>
                                                                    {c.zhName && <span className="text-[9px] text-slate-400 truncate max-w-[150px]">{c.name}</span>}
                                                                </div>
                                                            </Button>
                                                        ))}
                                                        {filteredCurrencies.length === 0 && (
                                                            <div className="py-8 text-center text-xs text-slate-400 font-medium">No currencies found</div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </PopoverContent>
                            </Popover>

                            <div className="flex gap-3 items-stretch">
                                <div className="flex-1 relative">
                                    <Input
                                        placeholder="0"
                                        type="number"
                                        inputMode="numeric"
                                        className="text-2xl font-mono font-bold h-12 text-center bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 rounded-xl"
                                        value={amountJPY}
                                        disabled={isSavingExpense}
                                        onChange={e => {
                                            const val = e.target.value
                                            setAmountJPY(val)
                                            // 🛡️ 關鍵同步：當用戶手動更改主金額時，同步更新小計，防止後端 Truth Source 判定不一
                                            setBreakdown(prev => ({ ...prev, subtotal: cleanAmount(val) }))
                                            markAsUserEdited()
                                        }}
                                    />
                                </div>
                                <div className="flex items-center px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl text-white whitespace-nowrap min-w-[8rem] justify-center font-bold shadow-lg">
                                    <span className="text-emerald-200 text-xs mr-1">≈</span>
                                    NT$ {Math.round(cleanAmount(amountJPY) * inputRate).toLocaleString()}
                                </div>
                            </div>
                        </div>

                        {/* Title & Items */}
                        <div className="space-y-3">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                {t('exp_title')}
                            </Label>
                             <Input
                                placeholder={t('exp_title')}
                                value={title}
                                disabled={isSavingExpense}
                                onChange={e => {
                                    setTitle(e.target.value)
                                    markAsUserEdited()
                                }}
                                className="h-11 text-base rounded-xl"
                            />

                            {items.length > 0 && (
                                <div className="space-y-2 mt-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">{t('exp_sub_items')}</Label>
                                    {items.map((item, index) => (
                                        <div key={index} className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                                            <Input
                                                placeholder={t('exp_item_name')}
                                                value={item.translated_name || item.original_name}
                                                onChange={(e) => {
                                                    const newItems = [...items]
                                                    newItems[index].translated_name = e.target.value
                                                    setItems(newItems)
                                                    markAsUserEdited()
                                                }}
                                                className="flex-1 h-10 text-sm rounded-lg"
                                            />
                                            <Input
                                                type="number"
                                                inputMode="numeric"
                                                placeholder="0"
                                                value={item.amount || ""}
                                                onChange={(e) => {
                                                    const newItems = [...items]
                                                    newItems[index].amount = cleanAmount(e.target.value)
                                                    setItems(newItems)
                                                    markAsUserEdited()
                                                }}
                                                className="w-24 h-10 text-sm font-mono text-center rounded-lg"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-10 w-10 text-red-500 shrink-0 hover:bg-red-50 rounded-lg"
                                                onClick={() => {
                                                    const newItems = [...items]
                                                    newItems.splice(index, 1)
                                                    setItems(newItems)
                                                    markAsUserEdited()
                                                }}
                                            >
                                                <Trash className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                             <Button
                                variant="outline"
                                className="w-full h-10 border-dashed text-slate-500 font-medium hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 rounded-xl"
                                disabled={isSavingExpense}
                                onClick={() => {
                                    setItems([...items, { original_name: "", amount: 0 }])
                                    markAsUserEdited()
                                }}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('exp_add_item')}
                            </Button>
                        </div>

                        {/* Day + Payer merged row */}
                        <div className="flex gap-3 items-end">
                            <div className="w-[45%] space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <Calendar className="w-3 h-3" /> Day
                                </Label>
                                {activeTrip?.start_date ? (
                                     <select
                                        value={expenseDate}
                                        onChange={e => setExpenseDate(e.target.value)}
                                        disabled={isSavingExpense}
                                        className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 font-medium appearance-none shadow-sm disabled:opacity-50"
                                    >
                                        {(() => {
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
                                                return (
                                                    <option key={i} value={dateStr}>
                                                        Day {i + 1} ({date.getMonth()+1}/{date.getDate()})
                                                    </option>
                                                )
                                            })
                                        })()}
                                    </select>
                                ) : (
                                    <div className="h-10 flex items-center justify-center text-[10px] text-slate-400 bg-slate-50 rounded-xl border border-dashed">{t('exp_select_trip_first')}</div>
                                )}
                            </div>

                            <div className="flex-1 space-y-2 min-w-0">
                                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <User className="w-3 h-3" /> {t('exp_payer')}
                                </Label>
                                <Popover open={payerOpen} onOpenChange={setPayerOpen}>
                                    <PopoverTrigger asChild>
                                         <Button
                                            variant="outline"
                                            className="w-full h-10 justify-between bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 font-medium px-3 rounded-xl shadow-sm"
                                            disabled={isSavingExpense}
                                        >
                                            {payerId ? (
                                                <div className="flex items-center gap-2 overflow-hidden truncate">
                                                    {activeTrip?.members?.find(m => m.user_id === payerId) ? (
                                                        <>
                                                            <Avatar className="h-5 w-5 shrink-0">
                                                                <AvatarImage src={activeTrip.members.find(m => m.user_id === payerId)?.user_avatar} />
                                                                <AvatarFallback className="text-[10px] bg-slate-100 uppercase">
                                                                    {activeTrip.members.find(m => m.user_id === payerId)?.user_name[0]}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <span className="truncate text-sm font-bold">{activeTrip.members.find(m => m.user_id === payerId)?.user_name}</span>
                                                        </>
                                                    ) : (
                                                        <span className="truncate text-sm font-bold">{payerId}</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-sm font-normal truncate">{t('exp_payer_placeholder')}</span>
                                            )}
                                            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl overflow-hidden shadow-2xl" align="start">
                                        <div className="flex flex-col max-h-[300px]">
                                            <div className="p-2 border-b bg-slate-50">
                                                <Input
                                                    placeholder={t('search')}
                                                    value={payerSearch}
                                                    onChange={(e) => setPayerSearch(e.target.value)}
                                                    className="h-9 border-none focus-visible:ring-0 px-2 shadow-none bg-transparent"
                                                    autoFocus
                                                />
                                            </div>
                                            <ScrollArea className="flex-1">
                                                {(!activeTrip?.members || activeTrip.members.length === 0) && (
                                                    <div className="py-10 px-4 text-center">
                                                        <User className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                                        <p className="text-xs text-slate-400 font-medium">{t('exp_no_members')}</p>
                                                    </div>
                                                )}
                                                {activeTrip?.members?.filter(m =>
                                                    m.user_name.toLowerCase().includes(payerSearch.toLowerCase())
                                                ).map((member) => (
                                                    <Button
                                                        key={member.user_id}
                                                        variant="ghost"
                                                        className="w-full justify-start h-11 px-3 font-normal rounded-none border-b border-slate-50 last:border-0"
                                                        onClick={() => {
                                                            setPayerId(member.user_id)
                                                            setPayerOpen(false)
                                                            setPayerSearch("")
                                                        }}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4 text-emerald-500", payerId === member.user_id ? "opacity-100" : "opacity-0")} />
                                                        <Avatar className="h-6 w-6 mr-2 shrink-0">
                                                            <AvatarImage src={member.user_avatar} />
                                                            <AvatarFallback className="text-[10px] bg-slate-100 uppercase">{member.user_name[0]}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="truncate font-medium">{member.user_name}</span>
                                                    </Button>
                                                ))}
                                                {payerSearch && !activeTrip?.members?.some(m => m.user_name === payerSearch) && (
                                                    <Button
                                                        variant="ghost"
                                                        className="w-full justify-start h-12 px-3 font-normal rounded-none bg-blue-50/30"
                                                        onClick={() => {
                                                            setPayerId(payerSearch)
                                                            setPayerOpen(false)
                                                            setPayerSearch("")
                                                        }}
                                                    >
                                                        <Plus className="mr-2 h-4 w-4 text-blue-500 shrink-0" />
                                                        <div className="flex flex-col items-start leading-tight">
                                                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Guest</span>
                                                            <span className="truncate font-bold text-blue-600">&ldquo;{payerSearch}&rdquo;</span>
                                                        </div>
                                                    </Button>
                                                )}
                                            </ScrollArea>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        {/* Standalone Notes */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <History className="w-3 h-3" /> {t('exp_notes')}
                            </Label>
                            <Textarea
                                placeholder={t('exp_notes_placeholder') || "備註說明..."}
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="min-h-[80px] text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-slate-300"
                            />
                        </div>

                        {/* Category */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                🏷️ {t('exp_category')}
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
                                                : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                                        )}
                                    >
                                        <info.icon className="w-4 h-4" /> {isValidTranslationKey(`cat_${key}`) ? t(`cat_${key}` as TranslationKey) : info.label}
                                    </button>
                                ))}
                                {isEditingIcon ? (
                                    <div className="flex items-center justify-center p-1 rounded-xl border-2 border-slate-800 bg-slate-800 shadow-md scale-105">
                                        <Input
                                            autoFocus
                                            className="h-8 w-full text-center text-base p-0 border-0 bg-transparent text-white focus-visible:ring-0"
                                            value={customIcon}
                                            onChange={e => setCustomIcon(e.target.value)}
                                            onBlur={() => setIsEditingIcon(false)}
                                            onKeyDown={e => e.key === 'Enter' && setIsEditingIcon(false)}
                                        />
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsEditingIcon(true)}
                                        className={cn(
                                            "flex items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 text-xs font-medium transition-all group",
                                            (category === "general" && customIcon)
                                                ? "border-slate-800 bg-slate-800 text-white shadow-md scale-105"
                                                : "bg-white dark:bg-slate-800 border-dashed border-slate-200 dark:border-slate-700 text-slate-400"
                                        )}
                                    >
                                        {customIcon ? <span className="text-base">{customIcon}</span> : <SmilePlus className="w-4 h-4" />}
                                        <span className="truncate">{customIcon ? t('exp_custom_icon') : t('exp_custom_btn')}</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Payment Method */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                💳 {t('exp_payment')}
                            </Label>
                            <div className="grid grid-cols-4 gap-2">
                                {PAYMENT_METHODS.map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => setMethod(m.id)}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-2.5 rounded-xl border-2 text-[10px] font-bold transition-all",
                                            method === m.id
                                                ? "border-slate-800 bg-slate-800 text-white shadow-md"
                                                : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500"
                                        )}
                                    >
                                        <m.icon className="w-5 h-5 mb-1" />{m.label}
                                    </button>
                                ))}
                            </div>

                            {(method === "JCB" || method === "VisaMaster") && (
                                <div className="flex gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 animate-in slide-in-from-top-2">
                                    <Input placeholder={t('exp_card_name')} value={cardName} onChange={e => setCardName(e.target.value)} className="flex-1 h-9 text-xs" />
                                    <Input placeholder={t('exp_cashback')} value={cashback} onChange={e => setCashback(e.target.value)} className="w-16 h-9 text-xs" />
                                </div>
                            )}
                        </div>

                        {/* Receipt Upload & AI */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    📸 {t('exp_receipt')}
                                </Label>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={handleAiParse}
                                    disabled={!receiptUrl || isParsing}
                                    className={cn(
                                        "h-8 gap-1.5 font-bold rounded-lg border transition-all",
                                        !receiptUrl 
                                            ? "bg-slate-100 text-slate-400 border-slate-200" 
                                            : "text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-100 dark:bg-indigo-900/40"
                                    )}
                                >
                                    {isParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                    {isParsing ? t('parsing') : t('exp_ai_parse')}
                                </Button>
                            </div>
                            <ImageUpload
                                value={receiptUrl}
                                onChange={(url) => setReceiptUrl(url)}
                                onRemove={() => setReceiptUrl("")}
                                folder={`ryan_travel/receipts/${typeof window !== 'undefined' ? localStorage.getItem("user_uuid") || 'anonymous' : 'anonymous'}`}
                            />
                        </div>

                        {/* Visibility and Save */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 mb-2">
                            <Label className="text-sm font-bold flex items-center gap-2">
                                {isPublic ? <><Users className="w-5 h-5 text-blue-500" /> {t('shared')}</> : <><User className="w-5 h-5 text-amber-500" /> {t('private')}</>}
                            </Label>
                             <Switch checked={isPublic} onCheckedChange={setIsPublic} disabled={isSavingExpense} />
                        </div>

                        <Button 
                            className="w-full h-14 bg-slate-950 text-white font-black text-lg rounded-2xl shadow-xl hover:scale-[0.98] transition-transform active:scale-95 disabled:opacity-70"
                            onClick={handleSaveExpense} 
                            disabled={isSavingExpense}
                        >
                            {isSavingExpense ? <Loader2 className="w-6 h-6 mr-2 animate-spin" /> : <CheckCircle2 className="w-6 h-6 mr-2" />}
                            {t('save')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* AI Confirmation Dialog */}
            <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <DialogContent className="sm:max-w-[500px] h-[85vh] sm:h-[80vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-950 rounded-3xl shadow-2xl z-[110]">
                    <DialogHeader className="p-5 border-b bg-slate-50 dark:bg-slate-900 shrink-0">
                        <DialogTitle className="flex items-center gap-2.5 text-base font-black">
                            <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
                                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            {t('exp_ai_confirm_title')}
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-slate-500 mt-1">
                            {t('exp_ai_confirm_desc')}
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="flex-1 min-h-0">
                        <div className="p-5 space-y-4">
                            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-inner">
                                <div className="flex justify-between items-start">
                                    <div className="min-w-0 pr-3">
                                        <h3 className="text-sm font-black truncate text-slate-900 dark:text-slate-100">{parseResult?.title || "Unknown Store"}</h3>
                                        <p className="text-[10px] text-slate-500 font-bold flex items-center gap-1 mt-1 uppercase tracking-wider">
                                            <Calendar className="w-3 h-3" />
                                            {parseResult?.expense_date?.split('T')[0] || formatLocalDate(new Date())}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-xl font-mono font-black text-indigo-600 dark:text-indigo-400">
                                            {parseResult?.currency} {(parseResult?.total_amount || parseResult?.amount_jpy || 0).toLocaleString()}
                                        </div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-tighter mt-0.5">Estimated Total</p>
                                    </div>
                                </div>
                            </div>

                            {(parseResult?.items?.length ?? 0) > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">{t('exp_sub_items')} ({parseResult?.items?.length ?? 0})</h4>
                                    <div className="space-y-1.5">
                                        {parseResult?.items?.map((item, idx) => (
                                            <div key={idx} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs shadow-sm hover:border-slate-200 transition-colors">
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                                        {item.translated_name || item.original_name}
                                                    </div>
                                                    <div className="text-[9px] text-slate-400 truncate mt-0.5 font-medium opacity-60">
                                                        {item.original_name}
                                                    </div>
                                                </div>
                                                <div className="font-mono font-black text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                                    {item.amount?.toLocaleString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {parseResult?.notes && (
                                <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-100/50 border-dashed text-xs text-amber-800/80 dark:text-amber-200/80 italic font-medium">
                                    &ldquo;{parseResult.notes}&rdquo;
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    <DialogFooter className="p-5 bg-slate-50 dark:bg-slate-900 border-t flex gap-3 sm:flex-row flex-col mt-auto shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
                        <Button
                            variant="ghost"
                            className="flex-1 h-12 rounded-xl font-black text-slate-500 hover:bg-white dark:hover:bg-slate-800"
                            onClick={() => {
                                setIsConfirmOpen(false)
                                setParseResult(null)
                                haptic.tap()
                            }}
                        >
                            {t('exp_ai_confirm_cancel')}
                        </Button>
                        <Button
                            className="flex-[2] h-12 rounded-xl bg-slate-950 text-white font-black shadow-lg active:scale-95 transition-all"
                            onClick={applyParseResult}
                        >
                            <CheckCircle2 className="w-5 h-5 mr-2" />
                            {t('exp_ai_confirm_import')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
