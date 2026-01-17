"use client"

import { useState, useEffect, useMemo, memo, ComponentType } from "react"
import { motion } from "framer-motion"
import { useSWRConfig } from "swr"
import {
    Plus, Trash2, Edit2, ChevronRight, FileText, Loader2,
    Wallet, CreditCard, Train, Utensils, ShoppingBag, Bed, Ticket, Receipt,
    Sparkles, Upload, Image as ImageIcon, ChevronLeft, PieChart, List, Users, User,
    Key, CheckCircle2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useLanguage } from "@/lib/LanguageContext"
import { ExpenseChart, CATEGORY_COLORS } from "@/components/expense-chart"
import { ImageUpload } from "@/components/ui/image-upload"
import { useTripContext } from "@/lib/trip-context"
import { TripSwitcher } from "@/components/trip-switcher"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { useHaptic } from "@/lib/hooks"
import { debugLog } from "@/lib/debug"

// Type definitions
interface Expense {
    id: string
    title: string
    amount: number
    payment_method?: string
    category?: string
    is_public: boolean
    image_url?: string
    expense_date?: string
    incurred_at?: string // 🆕 DB column name for compatibility
    created_at?: string
    exchange_rate?: number
    cashback_rate?: number
    currency?: string // 🆕 Added to match backend
    trip_id?: string
    card_name?: string
    creator_name?: string
}

interface Trip {
    id: string
    title: string
    days?: unknown[]
    share_code?: string
    credit_cards?: CreditCard[]  // 🆕 Type Safety
    flight_info?: Record<string, unknown>
    hotel_info?: Record<string, unknown>
    start_date?: string
    end_date?: string
}

interface ParseResult {
    items?: Record<string, unknown>[]
    title?: string
    start_date?: string
    end_date?: string
    daily_locations?: Record<string, Record<string, unknown>>
    day_notes?: Record<string, Record<string, unknown>>
    day_costs?: Record<string, Record<string, unknown>>
    day_tickets?: Record<string, Record<string, unknown>>
    day_checklists?: Record<string, Record<string, unknown>>
    ai_review?: string
}

interface GenerateResult {
    items?: Record<string, unknown>[]
    data?: { items?: Record<string, unknown>[] }
    title?: string
    start_date?: string
    end_date?: string
    daily_locations?: Record<string, Record<string, unknown>>
    day_notes?: Record<string, Record<string, unknown>>
    day_costs?: Record<string, Record<string, unknown>>
    day_tickets?: Record<string, Record<string, unknown>>
    day_checklists?: Record<string, Record<string, unknown>>
    ai_review?: string
}

// 🆕 v3.8: 信用卡回饋功能
interface CreditCard {
    id: string
    name: string           // 卡片名稱
    rewardRate: number     // 回饋趴數 (%)
    rewardLimit: number    // 回饋上限 (TWD)
    notes: string          // 備忘錄
    is_public?: boolean     // 🆕 true = 存雲端 (Trip Content), false = 存本地
    creator_id?: string     // 🆕 識別是誰建立的
}

interface ExpenseItemProps {
    item: Expense
    rate: number
    onEdit: (item: Expense) => void
    onDelete: (id: string) => void
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

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

// 🆕 v3.10: 支援多幣別
const CURRENCIES = [
    { code: 'JPY', symbol: '¥', name: '日幣', flag: '🇯🇵' },
    { code: 'USD', symbol: '$', name: '美元', flag: '🇺🇸' },
    { code: 'EUR', symbol: '€', name: '歐元', flag: '🇪🇺' },
    { code: 'KRW', symbol: '₩', name: '韓圓', flag: '🇰🇷' },
    { code: 'CNY', symbol: '¥', name: '人民幣', flag: '🇨🇳' },
    { code: 'THB', symbol: '฿', name: '泰銖', flag: '🇹🇭' },
    { code: 'SGD', symbol: 'S$', name: '新幣', flag: '🇸🇬' },
    { code: 'HKD', symbol: 'HK$', name: '港幣', flag: '🇭🇰' },
    { code: 'TWD', symbol: 'NT$', name: '台幣', flag: '🇹🇼' }, // Added TWD as base option
] as const

import { getExchangeRate } from "@/lib/currency"
import { CountingNumber } from "@/components/ui/counting-number"

export function ToolsView() {
    const { t } = useLanguage()
    const { activeTrip, activeTripId, trips, mutate: tripMutate } = useTripContext()  // 🔧 FIX: Restore full context
    const { mutate } = useSWRConfig()
    const [activeSection, setActiveSection] = useState("expense")  // 🔧 FIX: Rename to activeSection
    const [expenses, setExpenses] = useState<Expense[]>([])  // 🔧 FIX: Add missing expenses state

    const [rate, setRate] = useState(0.22)

    // 🆕 Currency State (Input Dialog) - Isolated
    const [inputCurrency, setInputCurrency] = useState("JPY")
    const [inputRate, setInputRate] = useState(0.22)

    // 🆕 Currency State
    const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null) // null = TWD only

    // Load currency preference
    useEffect(() => {
        const saved = localStorage.getItem("preferred_currency")
        if (saved) setSelectedCurrency(saved)
    }, [])

    // Initial Rate Fetch (View)
    useEffect(() => {
        const initRate = async () => {
            const r = await getExchangeRate(selectedCurrency || 'JPY')
            setRate(r)
        }
        initRate()
    }, [selectedCurrency])

    // 🆕 Input Rate Effect
    useEffect(() => {
        const updateInputRate = async () => {
            const r = await getExchangeRate(inputCurrency)
            setInputRate(r)
        }
        updateInputRate()
    }, [inputCurrency])

