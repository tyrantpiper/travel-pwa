"use client"

import { useState, useEffect, useMemo, memo, ComponentType, useRef } from "react"
import { motion } from "framer-motion"
import {
    Plus, Trash2, Edit2, ChevronRight, FileText, Loader2,
    Wallet, CreditCard, Train, Utensils, ShoppingBag, Bed, Ticket, Receipt,
    Sparkles, Image as ImageIcon, ChevronLeft, PieChart, List, Users, User,
    Key, Share2, FolderInput, Check, Inbox
} from "lucide-react"
import { AiGrillMeWizard } from "@/components/itinerary/AiGrillMeWizard"
import { AiImportTripWizard } from "@/components/itinerary/AiImportTripWizard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { useLanguage } from "@/lib/LanguageContext"
import { ExpenseChart, CATEGORY_COLORS } from "@/components/expense-chart"
import { useTripContext } from "@/lib/trip-context"
import { encryptData, decryptData, getSecureApiKey } from "@/lib/security"
import { TripSwitcher } from "@/components/trip-switcher"
import { ZenRenew } from "@/components/ui/zen-renew"
import { Virtuoso } from "react-virtuoso"
import { useExpenses, useHaptic, useTripDetail } from "@/lib/hooks"
import { debugLog } from "@/lib/debug"
import { ExpenseDialog } from "@/components/expense-dialog"
import { expensesApi, tripsApi, aiApi } from "@/lib/api"
import { ActuaryDialogCard } from "@/components/ActuaryDialogCard"
import { useOfflineMutation } from "@/lib/sync-hooks"

interface TripMember {
    user_id: string;
    user_name: string;
    user_avatar: string;
}

interface Trip {
    id: string
    title: string
    days?: unknown[]
    share_code?: string
    credit_cards?: CreditCard[]
    flight_info?: Record<string, unknown>
    hotel_info?: Record<string, unknown>
    start_date?: string
    end_date?: string
    members?: TripMember[]
}

interface Expense {
    id: string
    title: string
    total_amount?: number  // 🆕 Primary amount field from V23.1
    amount: number         // Legacy/Fallback field
    payment_method?: string
    category?: string
    custom_icon?: string   // 🆕 Custom category icon (Emoji)
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
    payer_id?: string | null
    payer_name?: string    // 🆕 Guest payer name
    items?: { original_name: string, translated_name?: string, amount: number }[] // 🆕 Replacing 'details'
    details?: { name: string, price: number }[] // ⚠️ Legacy fallback
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
    members?: TripMember[]
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
    { code: 'JPY', symbol: '¥', flag: '🇯🇵' },
    { code: 'USD', symbol: '$', flag: '🇺🇸' },
    { code: 'EUR', symbol: '€', flag: '🇪🇺' },
    { code: 'KRW', symbol: '₩', flag: '🇰🇷' },
    { code: 'CNY', symbol: '¥', flag: '🇨🇳' },
    { code: 'THB', symbol: '฿', flag: '🇹🇭' },
    { code: 'SGD', symbol: 'S$', flag: '🇸🇬' },
    { code: 'HKD', symbol: 'HK$', flag: '🇭🇰' },
    { code: 'TWD', symbol: 'NT$', flag: '🇹🇼' },
] as const

import { getExchangeRate } from "@/lib/currency"
import { CountingNumber } from "@/components/ui/counting-number"
import { type ParsedItinerary } from "@/lib/itinerary-types"
import { type TranslationKey } from "@/lib/LanguageContext"

// 🆕 v22.1: JSON 行程偵測工具
function tryParseItinerary(text: string): ParsedItinerary | null {
    if (!text || !text.includes('{"')) return null
    try {
        const cleanJson = text.replace(/```json|```/g, "").trim()
        const data = JSON.parse(cleanJson)
        if (data.items && Array.isArray(data.items)) return data as ParsedItinerary
        if (data.data && data.data.items) return data.data as ParsedItinerary
    } catch (error) { 
        console.error("Failed to parse itinerary from text:", error)
        return null 
    }
    return null
}

