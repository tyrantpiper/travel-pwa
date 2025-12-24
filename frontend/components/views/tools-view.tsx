"use client"

import { useState, useEffect, useMemo, ComponentType } from "react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { createClient } from "@supabase/supabase-js"
import { useLanguage } from "@/lib/LanguageContext"
import { ExpenseChart, CATEGORY_COLORS } from "@/components/expense-chart"
import { ImageUpload } from "@/components/ui/image-upload"
import { useTripContext } from "@/lib/trip-context"
import { TripSwitcher } from "@/components/trip-switcher"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { SwipeableItem } from "@/components/ui/swipeable-item"
import { useHaptic } from "@/lib/hooks"

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
    created_at?: string
    exchange_rate?: number
    cashback_rate?: number
    trip_id?: string
    card_name?: string
    creator_name?: string
}

interface ParseResult {
    items?: unknown[]
    title?: string
    start_date?: string
    end_date?: string
}

interface GenerateResult {
    items?: unknown[]
    data?: { items?: unknown[] }
    title?: string
    start_date?: string
    end_date?: string
}

// 🆕 v3.8: 信用卡回饋功能
interface CreditCard {
    id: string
    name: string           // 卡片名稱
    rewardRate: number     // 回饋趴數 (%)
    rewardLimit: number    // 回饋上限 (TWD)
    notes: string          // 備忘錄
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

export function ToolsView() {
    const { t } = useLanguage()
    const { activeTripId, activeTrip } = useTripContext()
    const { mutate } = useSWRConfig()
    const [activeSection, setActiveSection] = useState("expense")
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [rate, setRate] = useState(0.22)

    // View controls
    const [expenseView, setExpenseView] = useState<'summary' | 'daily'>('summary')
    const [ownerFilter, setOwnerFilter] = useState<'all' | 'public' | 'private'>('all')
    const [selectedDate, setSelectedDate] = useState<string>("")

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
    const [isUploading, setIsUploading] = useState(false)
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

    // 🆕 v3.8: 信用卡回饋彙整
    const [creditCards, setCreditCards] = useState<CreditCard[]>([])
    const [cardDialogOpen, setCardDialogOpen] = useState(false)
    const [editingCard, setEditingCard] = useState<CreditCard | null>(null)
    const [newCardName, setNewCardName] = useState("")
    const [newRewardRate, setNewRewardRate] = useState("")
    const [newRewardLimit, setNewRewardLimit] = useState("")
    const [newCardNotes, setNewCardNotes] = useState("")

    useEffect(() => {
        // Check if user has API key (check localStorage, old key, and DEV key)
        const devKey = process.env.NEXT_PUBLIC_DEV_GEMINI_KEY
        const storedKey = localStorage.getItem("user_gemini_key") || localStorage.getItem("gemini_api_key") || devKey
        setHasApiKey(!!storedKey)
    }, [])

    // 🆕 v3.8: 載入信用卡資料
    useEffect(() => {
        try {
            const saved = localStorage.getItem("credit_cards")
            if (saved) {
                setCreditCards(JSON.parse(saved))
            }
        } catch (e) {
            console.error("Failed to load credit cards:", e)
        }
    }, [])

    useEffect(() => {
        const fetchRate = async () => {
            try {
                // 主要來源：fawazahmed0/currency-api（無限制、CDN 緩存）
                const res = await fetch(
                    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/jpy.json"
                )
                const data = await res.json()
                const rawRate = data.jpy?.twd
                if (rawRate) {
                    setRate(Math.round(rawRate * 100) / 100)  // 精確到小數點 2 位
                    return
                }
            } catch { /* 嘗試備援 */ }

            // 備援來源：原 exchangerate-api
            try {
                const res = await fetch("https://api.exchangerate-api.com/v4/latest/JPY")
                const data = await res.json()
                if (data.rates?.TWD) {
                    setRate(Math.round(data.rates.TWD * 100) / 100)
                }
            } catch { /* 使用預設值 */ }
        }
        fetchRate()
    }, [])

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

    useEffect(() => { fetchExpenses() }, [activeTripId])

    // Get all unique dates from expenses
    const allDates = useMemo(() => {
        const dates = new Set<string>()
        expenses.forEach(e => {
            const d = e.expense_date || e.created_at?.split('T')[0] || new Date().toISOString().split('T')[0]
            dates.add(d)
        })
        return Array.from(dates).sort()
    }, [expenses])

    // Set initial selected date
    useEffect(() => {
        if (allDates.length > 0 && !selectedDate) {
            setSelectedDate(allDates[allDates.length - 1])
        }
    }, [allDates, selectedDate])

    // Filter expenses based on view mode and owner filter
    const filteredExpenses = useMemo(() => {
        let filtered = expenses

        // Owner filter
        if (ownerFilter === 'public') {
            filtered = filtered.filter(e => e.is_public)
        } else if (ownerFilter === 'private') {
            filtered = filtered.filter(e => !e.is_public)
        }

        // Date filter (daily mode)
        if (expenseView === 'daily' && selectedDate) {
            filtered = filtered.filter(e => {
                const d = e.expense_date || e.created_at?.split('T')[0]
                return d === selectedDate
            })
        }

        return filtered
    }, [expenses, ownerFilter, expenseView, selectedDate])

    // Calculate totals and category breakdown
    const { totalJPY, totalTWD, totalCashback, categoryData } = useMemo(() => {
        const total = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
        // 計算總回饋金額
        const cashbackTotal = filteredExpenses.reduce((sum, e) => {
            if (e.cashback_rate && e.cashback_rate > 0) {
                const usedRate = e.exchange_rate || rate
                return sum + Math.round(e.amount * usedRate * e.cashback_rate / 100)
            }
            return sum
        }, 0)

        const cats: Record<string, number> = {}
        filteredExpenses.forEach(e => {
            const cat = e.category || 'general'
            cats[cat] = (cats[cat] || 0) + (e.amount || 0)
        })
        const data = Object.entries(cats).map(([category, amount]) => ({
            category,
            amount,
            color: CATEGORY_COLORS[category] || CATEGORY_COLORS.general
        })).sort((a, b) => b.amount - a.amount)

        return { totalJPY: total, totalTWD: Math.round(total * rate), totalCashback: cashbackTotal, categoryData: data }
    }, [filteredExpenses, rate])

    // Date navigation
    const navigateDate = (direction: 'prev' | 'next') => {
        const idx = allDates.indexOf(selectedDate)
        if (direction === 'prev' && idx > 0) {
            setSelectedDate(allDates[idx - 1])
        } else if (direction === 'next' && idx < allDates.length - 1) {
            setSelectedDate(allDates[idx + 1])
        }
    }

    const formatDateDisplay = (dateStr: string) => {
        const d = new Date(dateStr)
        const day = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
        return `${d.getMonth() + 1}/${d.getDate()} (${day})`
    }

    const handleUploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setIsUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `receipt-${Date.now()}.${fileExt}`
            const { error } = await supabase.storage.from('uploads').upload(fileName, file)
            if (error) throw error
            const { data } = supabase.storage.from('uploads').getPublicUrl(fileName)
            setReceiptUrl(data.publicUrl)
            toast.success("Upload success")
        } catch (err) {
            console.error(err)
            toast.error("Upload failed")
        } finally {
            setIsUploading(false)
        }
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
            itinerary_id: activeTripId, title, amount_jpy: parseInt(amountJPY), exchange_rate: rate,
            payment_method: method, category: category, is_public: isPublic,
            created_by: userId, creator_name: userName,
            card_name: method === "JCB" || method === "VisaMaster" ? cardName : "",
            cashback_rate: method === "JCB" || method === "VisaMaster" ? rateNum : 0,
            image_url: receiptUrl || null,
            expense_date: expenseDate || new Date().toISOString().split('T')[0]
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
                fetchExpenses()
            } else {
                throw new Error("API Error")
            }
        } catch (e) { haptic.error(); toast.error("Save failed") }
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
        setIsDialogOpen(true)
    }
    const openEditDialog = (item: Expense) => {
        setEditItem(item); setTitle(item.title); setAmountJPY(item.amount.toString()); setMethod(item.payment_method || "Cash"); setCategory(item.category || "general"); setIsPublic(item.is_public); setReceiptUrl(item.image_url || "")
        setExpenseDate(item.expense_date || item.created_at?.split('T')[0] || "")
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
            return
        }

        try {
            const response = await fetch(`${API_BASE}/api/save-itinerary`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: result.title || "New Trip",
                    start_date: result.start_date || new Date().toISOString().split('T')[0],
                    end_date: result.end_date || new Date().toISOString().split('T')[0],
                    items: result.items,
                    user_id: userId,
                    creator_name: userName
                })
            })
            const data = await response.json()
            if (response.ok) {
                toast.success(`行程已儲存！房間代碼: ${data.share_code}`)
                setMarkdown("")
                setMdResult(null)
                setAiResult(null)
                // Refresh trip list immediately
                mutate((key) => typeof key === 'string' ? key.includes('/api/trips') : Array.isArray(key) && key[0]?.includes('/api/trips'), undefined, { revalidate: true })
            } else {
                toast.error(data.detail || "Save failed")
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
        setCardDialogOpen(true)
    }

    const openEditCardDialog = (card: CreditCard) => {
        setEditingCard(card)
        setNewCardName(card.name)
        setNewRewardRate(String(card.rewardRate))
        setNewRewardLimit(String(card.rewardLimit))
        setNewCardNotes(card.notes)
        setCardDialogOpen(true)
    }

    const handleSaveCard = () => {
        if (!newCardName.trim()) {
            toast.error("請輸入卡片名稱")
            return
        }

        const cardData: CreditCard = {
            id: editingCard?.id || crypto.randomUUID(),
            name: newCardName.trim(),
            rewardRate: parseFloat(newRewardRate) || 0,
            rewardLimit: parseFloat(newRewardLimit) || 0,
            notes: newCardNotes.trim()
        }

        let updatedCards: CreditCard[]
        if (editingCard) {
            updatedCards = creditCards.map(c => c.id === editingCard.id ? cardData : c)
            toast.success("卡片已更新")
        } else {
            updatedCards = [...creditCards, cardData]
            toast.success("卡片已新增")
        }

        setCreditCards(updatedCards)
        saveCardsToLocalStorage(updatedCards)
        setCardDialogOpen(false)
        haptic.success()
    }

    const handleDeleteCard = (cardId: string) => {
        const updatedCards = creditCards.filter(c => c.id !== cardId)
        setCreditCards(updatedCards)
        saveCardsToLocalStorage(updatedCards)
        toast.success("卡片已刪除")
        haptic.success()
    }

    return (
        <div className="min-h-screen bg-stone-50 pb-32">
            <div className="bg-gradient-to-b from-slate-900 to-slate-800 pt-12 pb-6 px-6 text-white">
                <div className="space-y-3">
                    <div>
                        <h1 className="text-3xl font-serif mb-2">{t('tools')}</h1>
                        <p className="text-slate-300 text-sm">{t('expense_ai')}</p>
                    </div>
                    <TripSwitcher className="bg-white/10 text-white border-white/20 hover:bg-white/20" />
                </div>
            </div>

            <PullToRefresh onRefresh={async () => { await fetchExpenses(); toast.success("資料已更新") }} className="flex-1 px-4 -mt-4">
                <Tabs value={activeSection} onValueChange={setActiveSection}>
                    <TabsList className="grid w-full grid-cols-3 bg-white shadow-md rounded-xl p-1">
                        <TabsTrigger value="cards">💳 卡片</TabsTrigger>
                        <TabsTrigger value="expense">{t('expense')}</TabsTrigger>
                        <TabsTrigger value="ai">{t('ai_tools')}</TabsTrigger>
                    </TabsList>

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
                                            <SwipeableItem key={card.id} onDelete={() => handleDeleteCard(card.id)}>
                                                <div
                                                    onClick={() => openEditCardDialog(card)}
                                                    className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-4 text-white cursor-pointer hover:shadow-lg transition-shadow"
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="font-semibold text-lg">{card.name}</p>
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
                                            </SwipeableItem>
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
                        <div className="flex gap-1 bg-white p-1 rounded-lg shadow-sm">
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
                            <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDate('prev')} disabled={allDates.indexOf(selectedDate) === 0}>
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <span className="font-bold text-slate-800">{selectedDate ? formatDateDisplay(selectedDate) : '-'}</span>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDate('next')} disabled={allDates.indexOf(selectedDate) === allDates.length - 1}>
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        )}

                        {/* Summary Card */}
                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-4">
                                {expenseView === 'summary' ? (
                                    <div className="space-y-4">
                                        <ExpenseChart data={categoryData} total={totalJPY} />
                                        <div className="text-center pt-2 border-t">
                                            <p className="text-xs text-slate-500">{t('total')}</p>
                                            <p className="text-2xl font-bold text-slate-900">{totalJPY.toLocaleString()} JPY</p>
                                            <p className="text-sm text-slate-500">~ {totalTWD.toLocaleString()} TWD</p>
                                            {totalCashback > 0 && (
                                                <p className="text-sm text-green-600 font-medium mt-1">💰 回饋 -{totalCashback.toLocaleString()} TWD</p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-xs text-slate-500">{t('total')}</p>
                                            <p className="text-2xl font-bold text-slate-900">{totalJPY.toLocaleString()} JPY</p>
                                            <p className="text-sm text-slate-500">~ {totalTWD.toLocaleString()} TWD</p>
                                            {totalCashback > 0 && (
                                                <p className="text-xs text-green-600 font-medium">💰 -{totalCashback.toLocaleString()} TWD</p>
                                            )}
                                        </div>
                                        <Button disabled={!activeTripId} onClick={openAddDialog} className="bg-slate-900">
                                            <Plus className="w-4 h-4 mr-2" /> {activeTripId ? t('add') : "Select Trip"}
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Summary Mode: Add Button */}
                        {expenseView === 'summary' && (
                            <Button disabled={!activeTripId} onClick={openAddDialog} className="w-full bg-slate-900">
                                <Plus className="w-4 h-4 mr-2" /> {activeTripId ? t('add') : "Please Select a Trip First"}
                            </Button>
                        )}

                        {/* Expense List */}
                        <div className="space-y-2">
                            {filteredExpenses.map((item: Expense) => (
                                <SwipeableItem key={item.id} onDelete={() => handleDeleteExpense(item.id)}>
                                    <ExpenseItem item={item} rate={rate} onEdit={openEditDialog} onDelete={handleDeleteExpense} />
                                </SwipeableItem>
                            ))}
                            {filteredExpenses.length === 0 && (
                                <div className="text-center py-8 text-slate-400 text-sm">暫無記錄</div>
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
                                        <div className="p-4 bg-stone-100 rounded-xl">
                                            <p className="text-sm text-green-600 mb-2">{aiResult.items.length} {t('items_generated')}</p>
                                            <Button className="w-full" onClick={handleSaveTrip} disabled={isSaving}>{isSaving ? <><Loader2 className="animate-spin mr-2" />儲存中...</> : t('save_trip')}</Button>
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
                                        <div className="p-4 bg-stone-100 rounded-xl">
                                            <p className="text-sm text-green-600 mb-2">{mdResult.items.length} {t('items_parsed')}</p>
                                            <Button className="w-full" onClick={handleSaveTrip} disabled={isSaving}>{isSaving ? <><Loader2 className="animate-spin mr-2" />儲存中...</> : t('save_trip')}</Button>
                                        </div>
                                    )}
                                </div>
                            </SheetContent>
                        </Sheet>
                    </TabsContent>
                </Tabs>
            </PullToRefresh>

            {/* Expense Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{editItem ? t('edit') : t('add')} {t('expense')}</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="flex gap-2">
                            <Input placeholder={t('amount_jpy')} type="number" inputMode="numeric" pattern="[0-9]*" className="text-lg font-mono font-bold" value={amountJPY} onChange={e => setAmountJPY(e.target.value)} />
                            <div className="flex items-center px-3 bg-slate-100 rounded text-sm text-slate-500 whitespace-nowrap min-w-[6rem] justify-center">~ {Math.round((parseInt(amountJPY) || 0) * rate)} TWD</div>
                        </div>
                        <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />

                        {/* Date picker - 根據行程天數選擇 */}
                        <div className="space-y-1">
                            <Label className="text-xs text-slate-500">📅 日期</Label>
                            {activeTrip?.start_date ? (
                                <select
                                    value={expenseDate}
                                    onChange={e => setExpenseDate(e.target.value)}
                                    className="w-full h-9 px-3 text-sm rounded-md border border-slate-200 bg-white"
                                >
                                    {(() => {
                                        // 計算行程天數（從 days array 或 start/end date）
                                        const startDate = new Date(activeTrip.start_date)
                                        const endDate = activeTrip.end_date ? new Date(activeTrip.end_date) : null
                                        const totalDays = activeTrip.days?.length ||
                                            (endDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 7)

                                        return Array.from({ length: totalDays }, (_, i) => {
                                            const date = new Date(activeTrip.start_date)
                                            date.setDate(date.getDate() + i)
                                            const dateStr = date.toISOString().split('T')[0]
                                            const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
                                            return (
                                                <option key={i} value={dateStr}>
                                                    Day {i + 1} ({date.getMonth() + 1}/{date.getDate()} {weekday})
                                                </option>
                                            )
                                        })
                                    })()}
                                </select>
                            ) : (
                                <div className="text-xs text-slate-400 py-2">請先選擇行程</div>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            {Object.entries(CATEGORIES).map(([key, info]) => (
                                <button key={key} onClick={() => setCategory(key)} className={cn("flex items-center justify-center gap-1 p-2 rounded-lg border text-xs transition-all", category === key ? "border-slate-800 bg-slate-800 text-white" : "bg-white border-slate-100 text-slate-500")}>
                                    <info.icon className="w-3 h-3" /> {info.label}
                                </button>
                            ))}
                        </div>

                        {/* Receipt Upload */}
                        <div className="space-y-1">
                            <Label className="text-xs text-slate-500">收據 / 照片</Label>
                            <ImageUpload
                                value={receiptUrl}
                                onChange={(url) => setReceiptUrl(url)}
                                onRemove={() => setReceiptUrl("")}
                                folder="ryan_travel/receipts"
                            />
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                            {PAYMENT_METHODS.map(m => (
                                <button key={m.id} onClick={() => setMethod(m.id)} className={cn("flex flex-col items-center justify-center p-2 rounded-lg border text-xs transition-all", method === m.id ? "border-slate-800 bg-slate-800 text-white" : "bg-white border-slate-100 text-slate-500")}>
                                    <m.icon className="w-4 h-4 mb-1" />{m.label}
                                </button>
                            ))}
                        </div>

                        {(method === "JCB" || method === "VisaMaster") && (
                            <div className="flex gap-2">
                                <Input placeholder="Card name" value={cardName} onChange={e => setCardName(e.target.value)} className="flex-1" />
                                <div className="relative w-28">
                                    <input
                                        type="text"
                                        list="cashback-rates"
                                        placeholder="回饋 %"
                                        value={cashback}
                                        onChange={e => setCashback(e.target.value)}
                                        className="w-full h-9 px-3 text-sm rounded-md border border-slate-200 bg-white"
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

                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <Label className="text-sm flex items-center gap-2">
                                {isPublic ? <><Users className="w-4 h-4 text-blue-500" /> {t('shared')}</> : <><User className="w-4 h-4 text-amber-500" /> {t('private')}</>}
                            </Label>
                            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                        </div>

                        <Button className="w-full bg-slate-900" onClick={handleSaveExpense} disabled={isSavingExpense}>
                            {isSavingExpense ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />儲存中...</> : t('save')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* 🆕 v3.8: 信用卡編輯 Dialog */}
            <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
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
                        <Button className="w-full bg-slate-900" onClick={handleSaveCard}>
                            {editingCard ? "更新" : "新增"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function ExpenseItem({ item, rate, onEdit, onDelete }: ExpenseItemProps) {
    const methodInfo = PAYMENT_METHODS.find(m => m.id === item.payment_method) || PAYMENT_METHODS[0]
    const catInfo = CATEGORIES[item.category as keyof typeof CATEGORIES] || CATEGORIES['general']
    const CatIcon = catInfo.icon
    const usedRate = item.exchange_rate || rate
    const cashback = item.cashback_rate ? (item.amount * usedRate * item.cashback_rate / 100) : 0
    const finalTWD = Math.round(item.amount * usedRate - cashback)

    return (
        <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm group active:scale-[0.98] transition-transform">
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
                <div className="text-right mr-2"><div className="font-mono font-bold text-slate-900 text-sm">{item.amount.toLocaleString()} JPY</div><div className="text-[10px] text-slate-400 flex flex-col items-end"><span>~ {finalTWD.toLocaleString()} TWD</span>{(item.cashback_rate ?? 0) > 0 && <span className="text-green-500">(-{Math.round(cashback)})</span>}</div></div>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-slate-600 hover:bg-slate-100 touch-manipulation" onClick={() => onEdit(item)}><Edit2 className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50 touch-manipulation" onClick={() => onDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
            </div>
        </div>
    )
}