    // View controls
    const [expenseView, setExpenseView] = useState<'summary' | 'daily'>('summary')
    const [ownerFilter, setOwnerFilter] = useState<'all' | 'public' | 'private'>('all')
    const [selectedDate, setSelectedDate] = useState<string>("")
    // 🆕 Chart Filtering State
    const [activeCategory, setActiveCategory] = useState<string | null>(null)

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editItem, setEditItem] = useState<Expense | null>(null)
    const [title, setTitle] = useState("")
    const [amountJPY, setAmountJPY] = useState("")
    const [method, setMethod] = useState("Cash")
    const [category, setCategory] = useState("general")
    const [isPublic, setIsPublic] = useState(true)
    const [cardName, setCardName] = useState("")
    const [cashback, setCashback] = useState("")
    const [expenseDate, setExpenseDate] = useState("")
    const [receiptUrl, setReceiptUrl] = useState("")
    const [isSavingExpense, setIsSavingExpense] = useState(false)
    const haptic = useHaptic()

    // AI Tools state
    const [markdown, setMarkdown] = useState("")
    const [mdLoading, setMdLoading] = useState(false)
    const [mdResult, setMdResult] = useState<ParseResult | null>(null)
    const [aiPrompt, setAiPrompt] = useState("")
    const [aiLoading, setAiLoading] = useState(false)
    const [aiResult, setAiResult] = useState<GenerateResult | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [hasApiKey, setHasApiKey] = useState(false)
    // 🆕 v3.5: 進度指示器
    const [parseProgress, setParseProgress] = useState<string | null>(null)
    const [generateProgress, setGenerateProgress] = useState<string | null>(null)

    // 🆕 v3.9: 匯入行程選擇
    const [selectedImportTripId, setSelectedImportTripId] = useState<string>("new")

    // 🆕 v3.8: 信用卡回饋彙整
    const [localCards, setLocalCards] = useState<CreditCard[]>([])
    const [sharedCards, setSharedCards] = useState<CreditCard[]>([])

    // Computed: Merged Card List (Display)
    const creditCards = useMemo(() => {
        const sharedIds = new Set(sharedCards.map(c => c.id))
        const uniqueLocal = localCards.filter(c => !sharedIds.has(c.id))
        return [...uniqueLocal, ...sharedCards]
    }, [localCards, sharedCards])

    const [cardDialogOpen, setCardDialogOpen] = useState(false)
    const [deletingCardId, setDeletingCardId] = useState<string | null>(null)
    const [isDeletingCard, setIsDeletingCard] = useState(false)
    const [editingCard, setEditingCard] = useState<CreditCard | null>(null)
    const [newCardName, setNewCardName] = useState("")
    const [newRewardRate, setNewRewardRate] = useState("")
    const [newRewardLimit, setNewRewardLimit] = useState("")
    const [newCardNotes, setNewCardNotes] = useState("")
    const [newCardIsPublic, setNewCardIsPublic] = useState(false) // 🆕
    const [isSavingCard, setIsSavingCard] = useState(false) // 🆕 Prevent double-click

    useEffect(() => {
        // Check if user has API key (check localStorage, old key, and DEV key)
        const devKey = process.env.NEXT_PUBLIC_DEV_GEMINI_KEY
        const storedKey = localStorage.getItem("user_gemini_key") || localStorage.getItem("gemini_api_key") || devKey
        setHasApiKey(!!storedKey)
    }, [])

    // 🆕 v3.8: 載入信用卡資料 (Local)
    useEffect(() => {
        try {
            const saved = localStorage.getItem("credit_cards")
            if (saved) {
                setLocalCards(JSON.parse(saved))
            }
        } catch (e) {
            console.error("Failed to load local credit cards:", e)
        }
    }, [])

    // 🆕 v3.8: 載入信用卡資料 (Shared)
    useEffect(() => {
        if (activeTrip && (activeTrip as Trip).credit_cards) {
            setSharedCards((activeTrip as Trip).credit_cards || [])
        } else {
            setSharedCards([])
        }
    }, [activeTrip])

    const saveTripInfo = async (mergedSharedCards: CreditCard[]) => {
        if (!activeTripId) return
        try {
            await fetch(`${API_BASE}/api/trips/${activeTripId}/info`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    flight_info: (activeTrip as Trip)?.flight_info || {},
                    hotel_info: (activeTrip as Trip)?.hotel_info || {},
                    credit_cards: mergedSharedCards // 🆕 Sync Shared Cards
                })
            })
            // Re-fetch trip data using context mutate for proper SWR revalidation
            tripMutate()
        } catch (e) {
            console.error("Failed to sync shared cards:", e)
        }
    }

    useEffect(() => {
        const fetchExpenses = async () => {
            try {
                if (activeTripId) {
                    const res = await fetch(`${API_BASE}/api/trips/${activeTripId}/expenses`, {
                        headers: { "X-User-ID": localStorage.getItem("user_uuid") || "" }
                    })
                    const data = await res.json()
                    setExpenses(data || [])
                } else {
                    setExpenses([])
                }
            } catch (e) { console.error(e) }
        }
        fetchExpenses()
    }, [activeTripId])

    // 🆕 Phase 9: Reset selectedDate when trip changes
    useEffect(() => {
        setSelectedDate("")
        setActiveCategory(null)
    }, [activeTripId])

    // Helper: Format date in local timezone (avoid UTC offset issues)
    const formatLocalDate = (d: Date): string => {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    // 🆕 Phase 12: Union of Trip Dates + Expense Dates (Prevent Orphaned Dates)
    const allDates = useMemo(() => {
        const dateSet = new Set<string>()

        // 1. Add Trip Dates (if active)
        try {
            if (activeTrip?.start_date) {
                // Use T00:00:00 to force local timezone interpretation
                const start = new Date(activeTrip.start_date + 'T00:00:00')
                const end = activeTrip.end_date
                    ? new Date(activeTrip.end_date + 'T00:00:00')
                    : new Date(start.getTime() + ((activeTrip.days?.length || 7) - 1) * 24 * 60 * 60 * 1000)

                if (!isNaN(start.getTime())) {
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                        dateSet.add(formatLocalDate(d))
                    }
                }
            }
        } catch (e) { console.error("Error calculating trip dates:", e) }

        // 2. Add Expense Dates (ALWAYS merge to ensure visibility)
        expenses.forEach(e => {
            const raw = e.expense_date || e.incurred_at || e.created_at
            const d = raw ? raw.split('T')[0] : ''
            if (d) dateSet.add(d)
        })

        return Array.from(dateSet).sort()
    }, [activeTrip, expenses])

    // Set initial selected date (prefer today if within trip range)
    useEffect(() => {
        if (allDates.length > 0 && !selectedDate) {
            const today = formatLocalDate(new Date())
            // If today is within trip range, default to today; otherwise first day
            const initialDate = allDates.includes(today) ? today : allDates[0]
            setSelectedDate(initialDate)
        }
    }, [allDates, selectedDate])

    // Filter expenses based on view mode and owner filter
    const filteredExpenses = useMemo(() => {
        let filtered = expenses
        debugLog(`🔍 Filtering: View=${expenseView}, Date=${selectedDate}, Total=${expenses.length}`)

        // Owner filter
        if (ownerFilter === 'public') {
            filtered = filtered.filter(e => e.is_public)
        } else if (ownerFilter === 'private') {
            filtered = filtered.filter(e => !e.is_public)
        }

        // Date filter (daily mode)
        if (expenseView === 'daily' && selectedDate) {
            filtered = filtered.filter(e => {
                // 🆕 Phase 10.5: incurred_at fallback for DB column name compatibility
                // 🔧 Phase 16.2: Normalize all dates to YYYY-MM-DD format (split at 'T')
                const rawDate = e.expense_date || e.incurred_at || e.created_at
                const d = rawDate ? rawDate.split('T')[0] : ''
                const match = d === selectedDate
                if (!match && expenses.length < 20) {
                    // Log mismatches for small datasets to debug
                    debugLog(`   ❌ Mismatch: ExpID=${e.id}, Date=${d}, Target=${selectedDate}, Raw=${JSON.stringify({ ed: e.expense_date, ia: e.incurred_at, ca: e.created_at })}`)
                }
                return match
            })
        }

        debugLog(`   ✅ Filtered Result: ${filtered.length} items`)
        return filtered
    }, [expenses, ownerFilter, expenseView, selectedDate])

    // Calculate totals and category breakdown
    const { totalTWD, totalCashback, categoryData } = useMemo(() => {
        // TWD Total: Convert ALL expenses to TWD
        const twdTotal = filteredExpenses.reduce((sum, e) => {
            // Use stored exchange rate if available, otherwise fallback to current rate (only if currency matches)
            // Ideally backend should always store rate. For now assume rate applies if currency matches.
            // If currency differs and no stored rate, we have a problem (Risk identified in analysis).
            // For now: use stored rate -> current rate (if JPY) -> 0.22 fallback
            const usedRate = e.exchange_rate || (e.currency === selectedCurrency ? rate : (e.currency === 'JPY' ? 0.22 : 0))
            return sum + (e.amount || 0) * usedRate
        }, 0)



        // 計算總回饋金額 (TWD)
        const cashbackTotal = filteredExpenses.reduce((sum, e) => {
            if (e.cashback_rate && e.cashback_rate > 0) {
                const usedRate = e.exchange_rate || rate
                return sum + Math.round((e.amount * usedRate) * e.cashback_rate / 100)
            }
            return sum
        }, 0)

        const cats: Record<string, number> = {}
        filteredExpenses.forEach(e => {
            const cat = e.category || 'general'
            // Category chart uses TWD value for standardized comparison
            const usedRate = e.exchange_rate || (e.currency === selectedCurrency ? rate : 0.22)
            const amountTWD = (e.amount || 0) * usedRate
            cats[cat] = (cats[cat] || 0) + amountTWD
        })
        const data = Object.entries(cats).map(([category, amount]) => ({
            category,
            amount: Math.round(amount), // Chart uses TWD
            color: CATEGORY_COLORS[category] || CATEGORY_COLORS.general
        })).sort((a, b) => b.amount - a.amount)

        return {
            totalTWD: Math.round(twdTotal),
            totalCashback: cashbackTotal,
            categoryData: data
        }
    }, [filteredExpenses, rate, selectedCurrency])

    // 🆕 Phase 9: Calculate foreign currency totals for multi-currency display
    const foreignTotals = useMemo(() => {
        const totals: Record<string, { amount: number; symbol: string; flag: string }> = {}

        // 🆕 Phase 9.5: Filter by activeCategory if set
        const expensesToSum = activeCategory
            ? filteredExpenses.filter(e => e.category === activeCategory)
            : filteredExpenses

        expensesToSum.forEach(e => {
            const c = e.currency || "JPY"
            if (c !== "TWD") {
                const info = CURRENCIES.find(x => x.code === c)
                if (!totals[c]) {
                    totals[c] = { amount: 0, symbol: info?.symbol || '', flag: info?.flag || '' }
                }
                totals[c].amount += e.amount || 0
            }
        })

        // Sort by amount descending
        return Object.entries(totals)
            .sort((a, b) => b[1].amount - a[1].amount)
    }, [filteredExpenses, activeCategory])    // Date navigation
    const navigateDate = (direction: 'prev' | 'next') => {
        const idx = allDates.indexOf(selectedDate)
        if (direction === 'prev' && idx > 0) {
            setSelectedDate(allDates[idx - 1])
        } else if (direction === 'next' && idx < allDates.length - 1) {
            setSelectedDate(allDates[idx + 1])
        }
    }

    const formatDateDisplay = (dateStr: string) => {
        if (!dateStr) return "Invalid Date"
        const d = new Date(dateStr + 'T00:00:00') // Force local timezone

        // 🆕 Phase 12: NaN Guard
        if (isNaN(d.getTime())) {
            console.error(`❌ formatDateDisplay Invalid Date: "${dateStr}"`)
            return dateStr || "Invalid Date"
        }

        const weekday = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
        const dayIndex = allDates.indexOf(dateStr)
        const dayLabel = dayIndex >= 0 ? `Day ${dayIndex + 1}` : ''
        return `${dayLabel} ${d.getMonth() + 1}/${d.getDate()} (${weekday})`
    }

    // fetchExpenses function for use outside of useEffect
    const fetchExpenses = async () => {
        try {
            if (activeTripId) {
                const res = await fetch(`${API_BASE}/api/trips/${activeTripId}/expenses`, {
                    headers: { "X-User-ID": localStorage.getItem("user_uuid") || "" }
                })
                const data = await res.json()
                setExpenses(data || [])
            } else {
                setExpenses([])
            }
        } catch (e) { console.error(e) }
    }

    const handleSaveExpense = async () => {
        if (isSavingExpense) return // 防止重複點擊
        haptic.tap() // 觸覺回饋

        const userId = localStorage.getItem("user_uuid")
        const userName = localStorage.getItem("user_nickname")
        if (!amountJPY || !title) { toast.error("Please fill in amount and title"); haptic.error(); return }

        if (!activeTripId) return
        setIsSavingExpense(true)

        const rateNum = parseFloat(cashback) || 0
        const payload = {
            itinerary_id: activeTripId, title, amount_jpy: parseInt(amountJPY), exchange_rate: inputRate, // 🆕 Isolated rate
            currency: inputCurrency, // 🆕 Isolated currency
            payment_method: method, category: category, is_public: isPublic,
            created_by: userId, creator_name: userName,
            card_name: method === "JCB" || method === "VisaMaster" ? cardName : "",
            cashback_rate: method === "JCB" || method === "VisaMaster" ? rateNum : 0,
            image_url: receiptUrl || null,
            expense_date: expenseDate || formatLocalDate(new Date())
        }

        const url = editItem ? `${API_BASE}/api/expenses/${editItem.id}` : `${API_BASE}/api/expenses`
        const methodType = editItem ? "PATCH" : "POST"

        try {
            const res = await fetch(url, { method: methodType, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
            if (res.ok) {
                haptic.success()
                toast.success(editItem ? "Updated" : "Saved")
                closeDialog()
                setReceiptUrl("")

                // 🆕 Phase 11: Auto-navigate to the added expense date
                const targetDate = expenseDate || formatLocalDate(new Date())
                setSelectedDate(targetDate)
                setExpenseView('daily') // Auto switch to daily view to show the result

                fetchExpenses() // This will refresh the list, and now selectedDate is already set
            } else {
                throw new Error("API Error")
            }
        } catch { haptic.error(); toast.error("Save failed") }
        finally { setIsSavingExpense(false) }
    }

    const handleDeleteExpense = async (id: string) => {
        if (!confirm(t('confirm_delete'))) return
        try {
            await fetch(`${API_BASE}/api/expenses/${id}`, { method: "DELETE" })
            fetchExpenses()
        } catch (e) { console.error(e) }
    }

    const openAddDialog = () => {
        setEditItem(null); setTitle(""); setAmountJPY(""); setMethod("Cash"); setCategory("general"); setIsPublic(true); setReceiptUrl("")
        setExpenseDate(selectedDate || new Date().toISOString().split('T')[0])
        setInputCurrency(selectedCurrency || "JPY") // 🆕 Init with view currency
        setIsDialogOpen(true)
    }
    const openEditDialog = (item: Expense) => {
        setEditItem(item); setTitle(item.title); setAmountJPY(item.amount.toString()); setMethod(item.payment_method || "Cash"); setCategory(item.category || "general"); setIsPublic(item.is_public); setReceiptUrl(item.image_url || "")
        setExpenseDate(item.expense_date || item.created_at?.split('T')[0] || "")
        setInputCurrency(item.currency || "JPY") // 🆕 Load existing currency
        setIsDialogOpen(true)
    }
    const closeDialog = () => { setIsDialogOpen(false); setEditItem(null); setReceiptUrl("") }

    // Re-fetch when active trip changes (already handled by useEffect)
    // But verify on mount if needed
    // ...

    const handleParse = async () => {
        if (!markdown.trim()) return
        setMdLoading(true)
        setParseProgress("🤖 AI 正在解析行程...")
        const apiKey = localStorage.getItem("user_gemini_key") || process.env.NEXT_PUBLIC_DEV_GEMINI_KEY || ""
        try {
            const response = await fetch(`${API_BASE}/api/parse-md`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Gemini-API-Key": apiKey
                },
                body: JSON.stringify({ markdown_text: markdown })
            })
            setParseProgress("🌍 正在地理編碼地點...")
            const data = await response.json()
            if (!response.ok) {
                toast.error(data.detail || "Parse failed")
            } else {
                setMdResult(data)
                toast.success(`✅ 成功解析 ${data.items?.length || 0} 個地點`)
            }
        } catch { toast.error("Parse failed") }
        finally {
            setMdLoading(false)
            setParseProgress(null)
        }
    }

    const handleGenerate = async () => {
        if (!aiPrompt.trim()) return
        setAiLoading(true)
        setGenerateProgress("🤖 AI 正在生成行程...")
        const apiKey = localStorage.getItem("user_gemini_key") || process.env.NEXT_PUBLIC_DEV_GEMINI_KEY || ""

        // 🛡️ 安全檢查：API Key 必須存在
        if (!apiKey) {
            toast.error("請先在設定中輸入 Gemini API Key")
            setAiLoading(false)
            setGenerateProgress(null)
            return
        }

        try {
            const response = await fetch(`${API_BASE}/api/ai-generate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Gemini-API-Key": apiKey
                },
                body: JSON.stringify({ prompt: aiPrompt })
            })
            setGenerateProgress("🌍 正在地理編碼地點...")
            const data = await response.json()
            if (!response.ok) {
                toast.error(data.detail || "Generate failed")
            } else {
                setAiResult(data)
                toast.success(`✅ 成功生成 ${data.data?.items?.length || 0} 個地點`)
            }
        } catch { toast.error("Generate failed") }
        finally {
            setAiLoading(false)
            setGenerateProgress(null)
        }
    }

    const handleSaveTrip = async () => {
        // Prevent double-click
        if (isSaving) return

        const result = mdResult || aiResult
        if (!result?.items) {
            toast.error("No items to save")
            return
        }

        setIsSaving(true)
        const userId = localStorage.getItem("user_uuid")
        const userName = localStorage.getItem("user_nickname")

        if (!userId || !userName) {
            toast.error("Please login first")
            setIsSaving(false)  // 🛡️ 防止按鈕永久禁用
            return
        }

        try {
            if (selectedImportTripId === "new") {
                // 1. 建立新行程
                const response = await fetch(`${API_BASE}/api/save-itinerary`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title: result.title || "New Trip",
                        start_date: result.start_date || new Date().toISOString().split('T')[0],
                        end_date: result.end_date || new Date().toISOString().split('T')[0],
                        items: result.items,
                        user_id: userId,
                        creator_name: userName,
                        daily_locations: result.daily_locations || {}, // 🆕 傳遞每日地點
                        day_notes: result.day_notes || {},
                        day_costs: result.day_costs || {},
                        day_tickets: result.day_tickets || {},
                        day_checklists: result.day_checklists || {},
                        ai_review: result.ai_review
                    })
                })
                const data = await response.json()
                if (response.ok) {
                    toast.success(`行程已建立！房間代碼: ${data.share_code}`)
                    setMarkdown("")
                    setMdResult(null)
                    setAiResult(null)
                    setSelectedImportTripId("new") // Reset
                    mutate((key) => typeof key === 'string' ? key.includes('/api/trips') : Array.isArray(key) && key[0]?.includes('/api/trips'), undefined, { revalidate: true })
                } else {
                    toast.error(data.detail || "Save failed")
                }
            } else {
                // 2. 匯入至現有行程
                const response = await fetch(`${API_BASE}/api/import-to-trip`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        trip_id: selectedImportTripId,
                        items: result.items,
                        daily_locations: result.daily_locations || {},
                        day_notes: result.day_notes || {},
                        day_costs: result.day_costs || {},
                        day_tickets: result.day_tickets || {},
                        day_checklists: result.day_checklists || {},
                        ai_review: result.ai_review
                    })
                })
                const data = await response.json()
                if (response.ok) {
                    toast.success(data.message || "匯入成功")
                    setMarkdown("")
                    setMdResult(null)
                    setAiResult(null)
                    setSelectedImportTripId("new") // Reset
                    // Refresh trip data if active
                    if (activeTripId === selectedImportTripId) {
                        // Force refresh current trip
                        mutate((key) => typeof key === 'string' && key.includes(`/api/trips/${activeTripId}`), undefined, { revalidate: true })
                    }
                } else {
                    toast.error(data.detail || "Import failed")
                }
            }
        } catch { toast.error("Save failed") }
        finally { setIsSaving(false) }
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = (event) => { setMarkdown(event.target?.result as string) }
            reader.readAsText(file)
        }
    }

    // 🆕 v3.8: 信用卡管理函數
    const saveCardsToLocalStorage = (cards: CreditCard[]) => {
        localStorage.setItem("credit_cards", JSON.stringify(cards))
    }

    const openAddCardDialog = () => {
        setEditingCard(null)
        setNewCardName("")
        setNewRewardRate("")
        setNewRewardLimit("")
        setNewCardNotes("")
        setNewCardIsPublic(false) // Default Private
        setCardDialogOpen(true)
    }

    const openEditCardDialog = (card: CreditCard) => {
        setEditingCard(card)
        setNewCardName(card.name)
        setNewRewardRate(String(card.rewardRate))
        setNewRewardLimit(String(card.rewardLimit))
        setNewCardNotes(card.notes)
        setNewCardIsPublic(!!card.is_public)
        setCardDialogOpen(true)
    }

    const handleSaveCard = async () => {
        // 🛡️ Early validation BEFORE setting loading state
        if (!newCardName.trim()) { toast.error("請輸入卡片名稱"); return }
        if (isSavingCard) return // Prevent double-click
        if (newCardIsPublic && !activeTripId) { toast.error("需要選擇行程才能共享卡片"); return }

        setIsSavingCard(true)

        try {
            const userId = localStorage.getItem("user_uuid")

            // 1. Construct Card Data
            const cardData: CreditCard = {
                id: editingCard?.id || crypto.randomUUID(),
                name: newCardName.trim(),
                rewardRate: parseFloat(newRewardRate) || 0,
                rewardLimit: parseFloat(newRewardLimit) || 0,
                notes: newCardNotes.trim(),
                is_public: newCardIsPublic,
                creator_id: userId || undefined
            }

            // 2. Logic Split: Public vs Private
            if (newCardIsPublic) {
                // A. Add/Update in Shared List
                const updatedShared = editingCard
                    ? sharedCards.map(c => c.id === cardData.id ? cardData : c)
                    : [...sharedCards, cardData]

                // B. Remove from Local (Migration case)
                const updatedLocal = localCards.filter(c => c.id !== cardData.id)

                setSharedCards(updatedShared)
                setLocalCards(updatedLocal)
                saveCardsToLocalStorage(updatedLocal)

                // C. Sync to Cloud
                await saveTripInfo(updatedShared)
                toast.success("卡片已儲存 (已共享)")

            } else {
                // A. Add/Update in Local List
                const updatedLocal = editingCard
                    ? localCards.map(c => c.id === cardData.id ? cardData : c)
                    : [...localCards, cardData]

                // B. Remove from Shared (Migration case: Public -> Private)
                const updatedShared = sharedCards.filter(c => c.id !== cardData.id)

                setLocalCards(updatedLocal)
                setSharedCards(updatedShared)
                saveCardsToLocalStorage(updatedLocal)

                // C. Sync Cloud (if we removed something)
                if (updatedShared.length !== sharedCards.length) {
                    await saveTripInfo(updatedShared)
                }
                toast.success("卡片已儲存 (私人)")
            }

            setCardDialogOpen(false)
            haptic.success()
        } catch (e) {
            console.error("Failed to save card:", e)
            toast.error("儲存失敗，請稍後再試")
            haptic.error()
        } finally {
            setIsSavingCard(false) // 🛡️ Always reset loading state
        }
    }

    const handleDeleteCard = (cardId: string) => {
        // 🔧 FIX: Use AlertDialog instead of native confirm()
        setDeletingCardId(cardId)
    }

    const confirmDeleteCard = async () => {
        if (!deletingCardId || isDeletingCard) return

        setIsDeletingCard(true)
        const cardId = deletingCardId
        const targetIsPublic = sharedCards.some(c => c.id === cardId)

        // Optimistic UI: save old state for rollback
        const oldShared = [...sharedCards]
        const oldLocal = [...localCards]

        try {
            if (targetIsPublic) {
                const updatedShared = sharedCards.filter(c => c.id !== cardId)
                setSharedCards(updatedShared)
                await saveTripInfo(updatedShared)
            } else {
                const updatedLocal = localCards.filter(c => c.id !== cardId)
                setLocalCards(updatedLocal)
                saveCardsToLocalStorage(updatedLocal)
            }
            toast.success("卡片已刪除")
            haptic.success()
        } catch {
            // Rollback on error
            setSharedCards(oldShared)
            setLocalCards(oldLocal)
            toast.error("刪除失敗，請重試")
            haptic.error()
        } finally {
            setIsDeletingCard(false)
            setDeletingCardId(null)
        }
    }

    return (
        <>
            {/* 🔧 Phase 14: View manages its own scrolling */}
            {/* 🆕 Refactor: PTR acts as main scroller */}
            <PullToRefresh
                className="h-full bg-stone-50"
                onRefresh={async () => {
                    const r = await getExchangeRate(selectedCurrency || 'JPY')
                    setRate(r)
                    await Promise.all([fetchExpenses(), tripMutate()])
                    toast.success("資料已更新")
                }}
            >
                <div className="min-h-screen pb-32">
                    <div className="bg-gradient-to-b from-slate-900 to-slate-800 pt-12 pb-6 px-6 text-white">
                        <div className="space-y-3">
                            <div>
                                <h1 className="text-3xl font-serif mb-2">{t('tools')}</h1>
                                <p className="text-slate-300 text-sm">{t('expense_ai')}</p>
                            </div>
                            <TripSwitcher className="bg-white/10 text-white border-white/20 hover:bg-white/20" />
                        </div>
                    </div>

                    <div className="px-4 -mt-4">
                        <Tabs value={activeSection} onValueChange={setActiveSection}>
                            {/* Custom Sliding Tab Strip */}
                            <div className="grid grid-cols-3 bg-white dark:bg-slate-800 shadow-md rounded-xl p-1 mb-4">
                                {[
                                    { value: 'cards', label: '💳 卡片' },
                                    { value: 'expense', label: t('expense') },
                                    { value: 'ai', label: t('ai_tools') }
                                ].map((tab) => (
                                    <button
                                        key={tab.value}
                                        onClick={() => setActiveSection(tab.value)}
                                        className={`relative z-10 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${activeSection === tab.value ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    >
                                        {activeSection === tab.value && (
                                            <motion.div
                                                layoutId="tools-tab-indicator"
                                                className="absolute inset-0 bg-slate-100 dark:bg-slate-700 rounded-lg -z-10"
                                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                            />
                                        )}
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* 🆕 v3.8: 信用卡回饋彙整 */}
                            <TabsContent value="cards" className="mt-4 space-y-4">
                                <Card>
                                    <CardContent className="pt-4">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-semibold text-slate-900">我的信用卡</h3>
                                            <Button size="sm" onClick={openAddCardDialog} className="bg-slate-900">
                                                <Plus className="w-4 h-4 mr-1" /> 新增
                                            </Button>
                                        </div>

                                        {creditCards.length === 0 ? (
                                            <div className="text-center py-8 text-slate-400 text-sm">
                                                <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                                <p>尚未新增任何卡片</p>
                                                <p className="text-xs mt-1">點擊「新增」開始記錄回饋資訊</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {creditCards.map((card) => (
                                                    <div key={card.id} className="relative group">
                                                        {/* 🆕 Trash button: always visible on mobile, hover on desktop */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteCard(card.id) }}
                                                            className="absolute -top-2 -right-2 z-10 w-7 h-7 bg-red-500 hover:bg-red-600 active:bg-red-700 rounded-full flex items-center justify-center shadow-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
                                                            aria-label="刪除卡片"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5 text-white" />
                                                        </button>
                                                        <div
                                                            onClick={() => openEditCardDialog(card)}
                                                            className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-4 text-white cursor-pointer hover:shadow-lg transition-shadow"
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="font-semibold text-lg">{card.name}</p>
                                                                        {card.is_public ? (
                                                                            <div className="text-[10px] bg-blue-500/20 text-blue-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                                                <Users className="w-3 h-3" /> 共享
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-[10px] bg-amber-500/20 text-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                                                <User className="w-3 h-3" /> 私有
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-slate-300 text-sm mt-1">
                                                                        回饋 <span className="text-green-400 font-bold">{card.rewardRate}%</span>
                                                                        {card.rewardLimit > 0 && (
                                                                            <span className="ml-2">上限 ${card.rewardLimit.toLocaleString()}</span>
                                                                        )}
                                                                    </p>
                                                                </div>
                                                                <CreditCard className="w-6 h-6 text-slate-400" />
                                                            </div>
                                                            {card.notes && (
                                                                <p className="text-xs text-slate-400 mt-2 line-clamp-2">📝 {card.notes}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="expense" className="mt-4 space-y-4">
                                {/* View Mode Toggle */}
                                <div className="flex gap-2">
                                    <Button
                                        variant={expenseView === 'summary' ? 'default' : 'outline'}
                                        size="sm"
                                        className={cn("flex-1 h-9", expenseView === 'summary' ? 'bg-slate-900' : '')}
                                        onClick={() => setExpenseView('summary')}
                                    >
                                        <PieChart className="w-4 h-4 mr-2" /> {t('total')}
                                    </Button>
                                    <Button
                                        variant={expenseView === 'daily' ? 'default' : 'outline'}
                                        size="sm"
                                        className={cn("flex-1 h-9", expenseView === 'daily' ? 'bg-slate-900' : '')}
                                        onClick={() => setExpenseView('daily')}
                                    >
                                        <List className="w-4 h-4 mr-2" /> 每日
                                    </Button>
                                </div>

                                {/* Owner Filter */}
                                <div className="flex gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg shadow-sm">
                                    {(['all', 'public', 'private'] as const).map(filter => (
                                        <button
                                            key={filter}
                                            onClick={() => setOwnerFilter(filter)}
                                            className={cn(
                                                "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1",
                                                ownerFilter === filter ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                                            )}
                                        >
                                            {filter === 'all' && <>全部</>}
                                            {filter === 'public' && <><Users className="w-3 h-3" /> 公帳</>}
                                            {filter === 'private' && <><User className="w-3 h-3" /> 私帳</>}
                                        </button>
                                    ))}
                                </div>

                                {/* Daily Mode: Date Navigation */}
                                {expenseView === 'daily' && (
                                    <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDate('prev')} disabled={allDates.indexOf(selectedDate) === 0}>
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <span className="font-bold text-slate-800">{selectedDate ? formatDateDisplay(selectedDate) : '-'}</span>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDate('next')} disabled={allDates.indexOf(selectedDate) === allDates.length - 1}>
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}

                                {/* Summary Card - Unified for both Summary and Daily views */}
                                <Card className="border-0 shadow-sm">
                                    <CardContent className="p-4">
                                        <div className="space-y-4">
                                            <ExpenseChart
                                                data={categoryData}
                                                total={totalTWD}
                                                currencySymbol="NT$"
                                                activeCategory={activeCategory}
                                                onCategoryClick={setActiveCategory}
                                            />

                                            <div className="flex flex-col items-center gap-3 pt-2 border-t">
                                                {/* 🆕 Phase 9: Multi-Currency Foreign Totals */}
                                                {foreignTotals.length > 0 && (
                                                    <div className="flex flex-wrap justify-center gap-3">
                                                        {foreignTotals.map(([code, info]) => (
                                                            <div key={code} className="text-center px-3 py-1 bg-slate-50 rounded-lg">
                                                                <span className="text-lg mr-1">{info.flag}</span>
                                                                <span className="font-mono font-bold text-slate-800">
                                                                    {info.symbol}{Math.round(info.amount).toLocaleString()}
                                                                </span>
                                                                <span className="text-xs text-slate-500 ml-1">{code}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="text-center">
                                                    <p className="text-xs text-slate-500">
                                                        {/* Phase 17: Show date for Daily view, category/total for Summary */}
                                                        {expenseView === 'daily'
                                                            ? formatDateDisplay(selectedDate)
                                                            : (activeCategory ? (CATEGORIES[activeCategory]?.label || activeCategory) : t('total'))
                                                        }
                                                    </p>
                                                    <div className="text-3xl font-bold text-slate-900">
                                                        <CountingNumber
                                                            value={activeCategory ? (categoryData.find(c => c.category === activeCategory)?.amount || 0) : totalTWD}
                                                            prefix="NT$"
                                                        />
                                                    </div>
                                                    {totalCashback > 0 && (
                                                        <p className="text-sm text-green-600 font-medium mt-1">💰 回饋 -{totalCashback.toLocaleString()} TWD</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Add Button - Now shown for both views */}
                                <Button disabled={!activeTripId} onClick={openAddDialog} className="w-full bg-slate-900">
                                    <Plus className="w-4 h-4 mr-2" /> {activeTripId ? t('add') : "Please Select a Trip First"}
                                </Button>

                                {/* Expense List */}
                                <div className="space-y-2">
                                    {filteredExpenses.filter(item => !activeCategory || item.category === activeCategory).map((item: Expense) => (
                                        <ExpenseItem key={item.id} item={item} rate={rate} onEdit={openEditDialog} onDelete={handleDeleteExpense} />
                                    ))}
                                    {filteredExpenses.length === 0 && (
                                        <div className="text-center py-10 text-slate-400">
                                            <div className="text-3xl mb-2">📭</div>
                                            <p className="text-sm mb-3">
                                                {expenseView === 'daily'
                                                    ? `${formatDateDisplay(selectedDate)} 還沒有記帳`
                                                    : '暫無記錄'
                                                }
                                            </p>
                                            <Button size="sm" onClick={openAddDialog} disabled={!activeTripId}>
                                                <Plus className="w-4 h-4 mr-1" /> 新增支出
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="ai" className="mt-4 space-y-4">
                                {/* API Key Prompt */}
                                {!hasApiKey && (
                                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-amber-100 p-2 rounded-full">
                                                <Key className="w-4 h-4 text-amber-600" />
                                            </div>
                                            <h3 className="font-semibold text-amber-800">設定 AI 功能</h3>
                                        </div>
                                        <p className="text-sm text-amber-700">
                                            使用 <b>AI 行程產生器</b> 與 <b>文字/Markdown 匯入</b> 前，請先設定 Gemini API Key
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-amber-600">💡 完全免費！</span>
                                            <Button
                                                size="sm"
                                                className="bg-amber-500 hover:bg-amber-600 text-white"
                                                onClick={() => {
                                                    // Navigate to profile (need to use custom event or context)
                                                    const event = new CustomEvent('navigate-to-profile')
                                                    window.dispatchEvent(event)
                                                    toast.info("請在 Profile 頁面設定 AI API Key")
                                                }}
                                            >
                                                前往 Profile 設定 →
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {hasApiKey && (
                                    <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 px-3 py-2 rounded-lg">
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>AI 功能已啟用</span>
                                    </div>
                                )}

                                <Sheet>
                                    <SheetTrigger asChild>
                                        <Button variant="outline" className="h-14 w-full bg-white justify-between">
                                            <span className="flex items-center gap-3">
                                                <div className="bg-amber-100 p-1.5 rounded-full"><Sparkles className="w-4 h-4 text-amber-600" /></div>
                                                {t('ai_generator')}
                                            </span>
                                            <ChevronRight className="w-4 h-4 opacity-30" />
                                        </Button>
                                    </SheetTrigger>
                                    <SheetContent className="w-full sm:max-w-md overflow-y-auto flex flex-col h-full">
                                        <SheetHeader><SheetTitle>{t('ai_generator')}</SheetTitle></SheetHeader>
                                        <div className="flex-1 space-y-4 py-4">
                                            <Textarea placeholder={t('describe_trip')} className="min-h-[100px]" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
                                            <Button className="w-full" onClick={handleGenerate} disabled={aiLoading}>{aiLoading ? <><Loader2 className="animate-spin mr-2" />{generateProgress || t('generating')}</> : <>{t('generate')}</>}</Button>
                                            {aiResult?.items && (
                                                <div className="p-4 bg-stone-100 rounded-xl space-y-3">
                                                    <p className="text-sm text-green-600 font-medium">✅ 已生成 {aiResult.items.length} 個地點</p>

                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-slate-500">儲存位置</Label>
                                                        <Select value={selectedImportTripId} onValueChange={setSelectedImportTripId}>
                                                            <SelectTrigger className="w-full bg-white">
                                                                <SelectValue placeholder="選擇儲存位置" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="new">✨ 建立新行程 (New Trip)</SelectItem>
                                                                {trips.length > 0 && <div className="h-px bg-slate-100 my-1" />}
                                                                {trips.map((trip: Trip) => (
                                                                    <SelectItem key={trip.id} value={trip.id}>
                                                                        📂 {trip.title} (Day {trip.days?.length || 1})
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <Button className="w-full" onClick={handleSaveTrip} disabled={isSaving}>
                                                        {isSaving ? <><Loader2 className="animate-spin mr-2" />處理中...</> : (selectedImportTripId === "new" ? t('save_trip') : "確認匯入")}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </SheetContent>
                                </Sheet>

                                <Sheet>
                                    <SheetTrigger asChild>
                                        <Button variant="outline" className="h-14 w-full bg-white justify-between">
                                            <span className="flex items-center gap-3">
                                                <div className="bg-blue-100 p-1.5 rounded-full"><FileText className="w-4 h-4 text-blue-600" /></div>
                                                {t('markdown_import')}
                                            </span>
                                            <ChevronRight className="w-4 h-4 opacity-30" />
                                        </Button>
                                    </SheetTrigger>
                                    <SheetContent className="w-full sm:max-w-md overflow-y-auto flex flex-col h-full">
                                        <SheetHeader><SheetTitle>{t('markdown_import')}</SheetTitle></SheetHeader>
                                        <div className="flex-1 space-y-4 py-4">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-xs">{t('input_or_upload')}</Label>
                                                <div>
                                                    <input type="file" id="file-upload" className="hidden" accept=".txt,.md" onChange={handleFileUpload} />
                                                    <label htmlFor="file-upload"><span className="text-xs text-blue-600 cursor-pointer hover:underline bg-blue-50 px-2 py-1 rounded"><Upload className="w-3 h-3 inline mr-1" />{t('upload')}</span></label>
                                                </div>
                                            </div>
                                            <Textarea placeholder={t('paste_markdown')} className="min-h-[200px] font-mono text-xs" value={markdown} onChange={e => setMarkdown(e.target.value)} />
                                            <Button className="w-full" onClick={handleParse} disabled={mdLoading}>{mdLoading ? <><Loader2 className="animate-spin mr-2" />{parseProgress || t('parsing')}</> : <>{t('parse')}</>}</Button>
                                            {mdResult?.items && (
                                                <div className="p-4 bg-stone-100 rounded-xl space-y-3">
                                                    <p className="text-sm text-green-600 font-medium">✅ 已解析 {mdResult.items.length} 個地點</p>

                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-slate-500">儲存位置</Label>
                                                        <Select value={selectedImportTripId} onValueChange={setSelectedImportTripId}>
                                                            <SelectTrigger className="w-full bg-white">
                                                                <SelectValue placeholder="選擇儲存位置" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="new">✨ 建立新行程 (New Trip)</SelectItem>
                                                                {trips.length > 0 && <div className="h-px bg-slate-100 my-1" />}
                                                                {trips.map((trip: Trip) => (
                                                                    <SelectItem key={trip.id} value={trip.id}>
                                                                        📂 {trip.title} ({trip.share_code})
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <Button className="w-full" onClick={handleSaveTrip} disabled={isSaving}>
                                                        {isSaving ? <><Loader2 className="animate-spin mr-2" />處理中...</> : (selectedImportTripId === "new" ? t('save_trip') : "確認匯入")}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </SheetContent>
                                </Sheet>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </PullToRefresh>
            < AlertDialog open={!!deletingCardId
            } onOpenChange={(open) => { if (!open) setDeletingCardId(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>確定刪除此卡片？</AlertDialogTitle>
                        <AlertDialogDescription>
                            刪除後將無法恢復。如果是共享卡片，其他成員也將無法看到。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingCard}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeleteCard}
                            disabled={isDeletingCard}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            {isDeletingCard ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                            刪除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog >

            {/* Expense Dialog */}
            < Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen} >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{editItem ? t('edit') : t('add')} {t('expense')}</DialogTitle></DialogHeader>
                    <div className="space-y-5 py-2">
                        {/* 💰 Section 1: Amount Input (Hero Section) */}
                        <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                💰 金額
                            </Label>

                            {/* Currency Selector (Full Width) */}
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

                            {/* Amount Input + TWD Conversion */}
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
                                placeholder="消費名稱（例：午餐、交通卡儲值）"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="h-11 text-base"
                            />

                            {/* Date picker */}
                            {activeTrip?.start_date ? (
                                <select
                                    value={expenseDate}
                                    onChange={e => setExpenseDate(e.target.value)}
                                    className="w-full h-11 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 font-medium"
                                >
                                    {(() => {
                                        const trip = activeTrip as Trip
                                        const startDate = new Date(trip.start_date!)
                                        const endDate = trip.end_date ? new Date(trip.end_date) : null
                                        const totalDays = trip.days?.length ||
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
                                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400 hover:bg-slate-50"
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
                                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400"
                                        )}
                                    >
                                        <m.icon className="w-5 h-5 mb-1" />{m.label}
                                    </button>
                                ))}
                            </div>

                            {/* Credit Card Details (Conditional) */}
                            {(method === "JCB" || method === "VisaMaster") && (
                                <div className="flex gap-2 mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                    <Input placeholder="卡片名稱" value={cardName} onChange={e => setCardName(e.target.value)} className="flex-1 bg-white dark:bg-slate-800" />
                                    <div className="relative w-24">
                                        <input
                                            type="text"
                                            list="cashback-rates"
                                            placeholder="回饋%"
                                            value={cashback}
                                            onChange={e => setCashback(e.target.value)}
                                            className="w-full h-9 px-3 text-sm rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono"
                                        />
                                        <datalist id="cashback-rates">
                                            <option value="0.5">0.5%</option>
                                            <option value="1">1%</option>
                                            <option value="1.5">1.5%</option>
                                            <option value="2">2%</option>
                                            <option value="2.5">2.5%</option>
                                            <option value="3">3%</option>
                                            <option value="5">5%</option>
                                        </datalist>
                                    </div>
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

                        {/* 👥 Section 6: Visibility Toggle */}
                        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                            <Label className="text-sm font-medium flex items-center gap-2">
                                {isPublic ? <><Users className="w-5 h-5 text-blue-500" /> {t('shared')}</> : <><User className="w-5 h-5 text-amber-500" /> {t('private')}</>}
                            </Label>
                            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                        </div>

                        {/* 💾 Save Button */}
                        <Button className="w-full h-12 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-base font-bold shadow-lg" onClick={handleSaveExpense} disabled={isSavingExpense}>
                            {isSavingExpense ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />儲存中...</> : <><CheckCircle2 className="w-5 h-5 mr-2" />{t('save')}</>}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog >

            {/* 🆕 v3.8: 信用卡編輯 Dialog */}
            < Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen} >
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{editingCard ? "編輯卡片" : "新增卡片"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>卡片名稱 *</Label>
                            <Input
                                placeholder="例：玉山 Pi 拍錢包"
                                value={newCardName}
                                onChange={(e) => setNewCardName(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>回饋趴數 (%)</Label>
                                <Input
                                    type="number"
                                    placeholder="例：3.5"
                                    value={newRewardRate}
                                    onChange={(e) => setNewRewardRate(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>回饋上限 (TWD)</Label>
                                <Input
                                    type="number"
                                    placeholder="例：500"
                                    value={newRewardLimit}
                                    onChange={(e) => setNewRewardLimit(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <Label>備忘錄</Label>
                            <Textarea
                                placeholder="例：海外消費限定、需登錄活動..."
                                value={newCardNotes}
                                onChange={(e) => setNewCardNotes(e.target.value)}
                                rows={3}
                            />
                        </div>

                        <div className="flex items-center justify-between bg-slate-100 p-3 rounded-xl">
                            <Label className="flex items-center gap-2 text-sm text-slate-700">
                                {newCardIsPublic ? <><Users className="w-4 h-4 text-blue-500" /> 公開給行程成員</> : <><User className="w-4 h-4 text-amber-500" /> 僅存於此裝置</>}
                            </Label>
                            <Switch checked={newCardIsPublic} onCheckedChange={setNewCardIsPublic} />
                        </div>
                        <Button className="w-full bg-slate-900" onClick={handleSaveCard} disabled={isSavingCard}>
                            {isSavingCard ? "儲存中..." : (editingCard ? "更新" : "新增")}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog >
        </>
    )
}

const ExpenseItem = memo(function ExpenseItem({ item, rate, onEdit, onDelete }: ExpenseItemProps) {
    const methodInfo = PAYMENT_METHODS.find(m => m.id === item.payment_method) || PAYMENT_METHODS[0]
    const catInfo = CATEGORIES[item.category as keyof typeof CATEGORIES] || CATEGORIES['general']
    const CatIcon = catInfo.icon
    const usedRate = item.exchange_rate || rate
    const cashback = item.cashback_rate ? (item.amount * usedRate * item.cashback_rate / 100) : 0
    const finalTWD = Math.round(item.amount * usedRate - cashback)

    return (
        <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-200 shadow-sm group active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-3 overflow-hidden">
                <div className={cn("p-2 rounded-full shrink-0", catInfo.color)}><CatIcon className="w-4 h-4" /></div>
                <div className="min-w-0">
                    <div className="font-bold text-slate-800 truncate text-sm flex items-center gap-2">
                        {item.title}
                        {item.image_url && (
                            <a href={item.image_url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-500">
                                <ImageIcon className="w-3 h-3" />
                            </a>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        {item.card_name ? <span className="bg-indigo-50 text-indigo-600 px-1.5 rounded font-medium">{item.card_name}</span> : <span className="bg-stone-100 text-stone-500 px-1.5 rounded">{methodInfo.label}</span>}
                        <span className={cn("px-1.5 rounded", item.is_public ? "bg-blue-50 text-blue-500" : "bg-amber-50 text-amber-500")}>{item.is_public ? "公帳" : "私帳"}</span>
                        <span>{item.creator_name}</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <div className="text-right mr-2">
                    {/* Smart Formatting */}
                    {(item.currency && item.currency !== "TWD") ? (
                        <div className="flex flex-col items-end">
                            <div className="font-mono font-bold text-slate-900 text-sm flex items-center gap-1">
                                <span className="text-[10px]">{CURRENCIES.find(c => c.code === item.currency)?.flag}</span>
                                {item.amount.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                <span>≈ NT${finalTWD.toLocaleString()}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="font-mono font-bold text-slate-900 text-sm">NT${item.amount.toLocaleString()}</div>
                    )}
                    {(item.cashback_rate ?? 0) > 0 && <span className="text-[10px] text-green-500 block text-right">(-{Math.round(cashback)})</span>}
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-slate-600 hover:bg-slate-100 touch-manipulation" onClick={() => onEdit(item)}><Edit2 className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50 touch-manipulation" onClick={() => onDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
            </div>
        </div>
    )
})
