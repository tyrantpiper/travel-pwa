"use client"

import { useState, useEffect } from "react"
import {
    LogOut, CreditCard, Edit3, Save, Camera, Trash2, Smartphone, User, Loader2,
    Shield, Copy, Globe, Key, Sparkles, ExternalLink, AlertCircle, Moon, Sun, Palette, AlertTriangle,
    ChevronDown, ChevronUp  // 🆕 捐贈功能圖示
} from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { ZoomableImage } from "@/components/ui/zoomable-image"

import { useLanguage } from "@/lib/LanguageContext"
import { useTheme, ACCENT_COLORS, AccentColor } from "@/lib/ThemeContext"
import { ImageUpload } from "@/components/ui/image-upload"
import { toast } from "sonner"
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import {
    Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { TaskCard } from "@/components/onboarding/TaskCard"
import { debugLog } from "@/lib/debug"
import { useOnboardingStore } from "@/lib/stores/onboardingStore"
import { usersApi, appApi } from "@/lib/api"



export function ProfileView() {
    const { lang, setLang, t } = useLanguage()
    const { isDark, toggleDark, accentColor, setAccentColor, currentTheme } = useTheme()
    const [isEditing, setIsEditing] = useState(false)
    const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
    const [apiKey, setApiKey] = useState("")
    const [hasApiKey, setHasApiKey] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deleteConfirmText, setDeleteConfirmText] = useState("")
    const [isDeleting, setIsDeleting] = useState(false)
    const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false)

    // 🆕 捐贈功能 state（獨立區塊，不影響現有邏輯）
    const [donationProgress, setDonationProgress] = useState({ current: 0, goal: 2000 })
    const [showDonation, setShowDonation] = useState(true)
    const [donationExpanded, setDonationExpanded] = useState(false)

    // 🆕 POI 推薦偏好設定
    const [poiPreferences, setPoiPreferences] = useState({
        prefer_rating: true,
        prefer_distance: false,
        prefer_price: false
    })

    const [profile, setProfile] = useState({
        nickname: "Traveler",
        avatarUrl: "",
        email: "",
        bio: "Explorer"
    })

    useEffect(() => {
        let isMounted = true

        const userId = localStorage.getItem("user_uuid")
        const name = localStorage.getItem("user_nickname")
        const avatar = localStorage.getItem("user_avatar")

        // 1. Load from cache first (Optimistic)
        if (isMounted) {
            setProfile(prev => ({
                ...prev,
                nickname: name || "Traveler",
                avatarUrl: avatar || ""
            }))
        }

        // 2. Fetch from API (Single Source of Truth)
        if (userId) {
            usersApi.getProfile(userId)
                .then(data => {
                    if (!isMounted) return
                    setProfile(prev => ({
                        ...prev,
                        nickname: data.nickname || prev.nickname,
                        avatarUrl: data.avatar_url || prev.avatarUrl
                    }))
                    // Sync cache
                    if (data.nickname) localStorage.setItem("user_nickname", data.nickname)
                    if (data.avatar_url) localStorage.setItem("user_avatar", data.avatar_url)
                })
                .catch(err => {
                    if (isMounted) console.error("Failed to fetch profile:", err)
                })
        }

        // Check keys
        const devKey = process.env.NEXT_PUBLIC_DEV_GEMINI_KEY
        const storedKey = localStorage.getItem("user_gemini_key") || localStorage.getItem("gemini_api_key") || devKey

        if (storedKey && isMounted) {
            setApiKey(devKey ? "(開發者模式)" : storedKey)
            setHasApiKey(true)
            if (!devKey && !localStorage.getItem("user_gemini_key") && localStorage.getItem("gemini_api_key")) {
                localStorage.setItem("user_gemini_key", storedKey)
                localStorage.removeItem("gemini_api_key")
            }
        }

        // 🆕 載入 POI 偏好設定
        const savedPoiPrefs = localStorage.getItem("poi_preferences")
        if (savedPoiPrefs && isMounted) {
            try {
                setPoiPreferences(JSON.parse(savedPoiPrefs))
            } catch { /* ignore */ }
        }

        return () => {
            isMounted = false
        }
    }, [])

    // 🆕 捐贈進度讀取（獨立 useEffect，不影響現有邏輯）
    useEffect(() => {
        let isMounted = true
        // 檢查是否被用戶關閉（當月不再顯示）
        const dismissedMonth = localStorage.getItem('donation_dismissed')
        const currentMonth = new Date().toISOString().slice(0, 7)
        if (dismissedMonth === currentMonth && isMounted) {
            setShowDonation(false)
        }

        // 改從後端 API 讀取進度，避免前端直連 Supabase 造成網路錯誤 (Phase 20 Fix)
        const fetchDonationProgress = async () => {
            try {
                const data = await appApi.getDonationProgress()

                if (data && isMounted) {
                    // 自動月份重置：如果是新的月份，current 顯示為 0
                    const storedMonth = data.month
                    const nowMonth = new Date().toISOString().slice(0, 7)
                    if (storedMonth && storedMonth !== nowMonth) {
                        setDonationProgress({ current: 0, goal: data.goal || 2000 })
                    } else {
                        setDonationProgress(data)
                    }
                }
            } catch (err) {
                if (isMounted) debugLog('[Donation] Failed to fetch progress:', err)
            }
        }
        fetchDonationProgress()
        return () => { isMounted = false }
    }, [])

    const handleSaveProfile = async () => {
        const userId = localStorage.getItem("user_uuid")
        if (!userId) {
            toast.error("User ID not found")
            return
        }

        try {
            // Optimistic update
            localStorage.setItem("user_nickname", profile.nickname)
            setIsEditing(false)

            // API update
            await usersApi.updateProfile(userId, { name: profile.nickname })
            toast.success("Profile updated!")
        } catch (error) {
            console.error(error)
            toast.error("Failed to update profile on server")
        }
    }

    const handleRemoveAvatar = async () => {
        if (!confirm("Remove avatar?")) return
        const userId = localStorage.getItem("user_uuid")

        setProfile(prev => ({ ...prev, avatarUrl: "" }))
        localStorage.removeItem("user_avatar")

        if (userId) {
            try {
                await usersApi.updateProfile(userId, { avatar_url: "" }) // Send empty string to clear
            } catch (err) {
                console.error("Failed to remove avatar on server:", err)
            }
        }
    }

    const handleAvatarChange = async (url: string) => {
        const userId = localStorage.getItem("user_uuid")

        setProfile(prev => ({ ...prev, avatarUrl: url }))
        if (url) {
            localStorage.setItem("user_avatar", url)
        } else {
            localStorage.removeItem("user_avatar")
        }

        if (userId) {
            try {
                await usersApi.updateProfile(userId, { avatar_url: url })
            } catch (err) {
                console.error("Failed to update avatar on server:", err)
                toast.error("Failed to sync avatar")
            }
        }
    }

    const handleLogout = () => {
        if (confirm("Are you sure you want to logout?")) {
            localStorage.clear()
            window.location.reload()
        }
    }

    const handleClearCache = () => {
        if (confirm("This will clear all app cache. Continue?")) {
            const uuid = localStorage.getItem("user_uuid")  // 🆕 Preserve UUID
            localStorage.clear()
            if (uuid) localStorage.setItem("user_uuid", uuid)  // 🆕 Restore UUID
            window.location.reload()
        }
    }

    const handleSaveApiKey = () => {
        if (!apiKey.trim()) return
        localStorage.setItem("user_gemini_key", apiKey)
        setHasApiKey(true)
        setApiKeyDialogOpen(false)
        toast.success("API Key 設定成功！")
    }

    const handleClearApiKey = () => {
        setApiKey("")
        localStorage.removeItem("user_gemini_key")
        setHasApiKey(false)
        toast.info("API Key 已清除")
    }

    const handleDeleteAllData = async () => {
        if (deleteConfirmText !== "DELETE") {
            toast.error("請輸入 DELETE 確認刪除")
            return
        }
        setIsDeleting(true)
        try {
            const userId = localStorage.getItem("user_uuid")
            if (!userId) throw new Error("找不到用戶 ID")

            const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://tyrantpiper-ryan-travel-api.hf.space"
            const res = await fetch(`${API_BASE}/api/user/${userId}/data`, {
                method: "DELETE"
            })

            if (!res.ok) throw new Error("刪除失敗")

            const data = await res.json()
            toast.success(`已刪除 ${data.deleted?.trips || 0} 個行程、${data.deleted?.expenses || 0} 筆消費`)

            // 清除 localStorage 並重新載入
            localStorage.clear()
            window.location.reload()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "刪除失敗")
        } finally {
            setIsDeleting(false)
            setDeleteDialogOpen(false)
            setDeleteConfirmText("")
        }
    }

    return (
        <div className="h-full bg-stone-50 dark:bg-slate-900 overflow-y-auto overflow-x-hidden overscroll-y-contain overscroll-x-none">
            <div className="min-h-screen pb-32 bg-stone-50 dark:bg-slate-900">

                <div className={cn("h-48 relative overflow-hidden bg-gradient-to-br", currentTheme.gradient)}>
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1480796927426-f609979314bd?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-30"></div>
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-stone-50/90 dark:to-slate-900/90"></div>
                </div>

                <div className="px-6 relative -mt-20">
                    <div className="flex flex-col items-center gap-5">
                        {/* Avatar Wrapper */}
                        <div className="relative group">
                            {/* Avatar Display - 點擊可預覽 */}
                            <div
                                className="relative w-28 h-28 border-4 border-white shadow-xl bg-white rounded-full overflow-hidden cursor-pointer hover:ring-4 hover:ring-blue-50 transition-all duration-300"
                                onClick={() => profile.avatarUrl && setAvatarPreviewOpen(true)}
                            >
                                <Avatar className="w-full h-full">
                                    <AvatarImage src={profile.avatarUrl || undefined} className="object-cover" />
                                    <AvatarFallback className="bg-slate-50 text-slate-300 text-3xl font-bold flex items-center justify-center w-full h-full">
                                        {profile.nickname.slice(0, 1).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                        </div>

                        {/* 🆕 Action Row: 按鈕移至下方，日系極簡風格 (Icon Only) */}
                        <div className="flex items-center gap-4">
                            {/* Upload Button - Icon Only */}
                            <ImageUpload
                                value=""
                                onChange={handleAvatarChange}
                                folder="ryan_travel/avatars"
                                icon={
                                    <div
                                        className="w-9 h-9 rounded-full bg-white border border-stone-200 shadow-sm flex items-center justify-center hover:bg-stone-50 active:scale-95 transition-all group"
                                        title="更換照片"
                                    >
                                        <Camera className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                                    </div>
                                }
                                showPreview={false} // Custom trigger
                            />

                            {/* Remove Button - Icon Only */}
                            {profile.avatarUrl && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleRemoveAvatar(); }}
                                    className="w-9 h-9 rounded-full bg-white border border-stone-200 shadow-sm flex items-center justify-center hover:bg-red-50 hover:border-red-100 active:scale-95 transition-all group"
                                    title="移除照片"
                                >
                                    <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-red-500 transition-colors" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 頭像全螢幕預覽 (使用 ZoomableImage) */}
                    <Dialog open={avatarPreviewOpen} onOpenChange={setAvatarPreviewOpen}>
                        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/90 border-0 flex items-center justify-center">
                            <VisuallyHidden>
                                <DialogTitle>頭像預覽</DialogTitle>
                            </VisuallyHidden>
                            {profile.avatarUrl && (
                                <div className="relative w-full h-[80vh]">
                                    <ZoomableImage
                                        src={profile.avatarUrl}
                                        alt="Avatar Preview"
                                        onClose={() => setAvatarPreviewOpen(false)}
                                    />
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>

                    <div className="mt-4 text-center space-y-1 w-full flex flex-col items-center">
                        {isEditing ? (
                            <div className="flex flex-col items-center gap-3 w-full max-w-[280px]">
                                <Input
                                    value={profile.nickname}
                                    onChange={e => setProfile({ ...profile, nickname: e.target.value })}
                                    className="text-center font-bold text-xl h-12 bg-white dark:bg-slate-800 border-stone-200 dark:border-slate-700 rounded-2xl shadow-sm focus-visible:ring-slate-900"
                                    placeholder="Enter nickname"
                                />
                                <div className="flex gap-2 w-full">
                                    <Button variant="outline" size="sm" className="flex-1 h-9 rounded-xl border-stone-200" onClick={() => setIsEditing(false)}>
                                        Cancel
                                    </Button>
                                    <Button size="sm" className="flex-1 h-9 bg-slate-900 text-white rounded-xl shadow-lg" onClick={handleSaveProfile}>
                                        <Save className="w-3.5 h-3.5 mr-1.5" /> Save
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center justify-center gap-2 group">
                                    {profile.nickname}
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="p-1.5 bg-stone-100 hover:bg-white dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-all shadow-sm border border-stone-200 dark:border-slate-600 -mr-8"
                                        title="Edit Profile"
                                    >
                                        <Edit3 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                    </button>
                                </h2>
                                <p className="text-sm text-slate-400 font-medium tracking-wide uppercase">Explorer</p>
                            </>
                        )}
                    </div>
                </div>

                {/* 🆕 捐贈區塊 - 藥學系治療窗口版 */}
                {showDonation && (() => {
                    const percentage = Math.min((donationProgress.current / donationProgress.goal) * 100, 120)

                    // 治療窗口狀態判斷
                    const getTherapeuticStatus = () => {
                        if (percentage < 30) return {
                            zone: 'ineffective',
                            label: '🪫 能量不足',
                            labelBg: 'bg-amber-900/80',  // 深褐色背景
                            color: 'from-[#FF9966] to-[#FF5E62]',  // 活力橘漸層
                            message: '適應症：開發者因修 Bug 導致咖啡因枯竭，急需您的贊助輸血 ☕',
                            emoji: '😵'
                        }
                        if (percentage < 80) return {
                            zone: 'therapeutic',
                            label: '✅ 治療區',
                            labelBg: 'bg-emerald-900/80',
                            color: 'from-emerald-500 to-teal-500',
                            message: '藥效穩定發揮中！App 正常運轉，Bug 逐漸消失 💊',
                            emoji: '😊'
                        }
                        return {
                            zone: 'toxic',
                            label: '⚡ 亢奮區',
                            labelBg: 'bg-purple-900/80',
                            color: 'from-purple-500 to-pink-500',
                            message: '警告！開發者過度興奮，可能承諾開發過多新功能！🚀',
                            emoji: '🤩'
                        }
                    }

                    const status = getTherapeuticStatus()

                    // 里程碑節點
                    const milestones = [
                        { percent: 0, label: '開發者處於飢餓狀態', desc: '急需咖啡因注入 ☕' },
                        { percent: 25, label: '伺服器存活', desc: '至少這個月不會 404' },
                        { percent: 50, label: '升級大杯拿鐵', desc: '寫 Code 比較不會手抖' },
                        { percent: 75, label: '開發者獲得雞腿', desc: 'Bug 少一半' },
                        { percent: 100, label: '新功能解鎖', desc: '彩蛋模式啟動' }
                    ]

                    return (
                        <div
                            className={cn(
                                "mt-6 rounded-xl p-5 shadow-lg relative overflow-hidden transition-all duration-500",
                                `bg-gradient-to-br ${status.color}`
                            )}
                        >
                            {/* 裝飾圖示 */}
                            <div className="absolute top-0 right-0 p-3 opacity-20">
                                <span className="text-6xl">{status.emoji}</span>
                            </div>

                            {/* 標題 + 狀態標籤 */}
                            <div className="flex items-center justify-between mb-2">
                                <h3
                                    className="text-sm font-bold text-white flex items-center gap-2"
                                    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                                >
                                    💊 開發者血藥濃度監測
                                </h3>
                                <span className={cn(
                                    "text-[10px] px-2.5 py-1 rounded-full font-bold text-white",
                                    status.labelBg
                                )}>
                                    {status.label}
                                </span>
                            </div>

                            {/* 動態狀態文字（純白+陰影） */}
                            <p
                                className="text-xs text-white mb-4 leading-relaxed"
                                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}
                            >
                                {status.message}
                            </p>

                            {/* 治療窗口進度條 */}
                            <div className="mb-4">
                                <div className="relative h-6">
                                    {/* 進度條背景 + 分區 (overflow-hidden) */}
                                    <div className="absolute inset-0 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}>
                                        {/* 分區標示 */}
                                        <div className="absolute inset-0 flex">
                                            <div className="w-[25%] border-r border-white/20" />
                                            <div className="w-[25%] border-r border-white/20" />
                                            <div className="w-[25%] border-r border-white/20" />
                                            <div className="flex-1" />
                                        </div>

                                        {/* 進度條填充 */}
                                        <div
                                            className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
                                            style={{
                                                width: `${Math.min(percentage, 100)}%`,
                                                background: 'linear-gradient(90deg, #FFEB3B 0%, #FFC107 100%)',
                                                boxShadow: '0 0 12px rgba(255, 235, 59, 0.7), 0 0 4px rgba(255, 193, 7, 0.5)'
                                            }}
                                        />
                                    </div>

                                    {/* 里程碑節點 (移出 overflow-hidden) */}
                                    {milestones.map((m) => {
                                        const isAchieved = percentage >= m.percent
                                        let bgStyle = {}

                                        if (isAchieved) {
                                            if (m.percent === 0) bgStyle = { background: 'transparent' }
                                            else if (m.percent === 25) bgStyle = { background: 'conic-gradient(white 90deg, transparent 0)' }
                                            else if (m.percent === 50) bgStyle = { background: 'conic-gradient(white 180deg, transparent 0)' }
                                            else if (m.percent === 75) bgStyle = { background: 'conic-gradient(white 270deg, transparent 0)' }
                                            else bgStyle = { background: 'white' }
                                        } else {
                                            bgStyle = { background: 'transparent' }
                                        }

                                        let leftPos = `${m.percent}%`
                                        if (m.percent === 0) leftPos = '6px'
                                        else if (m.percent === 100) leftPos = 'calc(100% - 6px)'

                                        return (
                                            <Popover key={m.percent}>
                                                <PopoverTrigger asChild>
                                                    <div
                                                        className={cn(
                                                            "absolute top-[60%] -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white transition-all cursor-pointer z-10",
                                                            isAchieved && m.percent !== 0 ? "shadow-lg" : ""
                                                        )}
                                                        style={{
                                                            left: leftPos,
                                                            transform: 'translate(-50%, -50%)',
                                                            ...bgStyle
                                                        }}
                                                    />
                                                </PopoverTrigger>
                                                <PopoverContent side="top" className="w-auto p-2 text-xs">
                                                    <div className="font-medium">{m.label}</div>
                                                    <div className="text-muted-foreground text-[10px]">{m.desc}</div>
                                                </PopoverContent>
                                            </Popover>
                                        )
                                    })}
                                </div>

                                {/* 里程碑標籤 */}
                                <div className="relative mt-1 text-[9px] text-white/60 h-4">
                                    <span className="absolute left-0">0%</span>
                                    <span className={cn("absolute", percentage >= 25 ? "text-white" : "")} style={{ left: '25%', transform: 'translateX(-50%)' }}>25%</span>
                                    <span className={cn("absolute", percentage >= 50 ? "text-white" : "")} style={{ left: '50%', transform: 'translateX(-50%)' }}>50%</span>
                                    <span className={cn("absolute", percentage >= 75 ? "text-white" : "")} style={{ left: '75%', transform: 'translateX(-50%)' }}>75%</span>
                                    <span className={cn("absolute right-0", percentage >= 100 ? "text-white" : "")}>100%</span>
                                </div>
                            </div>

                            {/* 數據顯示 */}
                            <div className="flex justify-between items-end text-xs text-white/90 mb-3">
                                <span className="mb-1">本月處方籤累積</span>
                                <div className="text-right">
                                    <span className="text-lg font-bold text-white mr-1 drop-shadow-md">
                                        NT${donationProgress.current.toLocaleString()}
                                    </span>
                                    <span className="text-white/70">
                                        / ${donationProgress.goal.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* 里程碑達成提示 */}
                            <div className="text-[10px] text-white/70 mb-3 space-y-1">
                                {percentage >= 0 && (
                                    <div>
                                        ✅ {percentage < 25 ? (percentage < 1 && percentage > 0 ? percentage.toFixed(1) : Math.floor(percentage)) : 0}% - 開發者處於飢餓狀態
                                    </div>
                                )}
                                {percentage >= 25 && (
                                    <div>
                                        ✅ {percentage < 50 ? Math.floor(percentage) : 25}% - 伺服器存活確認
                                    </div>
                                )}
                                {percentage >= 50 && (
                                    <div>
                                        ✅ {percentage < 75 ? Math.floor(percentage) : 50}% - 升級大杯拿鐵
                                    </div>
                                )}
                                {percentage >= 75 && (
                                    <div>
                                        ✅ {percentage < 100 ? Math.floor(percentage) : 75}% - 開發者獲得雞腿
                                    </div>
                                )}
                                {percentage >= 100 && <div>🔓 100% - 新功能開發中...</div>}
                            </div>

                            {/* 展開/收合 QR Code */}
                            <button
                                onClick={() => setDonationExpanded(!donationExpanded)}
                                className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg p-2.5 flex items-center justify-center gap-2 text-sm font-medium text-white shadow-sm transition-all border border-white/10"
                            >
                                {donationExpanded ? (
                                    <>收起處方籤 <ChevronUp className="w-4 h-4" /></>
                                ) : (
                                    <>💉 立即注入咖啡因 <ChevronDown className="w-4 h-4" /></>
                                )}
                            </button>

                            {/* QR Code 區塊（可展開） */}
                            {
                                donationExpanded && (
                                    <div className="bg-white rounded-lg p-4 text-center mt-3">
                                        <Image
                                            src="/donation-qr.png"
                                            alt="Donation QR Code"
                                            width={180}
                                            height={180}
                                            className="mx-auto rounded-lg"
                                        />
                                        <p className="text-xs text-slate-500 mt-2 mb-3">
                                            使用 台灣Pay / 街口 / LINE Pay 掃描
                                        </p>

                                        {/* 手機收款資訊 */}
                                        <div className="text-left bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3">
                                            <h4 className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                                                <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                                                手機收款 <span className="text-slate-400 font-normal">(代碼 812)</span>
                                            </h4>
                                            <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
                                                銀行代碼「812」+ 手機號碼即可轉帳。
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <code className="bg-white border border-slate-200 px-2 py-1.5 rounded text-xs font-mono text-slate-700 flex-1 text-center tracking-wider font-bold">
                                                    0908879076
                                                </code>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 w-7 p-0 shrink-0 bg-white hover:bg-slate-50"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText("0908879076")
                                                        toast.success("手機號碼已複製！")
                                                    }}
                                                    title="複製號碼"
                                                >
                                                    <Copy className="w-3 h-3 text-slate-500" />
                                                </Button>
                                            </div>
                                        </div>

                                        <p className="text-[10px] text-slate-400 mt-1">
                                            本處方由藥學系學生 Ryan 調劑 🧪
                                        </p>
                                    </div>
                                )
                            }
                        </div>
                    )
                })()}

                {/* 🆕 新手任務卡片 */}
                {!useOnboardingStore.getState().isCompleted && (
                    <TaskCard
                        onNavigateToApiKey={() => setApiKeyDialogOpen(true)}
                        className="mt-6"
                    />
                )}

                <div className="mt-8 bg-slate-900 rounded-xl p-5 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-20">
                        <Shield className="w-16 h-16" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Account Recovery Key</h3>
                    <p className="text-[10px] text-slate-400 mb-3">
                        Copy this code before switching devices or deleting the app.
                    </p>
                    <div className="bg-black/30 rounded-lg p-3 flex items-center justify-between border border-white/10">
                        <code className="text-xs font-mono text-amber-400 truncate max-w-[200px]">
                            {typeof window !== 'undefined' ? localStorage.getItem("user_uuid") || "Loading..." : "Loading..."}
                        </code>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs hover:bg-white/10 text-white"
                            onClick={() => {
                                const uuid = localStorage.getItem("user_uuid") || "";
                                if (navigator.clipboard && navigator.clipboard.writeText) {
                                    navigator.clipboard.writeText(uuid);
                                    toast.success(t('code_copied'));
                                } else {
                                    // Fallback for non-HTTPS environments
                                    const textArea = document.createElement("textarea");
                                    textArea.value = uuid;
                                    document.body.appendChild(textArea);
                                    textArea.select();
                                    document.execCommand('copy');
                                    document.body.removeChild(textArea);
                                    toast.success(t('code_copied'));
                                }
                            }}
                        >
                            <Copy className="w-3 h-3 mr-1" /> {t('copy')}
                        </Button>
                    </div>
                </div>

                <div className="mt-10 space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Settings</h3>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-stone-200 dark:border-slate-700 overflow-hidden shadow-sm">
                        <MenuItem icon={Globe} label={t('language')} value={lang === 'zh' ? '繁體中文' : 'English'} onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} />
                        <Separator />

                        {/* 🌙 Dark Mode Toggle */}
                        <div className="flex items-center justify-between p-4 text-slate-700 dark:text-slate-200">
                            <div className="flex items-center gap-3">
                                {isDark ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
                                <span className="text-sm font-medium">深色模式</span>
                            </div>
                            <Switch checked={isDark} onCheckedChange={toggleDark} />
                        </div>
                        <Separator />

                        {/* 🎨 Accent Color Selector */}
                        <div className="p-4 text-slate-700 dark:text-slate-200">
                            <div className="flex items-center gap-3 mb-3">
                                <Palette className="w-5 h-5 text-slate-400" />
                                <span className="text-sm font-medium">主題色</span>
                            </div>
                            <div className="flex gap-2 ml-8">
                                {(Object.keys(ACCENT_COLORS) as AccentColor[]).map(color => (
                                    <button
                                        key={color}
                                        onClick={() => setAccentColor(color)}
                                        className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all",
                                            `bg-gradient-to-br ${ACCENT_COLORS[color].gradient}`,
                                            accentColor === color
                                                ? "ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-110"
                                                : "opacity-70 hover:opacity-100"
                                        )}
                                        title={ACCENT_COLORS[color].name}
                                    >
                                        {accentColor === color && "✓"}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <Separator />
                        <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
                            <DialogTrigger asChild>
                                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-stone-50 transition-colors text-slate-700">
                                    <div className="flex items-center gap-3">
                                        <Sparkles className="w-5 h-5 text-amber-500" />
                                        <span className="text-sm font-medium">AI API Key</span>
                                    </div>
                                    <span className={cn("text-xs px-2 py-1 rounded", hasApiKey ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600")}>
                                        {hasApiKey ? "✅ 已設定" : "⚠️ 未設定"}
                                    </span>
                                </div>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[450px]">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <Key className="w-5 h-5 text-amber-500" />
                                        AI API Key 設定
                                    </DialogTitle>
                                    <DialogDescription>
                                        設定 Gemini API Key 以使用 AI 行程規劃功能。<br />
                                        <span className="text-xs text-slate-400">（本機儲存，不會傳送給開發者）</span>
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="grid gap-4 py-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="apiKey" className="text-xs font-bold text-slate-500 uppercase">您的 API Key</Label>
                                        <Input
                                            id="apiKey"
                                            type="password"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder="AIzaSy**************************"
                                            className="font-mono text-sm"
                                        />
                                    </div>

                                    <Accordion type="single" collapsible className="w-full bg-slate-50 rounded-lg px-4 border border-slate-200">
                                        <AccordionItem value="item-1" className="border-b-0">
                                            <AccordionTrigger className="text-sm text-slate-600 hover:no-underline py-3">
                                                🤔 如何免費獲取 API Key？
                                            </AccordionTrigger>
                                            <AccordionContent className="text-xs text-slate-500 space-y-3 pb-4">
                                                <div className="flex gap-3">
                                                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">1</div>
                                                    <div>
                                                        前往 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold inline-flex items-center">Google AI Studio <ExternalLink className="w-3 h-3 ml-0.5" /></a> 並登入 Google 帳號。
                                                    </div>
                                                </div>
                                                <div className="flex gap-3">
                                                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">2</div>
                                                    <div>點擊左側選單的 <b>Get API key</b>。</div>
                                                </div>
                                                <div className="flex gap-3">
                                                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">3</div>
                                                    <div>點擊 <b>Create API key</b>，複製 <code>AIza...</code> 開頭的代碼。</div>
                                                </div>
                                                <div className="bg-amber-50 text-amber-700 p-2 rounded border border-amber-100 flex items-start gap-2 mt-2">
                                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                                    <span>完全免費！每日可用 1,500 次。</span>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                </div>

                                <DialogFooter className="flex flex-row justify-between sm:justify-between gap-2">
                                    <Button variant="outline" onClick={handleClearApiKey} className="text-slate-400 hover:text-red-500">
                                        清除
                                    </Button>
                                    <Button onClick={handleSaveApiKey} className="bg-slate-900 text-white hover:bg-slate-800 flex-1 sm:flex-none">
                                        <Key className="w-4 h-4 mr-2" /> 儲存設定
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* 🆕 POI 推薦偏好設定 */}
                        <Separator />
                        <div className="p-4 space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Globe className="w-5 h-5 text-blue-500" />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">AI 推薦偏好</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="pref-rating" className="text-sm text-slate-600 dark:text-slate-300">⭐ 重視評分</Label>
                                <Switch
                                    id="pref-rating"
                                    checked={poiPreferences.prefer_rating}
                                    onCheckedChange={(checked) => {
                                        const newPrefs = { ...poiPreferences, prefer_rating: checked }
                                        setPoiPreferences(newPrefs)
                                        localStorage.setItem("poi_preferences", JSON.stringify(newPrefs))
                                    }}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="pref-distance" className="text-sm text-slate-600 dark:text-slate-300">📍 重視距離</Label>
                                <Switch
                                    id="pref-distance"
                                    checked={poiPreferences.prefer_distance}
                                    onCheckedChange={(checked) => {
                                        const newPrefs = { ...poiPreferences, prefer_distance: checked }
                                        setPoiPreferences(newPrefs)
                                        localStorage.setItem("poi_preferences", JSON.stringify(newPrefs))
                                    }}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="pref-price" className="text-sm text-slate-600 dark:text-slate-300">💰 重視價格</Label>
                                <Switch
                                    id="pref-price"
                                    checked={poiPreferences.prefer_price}
                                    onCheckedChange={(checked) => {
                                        const newPrefs = { ...poiPreferences, prefer_price: checked }
                                        setPoiPreferences(newPrefs)
                                        localStorage.setItem("poi_preferences", JSON.stringify(newPrefs))
                                    }}
                                />
                            </div>
                        </div>

                        <Separator />
                        <MenuItem icon={User} label={t('account_settings')} />
                        <Separator />
                        <MenuItem icon={Smartphone} label={t('app_version')} value="v1.0.0" />
                        <Separator />
                        <MenuItem icon={CreditCard} label={t('default_currency')} value="TWD (NT$)" />
                        <Separator />
                        <MenuItem icon={Trash2} label={t('clear_cache')} isDestructive onClick={handleClearCache} />
                        <Separator />
                        {/* 🔴 刪除所有資料 (GDPR) */}
                        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                            <DialogTrigger asChild>
                                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-red-50 transition-colors text-red-600">
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle className="w-5 h-5 text-red-500" />
                                        <span className="text-sm font-medium">刪除所有資料</span>
                                    </div>
                                    <span className="text-xs text-red-400">GDPR</span>
                                </div>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[400px]">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-red-600">
                                        <AlertTriangle className="w-5 h-5" />
                                        刪除所有資料
                                    </DialogTitle>
                                    <DialogDescription className="text-left">
                                        此操作將<strong>永久刪除</strong>您在雲端的所有資料，包括：
                                        <ul className="list-disc ml-4 mt-2 space-y-1">
                                            <li>所有行程</li>
                                            <li>所有消費記錄</li>
                                            <li>所有成員關係</li>
                                        </ul>
                                        <p className="mt-3 text-red-600 font-bold">⚠️ 此操作無法復原！</p>
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <Label htmlFor="deleteConfirm" className="text-sm text-slate-600">
                                        請輸入 <code className="bg-red-100 text-red-600 px-1 rounded">DELETE</code> 確認刪除
                                    </Label>
                                    <Input
                                        id="deleteConfirm"
                                        value={deleteConfirmText}
                                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                                        placeholder="DELETE"
                                        className="mt-2 font-mono"
                                    />
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>取消</Button>
                                    <Button
                                        variant="destructive"
                                        onClick={handleDeleteAllData}
                                        disabled={deleteConfirmText !== "DELETE" || isDeleting}
                                    >
                                        {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                        確認刪除
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <Button variant="outline" className="w-full h-12 text-red-500 border-red-100 hover:bg-red-50 hover:text-red-600 mt-4" onClick={handleLogout}>
                        <LogOut className="w-4 h-4 mr-2" /> {t('logout')}
                    </Button>
                </div>

            </div>
        </div>
    )
}

interface MenuItemProps {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value?: string
    isDestructive?: boolean
    onClick?: () => void
}

function MenuItem({ icon: Icon, label, value, isDestructive, onClick }: MenuItemProps) {
    return (
        <div className={cn("flex items-center justify-between p-4 cursor-pointer hover:bg-stone-50 transition-colors", isDestructive ? "text-red-500 hover:bg-red-50" : "text-slate-700")} onClick={onClick}>
            <div className="flex items-center gap-3"><Icon className={cn("w-5 h-5", isDestructive ? "text-red-400" : "text-slate-400")} /><span className="text-sm font-medium">{label}</span></div>
            {value && <span className="text-xs text-slate-400 bg-stone-100 px-2 py-1 rounded">{value}</span>}
        </div>
    )
}