export function ToolsView() {
    const { t } = useLanguage()
    const { activeTrip, activeTripId, trips, mutate: tripMutate, userId, handleTripNotFound } = useTripContext()
    // 🔧 v7 FIX: 載入完整行程資料（含 members），解決成員列表為空的問題
    const { trip: tripDetail } = useTripDetail(activeTripId, userId, 0, handleTripNotFound)
    const tripMembers = tripDetail?.members || activeTrip?.members || []
    const { mutate: offlineMutate } = useOfflineMutation() // 🆕 Resilience Hook
    const [activeSection, setActiveSection] = useState("expense")  // 🔧 FIX: Rename to activeSection
    const [expenses, setExpenses] = useState<Expense[]>([])  // 🔧 FIX: Add missing expenses state

    // 🚀 SWR Hook for Expenses
    const { expenses: swrExpenses, mutate: reloadExpenses } = useExpenses(activeTripId, userId)

    // 🔄 Sync SWR -> Local State
    useEffect(() => {
        if (swrExpenses) {
            setExpenses(swrExpenses)
        } else if (!activeTripId) {
            setExpenses([])
        }
    }, [swrExpenses, activeTripId])

    // 🆕 2026: Integrated global refresh event listener
    useEffect(() => {
        const handleRefresh = () => {
            console.log("🔄 ToolsView: Global refresh triggered via Tab Hub")
            reloadExpenses()
            tripMutate()
        }
        window.addEventListener('refresh-active-view', handleRefresh)
        return () => window.removeEventListener('refresh-active-view', handleRefresh)
    }, [reloadExpenses, tripMutate])

    const [rate, setRate] = useState(0.22)

    // 🆕 v22.1: Listen for cross-module import events (from ChatWidget)
    useEffect(() => {
        const handleAiImport = (e: Event) => {
            const customEvent = e as CustomEvent<{ content: string }>
            const { content } = customEvent.detail
            if (content) {
                const itinerary = tryParseItinerary(content)
                if (itinerary) {
                    setToolsAiResult(itinerary)
                }
                setActiveSection('ai')
                toast.info(t('ai_ready_to_import' as TranslationKey))
            }
        }
        window.addEventListener('ai-import-itinerary', handleAiImport)
        return () => window.removeEventListener('ai-import-itinerary', handleAiImport)
    }, [t])


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


    // View controls
    const [expenseView, setExpenseView] = useState<'summary' | 'daily'>('summary')
    const [ownerFilter, setOwnerFilter] = useState<'all' | 'public' | 'private'>('all')
    const [selectedDate, setSelectedDate] = useState<string>("")
    // 🆕 Chart Filtering State
    const [activeCategory, setActiveCategory] = useState<string | null>(null)

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editItem, setEditItem] = useState<Expense | null>(null)
    const haptic = useHaptic()

    // 🤖 Modern AI Tools state
    const [toolsAiMode, setToolsAiMode] = useState<'wizard' | 'import' | 'freeform'>('wizard')
    const [aiPrompt, setAiPrompt] = useState("")
    const [aiLoading, setAiLoading] = useState(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [toolsAiResult, setToolsAiResult] = useState<any | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [hasApiKey, setHasApiKey] = useState(false)
    const [generateProgress, setGenerateProgress] = useState<string | null>(null)
    const [saveTarget, setSaveTarget] = useState<'new' | 'existing'>('new')
    const [selectedTripId, setSelectedTripId] = useState<string>(() => trips?.[0]?.id || "")

    useEffect(() => {
        if (trips && trips.length > 0 && !selectedTripId) {
            setSelectedTripId(trips[0].id)
        }
    }, [trips, selectedTripId])

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
    const [viewingCard, setViewingCard] = useState<CreditCard | null>(null) // 🆕 Detail View State
    const [newCardName, setNewCardName] = useState("")
    const [newRewardRate, setNewRewardRate] = useState("")
    const [newRewardLimit, setNewRewardLimit] = useState("")
    const [newCardNotes, setNewCardNotes] = useState("")
    const [newCardIsPublic, setNewCardIsPublic] = useState(false) // 🆕
    const [isSavingCard, setIsSavingCard] = useState(false) // 🆕 Prevent double-click
    const [actuaryOpen, setActuaryOpen] = useState(false) // 🆕 Phase 7: AI Actuary
    const [isSharing, setIsSharing] = useState(false) // 🆕 Phase 8: Shared Ledger
    const scrollerRef = useRef<HTMLElement | null>(null) // 🆕 Ref for the actual scroller element

    // 🆕 Phase 8: Shared Ledger Generation
    const handleShareLedger = async () => {
        if (!activeTripId) return
        setIsSharing(true)
        try {
            const userId = localStorage.getItem("user_uuid") || ""
            const res = await fetch(`${API_BASE}/api/trips/${activeTripId}/ledger-share`, {
                method: "PATCH",
                headers: { "x-user-id": userId }
            })
            if (!res.ok) throw new Error("Failed to generate code")

            const { ledger_share_code } = await res.json()
            const shareUrl = `${window.location.origin}/ledger/${ledger_share_code}`

            if (navigator.share) {
                await navigator.share({
                    title: activeTrip?.name || "旅遊公帳",
                    text: "點此查看我們的旅遊公帳明細 🧾",
                    url: shareUrl
                })
            } else {
                await navigator.clipboard.writeText(shareUrl)
                toast.success(t('share_copied') || "連結已複製！傳給朋友吧 🎉")
            }
        } catch (e) {
            console.error(e)
            toast.error(t('share_failed') || "分享失敗，請重試")
        } finally {
            setIsSharing(false)
        }
    }

    useEffect(() => {
        setHasApiKey(!!getSecureApiKey())
    }, [])

    // 🆕 v3.8: 載入信用卡資料 (Local)
    useEffect(() => {
        try {
            // 🛡️ Security Hardened: Decrypt card data on retrieval
            const saved = localStorage.getItem("credit_cards")
            const decrypted = decryptData(saved)
            if (decrypted) {
                setLocalCards(JSON.parse(decrypted))
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
            // 🧠 v4.1: Integrate with Offline Engine & Atomic RPC
            const userId = localStorage.getItem("user_uuid") || ""
            const url = `${API_BASE}/api/trips/${activeTripId}/info`
            const payload = {
                credit_cards: mergedSharedCards // 🕵️ Forensic Fix: Send ONLY cards to prevent clobbering
            }

            // 🛡️ Drop-in replacement with offline queue support
            await offlineMutate(url, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "X-User-ID": userId
                },
                body: JSON.stringify(payload)
            })

            // Re-fetch trip data using context mutate for proper SWR revalidation
            await tripMutate()
        } catch (e) {
            console.error("Failed to sync shared cards:", e)
        }
    }

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
                // 🛡️ 正規化：防止 ISO 時間戳拼接雙 T
                const startStr = (activeTrip.start_date || '').split('T')[0]
                const endStr = (activeTrip.end_date || '').split('T')[0]
                const start = new Date(startStr + 'T00:00:00')
                const end = endStr
                    ? new Date(endStr + 'T00:00:00')
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
            // 🛡️ 關鍵修復：優先讀取 total_amount，防止因為讀取到預設為 0 的 amount 而導致圓餅圖消失
            const val = e.total_amount !== undefined ? e.total_amount : e.amount
            return sum + (val || 0) * usedRate
        }, 0)



        // 計算總回饋金額 (TWD)
        const cashbackTotal = filteredExpenses.reduce((sum, e) => {
            if (e.cashback_rate && e.cashback_rate > 0) {
                const usedRate = e.exchange_rate || rate
                // 🛡️ 關鍵修復：回饋計算也應使用標準化的總額
                const val = e.total_amount !== undefined ? e.total_amount : e.amount
                return sum + Math.round(((val || 0) * usedRate) * e.cashback_rate / 100)
            }
            return sum
        }, 0)

        const cats: Record<string, number> = {}
        filteredExpenses.forEach(e => {
            const cat = e.category || 'general'
            // Category chart uses TWD value for standardized comparison
            const usedRate = e.exchange_rate || (e.currency === selectedCurrency ? rate : 0.22)
            // 🛡️ 關鍵修復：對齊總額欄位
            const val = e.total_amount !== undefined ? e.total_amount : e.amount
            const amountTWD = (val || 0) * usedRate
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
                // 🛡️ 關鍵修復：外幣加總也應對齊
                const val = e.total_amount !== undefined ? e.total_amount : e.amount
                totals[c].amount += val || 0
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
        // 🛡️ 防禦 ISO 時間戳：先截斷再拼接（避免雙 T）
        const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
        const d = new Date(cleanDate + 'T00:00:00') // Force local timezone

        // 🆕 Phase 12: NaN Guard
        if (isNaN(d.getTime())) {
            console.error(`❌ formatDateDisplay Invalid Date: "${dateStr}"`)
            return dateStr || "Invalid Date"
        }

        const weekdays = [t('weekday_sun'), t('weekday_mon'), t('weekday_tue'), t('weekday_wed'), t('weekday_thu'), t('weekday_fri'), t('weekday_sat')]
        const weekday = weekdays[d.getDay()]
        const dayIndex = allDates.indexOf(dateStr)
        const dayLabel = dayIndex >= 0 ? `Day ${dayIndex + 1}` : ''
        return `${dayLabel} ${d.getMonth() + 1}/${d.getDate()} (${weekday})`
    }

    const handleDeleteExpense = async (id: string) => {
        if (!confirm(t('confirm_delete'))) return
        try {
            const userId = localStorage.getItem("user_uuid") || ""
            await expensesApi.delete(id, userId)
            reloadExpenses() // 🔄 Use SWR mutate
        } catch (e) { console.error(e) }
    }

    const openAddDialog = () => {
        setEditItem(null)
        setIsDialogOpen(true)
    }
    const openEditDialog = (item: Expense) => {
        setEditItem(item)
        setIsDialogOpen(true)
    }

    // Re-fetch when active trip changes (already handled by useEffect)
    // But verify on mount if needed
    // ...

    const handleAiGenerate = async (customPrompt?: string) => {
        const p = customPrompt || aiPrompt
        if (!p?.trim()) return
        haptic.tap()
        setAiLoading(true)
        setGenerateProgress(t('tv_ai_generating'))
        const activeUserId = localStorage.getItem("user_uuid") || userId || ""

        try {
            const response = await aiApi.generateTrip({
                prompt: p,
                user_id: activeUserId
            })
            setGenerateProgress(t('tv_ai_geocoding'))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const itineraryData = (response as any).data || response
            if (!itineraryData.items || itineraryData.items.length === 0) {
                setToolsAiResult(null)
                toast.error("AI 未能生成有效的景點列表，請再試一次")
                return
            }
            haptic.success()
            setToolsAiResult(itineraryData)
            toast.success(t('tv_ai_generated', { count: String(itineraryData.items?.length || 0) }))
        } catch (error) {
            haptic.error()
            const msg = error instanceof Error ? error.message : "Generate failed"
            toast.error(`生成失敗: ${msg}`)
            setToolsAiResult(null)
        } finally {
            setAiLoading(false)
            setGenerateProgress(null)
        }
    }

    const handleSaveTrip = async () => {
        if (isSaving) return
        const result = toolsAiResult
        if (!result?.items) {
            toast.error("No items to save")
            return
        }

        haptic.tap()
        setIsSaving(true)
        const activeUserId = localStorage.getItem("user_uuid") || userId
        const userName = localStorage.getItem("user_nickname")

        if (!activeUserId || !userName) {
            toast.error("Please login first")
            setIsSaving(false)
            return
        }

        try {
            if (saveTarget === 'existing' && (selectedTripId || trips?.[0]?.id)) {
                const targetId = selectedTripId || trips[0].id
                const data = await tripsApi.importToTrip(targetId, {
                    items: result.items,
                    daily_locations: result.daily_locations || {},
                    day_notes: result.day_notes || {},
                    day_costs: result.day_costs || {},
                    day_tickets: result.day_tickets || {},
                    day_checklists: result.day_checklists || {},
                    ai_review: result.ai_review,
                    user_id: activeUserId
                })

                haptic.success()
                toast.success(data.message || t('trip_merged_success'))
                setToolsAiResult(null)
                setAiPrompt("")
                setSaveTarget('new')
                await Promise.all([tripMutate(), reloadExpenses()])
            } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const maxDay = result.items?.length > 0 ? Math.max(...result.items.map((it: any) => it.day_number || it.day || 1)) : 1
                const startDateStr = result.start_date || new Date().toISOString().split('T')[0]
                const startDateObj = new Date(startDateStr)
                const calculatedEndDateObj = new Date(startDateObj)
                calculatedEndDateObj.setDate(calculatedEndDateObj.getDate() + (maxDay - 1))
                const endDateStr = result.end_date || calculatedEndDateObj.toISOString().split('T')[0]

                const data = await tripsApi.saveItinerary({
                    title: result.title || "New AI Trip",
                    start_date: startDateStr,
                    end_date: endDateStr,
                    items: result.items,
                    user_id: activeUserId,
                    creator_name: userName || "Traveler",
                    daily_locations: result.daily_locations || {},
                    day_notes: result.day_notes || {},
                    day_costs: result.day_costs || {},
                    day_tickets: result.day_tickets || {},
                    day_checklists: result.day_checklists || {},
                    ai_review: result.ai_review
                })

                haptic.success()
                toast.success(t('tv_trip_created', { code: data.share_code }))
                setToolsAiResult(null)
                setAiPrompt("")
                setSaveTarget('new')
                await Promise.all([tripMutate(), reloadExpenses()])
            }
        } catch (error) {
            haptic.error()
            toast.error(error instanceof Error ? error.message : "Save failed")
        } finally {
            setIsSaving(false)
        }
    }

    // 🆕 v3.8: 信用卡管理函數
    const saveCardsToLocalStorage = (cards: CreditCard[]) => {
        // 🛡️ Security Hardened: Encrypt card data before storage
        localStorage.setItem("credit_cards", encryptData(JSON.stringify(cards)))
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
        if (!newCardName.trim()) { toast.error(t('tv_card_name_required')); return }
        if (isSavingCard) return // Prevent double-click
        if (newCardIsPublic && !activeTripId) { toast.error(t('tv_card_need_trip')); return }

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

            // 🧠 v3.11: Atomic Migration Logic (Fixes Data Loss)
            // Regardless of current/previous state, we purge from BOTH lists first
            const purgedLocal = localCards.filter(c => c.id !== cardData.id)
            const purgedShared = sharedCards.filter(c => c.id !== cardData.id)

            // 🧠 v4.5: Always Sync to Cloud for Cross-Device Support
            // Regardless of public/private state, we store on server for user sync.
            const updatedShared = [...purgedShared, cardData]
            setSharedCards(updatedShared)

            // Clean up local storage for this card (migration)
            setLocalCards(purgedLocal)
            saveCardsToLocalStorage(purgedLocal)

            await saveTripInfo(updatedShared)

            toast.success(newCardIsPublic ? t('tv_card_saved_public') : t('tv_card_saved_private'))
            setCardDialogOpen(false)
            setViewingCard(null)
            haptic.success()
        } catch (e) {
            console.error("Failed to save card:", e)
            toast.error(t('tv_card_save_failed'))
            haptic.error()
        } finally {
            setIsSavingCard(false)
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
        const isOnCloud = sharedCards.some(c => c.id === cardId)

        // Optimistic UI: save old state for rollback
        const oldShared = [...sharedCards]
        const oldLocal = [...localCards]

        try {
            // Check if card is on cloud
            if (isOnCloud) {
                const updatedShared = sharedCards.filter(c => c.id !== cardId)
                setSharedCards(updatedShared)
                await saveTripInfo(updatedShared)
            }

            // Also check/clean local (migration safety)
            if (localCards.some(c => c.id === cardId)) {
                const updatedLocal = localCards.filter(c => c.id !== cardId)
                setLocalCards(updatedLocal)
                saveCardsToLocalStorage(updatedLocal)
            }
            toast.success(t('tv_card_deleted'))
            haptic.success()
        } catch {
            // Rollback on error
            setSharedCards(oldShared)
            setLocalCards(oldLocal)
            toast.error(t('tv_card_delete_failed'))
            haptic.error()
        } finally {
            setIsDeletingCard(false)
            setDeletingCardId(null)
        }
    }

    return (
        <>
            <div className="h-full bg-stone-50 dark:bg-slate-950 overflow-y-auto overflow-x-hidden overscroll-y-contain overscroll-x-none">
                <div className="min-h-screen pb-32">
                    <div className="bg-linear-to-b from-slate-900 to-slate-800 pt-12 pb-6 px-6 text-white">
                        <div className="space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h1 className="text-3xl font-serif mb-2">{t('tools')}</h1>
                                    <p className="text-slate-300 text-sm">{t('expense_ai')}</p>
                                </div>
                                <ZenRenew
                                    onRefresh={async () => {
                                        const r = await getExchangeRate(selectedCurrency || 'JPY')
                                        setRate(r)
                                        await Promise.all([reloadExpenses(), tripMutate()])
                                    }}
                                    successMessage={t('tv_receipt_synced')}
                                    errorMessage={t('update_failed')}
                                    className="text-white/80 hover:text-white"
                                />
                            </div>
                            <TripSwitcher className="bg-white/10 text-white border-white/20 hover:bg-white/20" />
                        </div>
                    </div>

                    <div className="px-4 -mt-4">
                        <Tabs value={activeSection} onValueChange={setActiveSection}>
                            {/* Custom Sliding Tab Strip */}
                            <div className="grid grid-cols-3 bg-white dark:bg-slate-800 shadow-md rounded-xl p-1 mb-4">
                                {[
                                    { value: 'cards', label: t('tv_cards') },
                                    { value: 'expense', label: t('expense') },
                                    { value: 'ai', label: t('ai_tools') }
                                ].map((tab) => (
                                    <button
                                        key={tab.value}
                                        onClick={() => {
                                            if (activeSection !== tab.value) {
                                                setActiveSection(tab.value)
                                            }
                                        }}
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
                                            <h3 className="font-semibold text-slate-900">{t('tv_my_cards')}</h3>
                                            <Button size="sm" onClick={openAddCardDialog} className="bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                                                <Plus className="w-4 h-4 mr-1" /> {t('tv_add_card')}
                                            </Button>
                                        </div>

                                        {creditCards.length === 0 ? (
                                            <div className="text-center py-8 text-slate-400 text-sm">
                                                <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                                <p>{t('tv_no_cards')}</p>
                                                <p className="text-xs mt-1">{t('tv_no_cards_hint')}</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {creditCards.map((card) => (
                                                    <div key={card.id} className="relative group">
                                                        {/* 🆕 Trash button: always visible on mobile, hover on desktop */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteCard(card.id) }}
                                                            className="absolute -top-3 -right-3 z-10 w-10 h-10 bg-red-500 hover:bg-red-600 active:bg-red-700 rounded-full flex items-center justify-center shadow-lg opacity-100 transition-all scale-100 active:scale-90 touch-manipulation"
                                                            aria-label={t('tv_delete_card')}
                                                        >
                                                            <Trash2 className="w-4 h-4 text-white" />
                                                        </button>
                                                        <div
                                                            onClick={() => setViewingCard(card)}
                                                            className="bg-linear-to-r from-slate-800 to-slate-700 rounded-xl p-4 text-white cursor-pointer hover:shadow-lg transition-all border border-slate-600/30 active:scale-[0.98]"
                                                        >
                                                            <div className="flex justify-between items-start gap-2">
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="font-semibold text-lg truncate min-w-0">{card.name}</p>

                                                                    <div className="flex gap-1 mt-1.5 mb-2 shrink-0">
                                                                        {card.is_public ? (
                                                                            <div className="text-[10px] bg-blue-500/20 text-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-500/30">
                                                                                <Users className="w-3 h-3" /> {t('tv_shared_card')}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-[10px] bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-500/30">
                                                                                <User className="w-3 h-3" /> {t('tv_private_card')}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <p className="text-slate-300 text-sm flex items-center gap-1">
                                                                        {t('tv_reward_rate')} <span className="text-green-400 font-bold">{card.rewardRate}%</span>
                                                                        {card.rewardLimit > 0 && (
                                                                            <span className="ml-2 bg-slate-900/40 px-2 py-0.5 rounded-md border border-white/10 shrink-0">{t('tv_reward_limit')} ${card.rewardLimit.toLocaleString()}</span>
                                                                        )}
                                                                    </p>
                                                                </div>
                                                                <CreditCard className="w-6 h-6 text-slate-400 shrink-0 opacity-40" />
                                                            </div>
                                                            {card.notes && (
                                                                <p className="text-xs text-slate-400 mt-2 line-clamp-1 opacity-70">📝 {card.notes}</p>
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
                                {/* View Mode Toggle and Share Action */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex gap-2 flex-1 max-w-55">
                                        <Button
                                            variant={expenseView === 'summary' ? 'default' : 'outline'}
                                            size="sm"
                                            className={cn("flex-1 h-11", expenseView === 'summary' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'dark:text-white dark:border-slate-700')}
                                            onClick={() => setExpenseView('summary')}
                                        >
                                            <PieChart className="w-4 h-4 mr-2" /> {t('total')}
                                        </Button>
                                        <Button
                                            variant={expenseView === 'daily' ? 'default' : 'outline'}
                                            size="sm"
                                            className={cn("flex-1 h-11", expenseView === 'daily' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'dark:text-white dark:border-slate-700')}
                                            onClick={() => setExpenseView('daily')}
                                        >
                                            <List className="w-4 h-4 mr-2" /> {t('tv_list')}
                                        </Button>
                                    </div>

                                    {/* Phase 8 Share Public Ledger */}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleShareLedger}
                                        disabled={isSharing || !activeTripId}
                                        className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border border-transparent hover:border-indigo-100"
                                    >
                                        {isSharing
                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                            : <Share2 className="w-4 h-4" />
                                        }
                                        <span className="ml-1 font-semibold">{t('share_ledger_btn') || "分享公帳"}</span>
                                    </Button>
                                </div>

                                {/* Owner Filter */}
                                <div className="flex gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg shadow-sm">
                                    {(['all', 'public', 'private'] as const).map(filter => (
                                        <button
                                            key={filter}
                                            onClick={() => setOwnerFilter(filter)}
                                            className={cn(
                                                "flex-1 h-11 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1",
                                                ownerFilter === filter ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                                            )}
                                        >
                                            {filter === 'all' && <>{t('tv_filter_all')}</>}
                                            {filter === 'public' && <><Users className="w-3 h-3" /> {t('tv_filter_public')}</>}
                                            {filter === 'private' && <><User className="w-3 h-3" /> {t('tv_filter_private')}</>}
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
                                <Card className="border-0 shadow-sm dark:bg-slate-900">
                                    <CardContent className="p-5">
                                        <div className="space-y-5">
                                            <ExpenseChart
                                                data={categoryData}
                                                total={totalTWD}
                                                currencySymbol="NT$"
                                                activeCategory={activeCategory}
                                                onCategoryClick={setActiveCategory}
                                            />

                                            <div className="flex flex-col items-center gap-3 pt-3 border-t dark:border-slate-800">
                                                {/* 🆕 Phase 9: Multi-Currency Foreign Totals */}
                                                {foreignTotals.length > 0 && (
                                                    <div className="flex flex-wrap justify-center gap-3">
                                                        {foreignTotals.map(([code, info]) => (
                                                            <div key={code} className="text-center px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-transparent dark:border-slate-800">
                                                                <span className="text-lg mr-1.5">{info.flag}</span>
                                                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                                    {info.symbol}{Math.round(info.amount).toLocaleString()}
                                                                </span>
                                                                <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-medium">{code}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="text-center">
                                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                                        {/* Phase 17: Show date for Daily view, category/total for Summary */}
                                                        {expenseView === 'daily'
                                                            ? formatDateDisplay(selectedDate)
                                                            : (activeCategory ? (CATEGORIES[activeCategory]?.label || activeCategory) : t('total'))
                                                        }
                                                    </p>
                                                    <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                                                        <CountingNumber
                                                            value={activeCategory ? (categoryData.find(c => c.category === activeCategory)?.amount || 0) : totalTWD}
                                                            prefix="NT$"
                                                        />
                                                    </div>
                                                    {totalCashback > 0 && (
                                                        <p className="text-sm text-green-600 font-medium mt-1">💰 {t('tv_cashback_return', { amount: totalCashback.toLocaleString() })}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Features Group: Add & AI Actuary */}
                                <div className="space-y-2">
                                    <Button disabled={!activeTripId} onClick={openAddDialog} className="w-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 h-10">
                                        <Plus className="w-4 h-4 mr-2" /> {activeTripId ? t('add') : "Please Select a Trip First"}
                                    </Button>

                                    <Button
                                        onClick={() => setActuaryOpen(true)}
                                        disabled={!activeTripId}
                                        className="w-full gap-2 bg-linear-to-r from-violet-500 hover:from-violet-600 to-indigo-500 hover:to-indigo-600 text-white font-bold h-11 rounded-xl shadow-lg border-0 transition-all active:scale-[0.98]"
                                        variant="outline"
                                    >
                                        🤖 {t('actuary_btn') || "AI 一鍵精算"}
                                    </Button>
                                </div>

                                {/* Expense List (Virtualized) */}
                                <div className="space-y-2 h-[50vh]">
                                    <Virtuoso
                                        style={{ height: '100%' }}
                                        scrollerRef={(ref) => {
                                            if (ref instanceof HTMLElement) scrollerRef.current = ref
                                        }}
                                        data={filteredExpenses.filter(item => !activeCategory || item.category === activeCategory)}
                                        components={{
                                            Header: () => <div id="ptr-ghost-anchor" className="h-0" />
                                        }}
                                        itemContent={(index, item) => (
                                            <div className="px-5 py-2">
                                                <ExpenseItem
                                                    item={item}
                                                    rate={rate}
                                                    members={activeTrip?.members}
                                                    onEdit={openEditDialog}
                                                    onDelete={handleDeleteExpense}
                                                />
                                            </div>
                                        )}
                                    />
                                </div>
                                {filteredExpenses.length === 0 && (
                                    <div className="text-center py-10 text-slate-400">
                                        <div className="flex justify-center mb-4">
                                            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full">
                                                <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                            </div>
                                        </div>
                                        <p className="text-sm mb-3">
                                            {expenseView === 'daily'
                                                ? t('tv_no_expense_date', { date: formatDateDisplay(selectedDate) })
                                                : t('tv_no_expenses')
                                            }
                                        </p>
                                        <Button size="sm" onClick={openAddDialog} disabled={!activeTripId} className="dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
                                            <Plus className="w-4 h-4 mr-1" /> {t('tv_add_expense')}
                                        </Button>
                                    </div>
                                )}
                            </TabsContent>

                            {/* 🤖 現代化 AI 工具箱 (Grill-Me ✕ 多模態匯入 ✕ 自由輸入) */}
                            <TabsContent value="ai" className="mt-4 space-y-4">
                                {!hasApiKey && (
                                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Key className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                            <h3 className="font-semibold text-amber-800 dark:text-amber-200">{t('tv_setup_ai')}</h3>
                                        </div>
                                        <p className="text-xs text-amber-700 dark:text-amber-300">
                                            {t('tv_setup_ai_desc')}
                                        </p>
                                        <div className="flex items-center justify-between pt-1">
                                            <span className="text-xs text-amber-600 dark:text-amber-400">{t('tv_setup_ai_hint')}</span>
                                            <Button
                                                size="sm"
                                                className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl cursor-pointer"
                                                onClick={() => {
                                                    const event = new CustomEvent('navigate-to-profile')
                                                    window.dispatchEvent(event)
                                                    toast.info(t('tv_go_profile'))
                                                }}
                                            >
                                                {t('tv_go_profile')}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* 生成/解析結果預覽與儲存卡片 */}
                                {toolsAiResult && !aiLoading && (
                                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-md border border-stone-200 dark:border-slate-700 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-indigo-500" />
                                                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{toolsAiResult.title || "AI 規劃結果"}</span>
                                            </div>
                                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 font-semibold">
                                                {toolsAiResult.items?.length || 0} {t('trip_preview_spots')}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            📅 {toolsAiResult.start_date || "2026-10-01"} ~ {toolsAiResult.end_date || "2026-10-05"}
                                        </p>

                                        {/* 📥 儲存目標選擇 (新建 vs 合併) */}
                                        <div className="space-y-2 pt-2 border-t border-stone-200/80 dark:border-slate-700/80">
                                            <div className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                                                <span>{t('save_target_label')}</span>
                                                <span className="text-[11px] font-normal text-slate-400">{t('save_target_desc')}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        haptic.selection()
                                                        setSaveTarget('new')
                                                    }}
                                                    className={cn(
                                                        "p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer select-none active:scale-98",
                                                        saveTarget === 'new'
                                                            ? "bg-indigo-500/10 dark:bg-indigo-400/15 border-indigo-500 dark:border-indigo-400 text-indigo-700 dark:text-indigo-300 font-bold shadow-2xs"
                                                            : "bg-stone-50 dark:bg-slate-900 border-stone-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                                    )}
                                                >
                                                    <Plus className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
                                                    <span className="text-xs">{t('save_as_new_trip')}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={!trips || trips.length === 0}
                                                    onClick={() => {
                                                        haptic.selection()
                                                        setSaveTarget('existing')
                                                        if (!selectedTripId && trips && trips.length > 0) {
                                                            setSelectedTripId(trips[0].id)
                                                        }
                                                    }}
                                                    className={cn(
                                                        "p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer select-none active:scale-98 disabled:opacity-40",
                                                        saveTarget === 'existing'
                                                            ? "bg-indigo-500/10 dark:bg-indigo-400/15 border-indigo-500 dark:border-indigo-400 text-indigo-700 dark:text-indigo-300 font-bold shadow-2xs"
                                                            : "bg-stone-50 dark:bg-slate-900 border-stone-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                                    )}
                                                >
                                                    <FolderInput className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
                                                    <span className="text-xs">{t('merge_into_existing_trip')}</span>
                                                </button>
                                            </div>

                                            {saveTarget === 'existing' && trips && trips.length > 0 && (
                                                <div className="pt-1">
                                                    <select
                                                        value={selectedTripId || trips[0]?.id}
                                                        onChange={e => setSelectedTripId(e.target.value)}
                                                        className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer outline-hidden focus:border-indigo-500"
                                                    >
                                                        {trips.map(tr => (
                                                            <option key={tr.id} value={tr.id}>
                                                                {tr.title} ({tr.start_date || ""} ~ {tr.end_date || ""})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 pt-1">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => {
                                                    haptic.tap()
                                                    setToolsAiResult(null)
                                                }}
                                                className="h-10 px-3 text-xs rounded-xl cursor-pointer"
                                            >
                                                {t('replan_btn')}
                                            </Button>
                                            <Button
                                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl h-10 shadow-sm cursor-pointer"
                                                onClick={handleSaveTrip}
                                                disabled={isSaving}
                                            >
                                                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
                                                {saveTarget === 'existing' ? t('save_and_merge') : t('save_as_trip')}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* AI 子功能切換 (三合一分段選擇器) */}
                                {!toolsAiResult && (
                                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-stone-200/80 dark:border-slate-700 space-y-4">
                                        <div className="flex bg-stone-100 dark:bg-slate-900 p-0.5 rounded-xl border border-stone-200/80 dark:border-slate-800 text-xs font-semibold select-none">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    haptic.selection()
                                                    setToolsAiMode('wizard')
                                                }}
                                                className={cn(
                                                    "flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1",
                                                    toolsAiMode === 'wizard'
                                                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs font-bold"
                                                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                                )}
                                            >
                                                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                                                <span>{t('mode_grill_me')}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    haptic.selection()
                                                    setToolsAiMode('import')
                                                }}
                                                className={cn(
                                                    "flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1",
                                                    toolsAiMode === 'import'
                                                        ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-2xs font-bold"
                                                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                                )}
                                            >
                                                <FileText className="w-3.5 h-3.5 text-emerald-500" />
                                                <span>多模態匯入</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    haptic.selection()
                                                    setToolsAiMode('freeform')
                                                }}
                                                className={cn(
                                                    "flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1",
                                                    toolsAiMode === 'freeform'
                                                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs font-bold"
                                                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                                )}
                                            >
                                                <span>{t('mode_freeform')}</span>
                                            </button>
                                        </div>

                                        {/* 1. 🧙‍♂️ Grill-Me 5 步智能引導 */}
                                        {toolsAiMode === 'wizard' && (
                                            <AiGrillMeWizard
                                                onComplete={(xmlPrompt) => handleAiGenerate(xmlPrompt)}
                                            />
                                        )}

                                        {/* 2. 📝 多模態筆記/圖片解析 */}
                                        {toolsAiMode === 'import' && (
                                            <AiImportTripWizard
                                                userId={userId || ""}
                                                onComplete={(data) => setToolsAiResult(data)}
                                            />
                                        )}

                                        {/* 3. ✍️ 自由提示詞輸入 */}
                                        {toolsAiMode === 'freeform' && (
                                            <div className="space-y-4 pt-1">
                                                <div className="space-y-2">
                                                    <Label>{t('ai_prompt_label')}</Label>
                                                    <Textarea
                                                        value={aiPrompt}
                                                        onChange={e => setAiPrompt(e.target.value)}
                                                        placeholder={t('ai_prompt_placeholder')}
                                                        rows={4}
                                                        className="resize-none font-sans rounded-xl bg-stone-50 dark:bg-slate-900"
                                                    />
                                                    <p className="text-xs text-slate-400">{t('ai_prompt_hint')}</p>
                                                </div>

                                                <Button
                                                    className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md cursor-pointer transition-all active:scale-[0.99]"
                                                    onClick={() => handleAiGenerate()}
                                                    disabled={aiLoading || !aiPrompt.trim()}
                                                >
                                                    {aiLoading ? (
                                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{generateProgress || t('generating')}</>
                                                    ) : (
                                                        <><Sparkles className="w-4 h-4 mr-2" />{t('ai_generate_btn')}</>
                                                    )}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </div >
            < AlertDialog open={!!deletingCardId
            } onOpenChange={(open) => { if (!open) setDeletingCardId(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('tv_confirm_delete_card')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('tv_confirm_delete_card_desc')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingCard}>{t('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeleteCard}
                            disabled={isDeletingCard}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            {isDeletingCard ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                            {t('delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog >

            <ExpenseDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                editItem={editItem}
                activeTripId={activeTripId}
                activeTrip={activeTrip ? { ...activeTrip, members: tripMembers } : null}
                selectedCurrency={selectedCurrency}
                onSaveSuccess={(targetDate: string) => {
                    setSelectedDate(targetDate)
                    setExpenseView('daily')
                    reloadExpenses()
                }}
            />

            {/* 🆕 v4.2: 信用卡詳情預覽 Sheet - 修正標題壓迫感與內容截斷問題 */}
            <Sheet open={!!viewingCard} onOpenChange={(open) => !open && setViewingCard(null)}>
                <SheetContent
                    side="bottom"
                    className="rounded-t-[2.5rem] max-h-[95dvh] p-0 border-0 bg-slate-900 text-white overflow-hidden shadow-2xl transition-all duration-300"
                >
                    {viewingCard && (
                        <div className="flex flex-col h-full max-h-[95dvh]">
                            {/* Decorative Header - 增加高度與內部間距 (Breathing Room) */}
                            <SheetHeader className="relative pt-10 pb-8 px-8 bg-linear-to-br from-indigo-600 via-indigo-700 to-slate-900 overflow-hidden shrink-0">
                                {/* Background Decorative Element */}
                                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />

                                <div className="relative z-10 space-y-3">
                                    <div className="flex gap-2">
                                        {viewingCard.is_public ? (
                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/30 text-blue-100 px-3 py-1 rounded-full border border-blue-400/40 flex items-center gap-1.5 backdrop-blur-md">
                                                <Users className="w-3 h-3" /> {t('tv_shared_card')}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/30 text-amber-100 px-3 py-1 rounded-full border border-amber-400/40 flex items-center gap-1.5 backdrop-blur-md">
                                                <User className="w-3 h-3" /> {t('tv_private_card')}
                                            </span>
                                        )}
                                    </div>

                                    <SheetTitle className="text-xl md:text-2xl font-black text-white leading-tight pr-8">
                                        {viewingCard.name}
                                    </SheetTitle>
                                    <SheetDescription className="sr-only">
                                        {t('tv_card_detail_title')}
                                    </SheetDescription>
                                </div>
                            </SheetHeader>

                            {/* Scrollable Content Area */}
                            <div className="p-8 space-y-8 flex-1 overflow-y-auto overscroll-contain pb-32">
                                <div className="grid grid-cols-2 gap-5">
                                    <div className="bg-white/5 border border-white/10 rounded-3xl p-5 hover:bg-white/10 transition-colors">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t('tools_reward_preview')}</p>
                                        <p className="text-3xl font-black text-emerald-400 tracking-tight">
                                            {viewingCard.rewardRate}
                                            <span className="text-sm font-bold ml-1 opacity-70">%</span>
                                        </p>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-3xl p-5 hover:bg-white/10 transition-colors">
                                        <p className="text-[10px] font-bold text-slate-440 uppercase tracking-widest mb-2">{t('tv_reward_limit')}</p>
                                        <div className="flex items-baseline gap-1">
                                            {viewingCard.rewardLimit > 0 ? (
                                                <>
                                                    <span className="text-sm font-bold text-slate-400">NT$</span>
                                                    <p className="text-3xl font-black tracking-tight">{viewingCard.rewardLimit.toLocaleString()}</p>
                                                </>
                                            ) : (
                                                <span className="text-slate-500 text-xl font-bold italic tracking-tight">{t('tv_no_limit')}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {viewingCard.notes && (
                                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50" />
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <FileText className="w-3 h-3 text-indigo-400" /> {t('tv_card_memo')}
                                        </p>
                                        <div className="text-sm text-slate-100 leading-relaxed font-medium whitespace-pre-wrap">
                                            {viewingCard.notes}
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons Container */}
                                <div className="flex gap-4 pt-4">
                                    <Button
                                        variant="outline"
                                        className="flex-3 bg-white text-slate-900 hover:bg-slate-200 border-0 h-14 rounded-2xl font-bold text-base shadow-lg active:scale-95 transition-all"
                                        onClick={() => openEditCardDialog(viewingCard)}
                                    >
                                        <Edit2 className="w-5 h-5 mr-2" /> {t('tv_edit_card')}
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        className="flex-1 h-14 rounded-2xl p-0 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white transition-all shadow-lg active:scale-95"
                                        onClick={() => {
                                            setViewingCard(null)
                                            handleDeleteCard(viewingCard.id)
                                        }}
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            {/* 🆕 v3.8: 信用卡編輯 Dialog */}
            < Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen} >
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{editingCard ? t('tv_edit_card_title') : t('tv_new_card')}</DialogTitle>
                        <DialogDescription className="sr-only">
                            {t('tv_card_dialog_desc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>{t('tv_card_name_label')}</Label>
                            <Input
                                placeholder={t('tv_card_name_ph')}
                                value={newCardName}
                                onChange={(e) => setNewCardName(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>{t('tv_reward_rate_label')}</Label>
                                <Input
                                    type="number"
                                    placeholder={t('tv_reward_rate_ph')}
                                    value={newRewardRate}
                                    onChange={(e) => setNewRewardRate(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>{t('tv_reward_limit_label')}</Label>
                                <Input
                                    type="number"
                                    placeholder={t('tv_reward_limit_ph')}
                                    value={newRewardLimit}
                                    onChange={(e) => setNewRewardLimit(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <Label>{t('tv_card_notes_label')}</Label>
                            <Textarea
                                placeholder={t('tv_card_notes_ph')}
                                value={newCardNotes}
                                onChange={(e) => setNewCardNotes(e.target.value)}
                                rows={3}
                            />
                        </div>

                        <div className="flex items-center justify-between bg-slate-100 p-3 rounded-xl">
                            <Label className="flex items-center gap-2 text-sm text-slate-700">
                                {newCardIsPublic ? <><Users className="w-4 h-4 text-blue-500" /> {t('tv_card_public')}</> : <><User className="w-4 h-4 text-amber-500" /> {t('tv_card_private')}</>}
                            </Label>
                            <Switch checked={newCardIsPublic} onCheckedChange={setNewCardIsPublic} />
                        </div>
                        <Button className="w-full bg-slate-900" onClick={handleSaveCard} disabled={isSavingCard}>
                            {isSavingCard ? t('tv_card_saving') : (editingCard ? t('update') : t('tv_add_card'))}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog >

            <ActuaryDialogCard
                open={actuaryOpen}
                onOpenChange={setActuaryOpen}
                expenses={expenses.filter(e => e.is_public)}
                members={tripMembers}
            />
        </>
    )
}

const ExpenseItem = memo(function ExpenseItem({ item, rate, members, onEdit, onDelete }: ExpenseItemProps) {
    const { t } = useLanguage()
    const methodInfo = PAYMENT_METHODS.find(m => m.id === item.payment_method) || PAYMENT_METHODS[0]
    const catInfo = CATEGORIES[item.category as keyof typeof CATEGORIES] || CATEGORIES['general']
    const CatIcon = catInfo.icon
    const isCustomIcon = Boolean(item.custom_icon && item.custom_icon.trim())
    const usedRate = item.exchange_rate || rate
    const standardizedAmount = item.total_amount !== undefined ? item.total_amount : item.amount
    const cashback = item.cashback_rate ? ((standardizedAmount || 0) * usedRate * item.cashback_rate / 100) : 0
    const finalTWD = Math.round((standardizedAmount || 0) * usedRate - cashback)

    // 🆕 Hybrid Payer Logic
    const member = members?.find(m => (item.payer_id && m.user_id === item.payer_id) || (item.payer_name && m.user_name === item.payer_name))
    const displayName = member 
        ? member.user_name 
        : (item.payer_name || (item.payer_id && !item.payer_id.includes('-') ? item.payer_id : null) || item.creator_name || null)

    return (
        <div className="flex flex-col p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm group transition-colors">
            <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={cn("p-2 rounded-full shrink-0 flex items-center justify-center min-w-8 min-h-8", catInfo.color)}>
                        {isCustomIcon ? (
                            <span className="text-sm leading-none">{item.custom_icon}</span>
                        ) : (
                            <CatIcon className="w-4 h-4" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="font-bold text-slate-800 dark:text-slate-100 truncate text-sm flex items-center gap-2">
                            {item.title}
                            {item.image_url && (
                                <a href={item.image_url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-500">
                                    <ImageIcon className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {/* 🆕 Payer Display */}
                            {displayName && (
                                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-600">
                                    {member ? (
                                        <Avatar className="h-3 w-3">
                                            <AvatarImage src={member.user_avatar} />
                                            <AvatarFallback className="text-[6px] uppercase">{member.user_name[0]}</AvatarFallback>
                                        </Avatar>
                                    ) : (
                                        <User className="w-2.5 h-2.5 text-slate-500" />
                                    )}
                                    <span className="font-bold truncate max-w-15">{displayName}</span>
                                </div>
                            )}
                            {item.card_name ? <span className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 px-1.5 rounded font-medium">{item.card_name}</span> : <span className="bg-stone-100 dark:bg-slate-700 text-stone-500 dark:text-slate-400 px-1.5 rounded">{methodInfo.label}</span>}
                            <span className={cn("px-1.5 rounded", item.is_public ? "bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400" : "bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400")}>{item.is_public ? t('tv_filter_public') : t('tv_filter_private')}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <div className="text-right mr-2">
                        {(item.currency && item.currency !== "TWD") ? (
                            <div className="flex flex-col items-end">
                                <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1">
                                    <span className="text-[10px]">{CURRENCIES.find(c => c.code === item.currency)?.flag}</span>
                                    {(item.total_amount ?? item.amount ?? 0).toLocaleString()}
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                    {/* finalTWD is pre-calculated based on this amount */}
                                    <span>≈ NT${finalTWD.toLocaleString()}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                                NT${(item.total_amount ?? item.amount ?? 0).toLocaleString()}
                            </div>
                        )}
                        {(item.cashback_rate ?? 0) > 0 && <span className="text-[10px] text-green-500 block text-right">(-{Math.round(cashback)})</span>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 touch-manipulation" onClick={() => onEdit(item)}><Edit2 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 touch-manipulation" onClick={() => onDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
            </div>

            {/* 🆕 Sub-items Nested Display (Unified Schema) */}
            {(item.items || item.details) && ((item.items?.length ?? 0) > 0 || (item.details?.length ?? 0) > 0) && (
                <div className="mt-2 ml-7 pl-3 py-1 space-y-1 border-l-2 border-slate-100 dark:border-slate-700">
                    {(item.items || []).map((detail, idx) => (
                        <div key={`item-${idx}`} className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
                            <span className="truncate pr-2 opacity-80">• {detail.translated_name || detail.original_name}</span>
                            <span className="font-mono font-bold shrink-0">{detail.amount?.toLocaleString() ?? "0"}</span>
                        </div>
                    ))}
                    {/* Legacy Fallback Rendering */}
                    {(!item.items || item.items.length === 0) && (item.details || []).map((detail, idx) => (
                        <div key={`legacy-${idx}`} className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
                            <span className="truncate pr-2 opacity-80">• {detail.name}</span>
                            <span className="font-mono font-bold shrink-0">{detail.price?.toLocaleString() ?? "0"}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
})
