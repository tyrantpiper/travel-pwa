"use client"

import { useState, useEffect } from "react"
import {
    LogOut, CreditCard, Edit3, Save, Camera, Trash2, Smartphone, User, Loader2,
    Shield, Copy, Globe, Key, Sparkles, ExternalLink, AlertCircle, Moon, Sun, Palette, AlertTriangle,
    ChevronDown, ChevronUp, Brain, // 🆕 AI 記憶圖示
    BookOpen, Mail, Check  // 🆕 使用說明與聯絡圖示
} from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { TranslationKey } from "@/lib/i18n"
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
import type { UserPreference } from "@/lib/api"
import { UsageGuideDialog } from "@/components/UsageGuideDialog"
import { encryptData, getSecureApiKey } from "@/lib/security"



export function ProfileView() {
    const { lang, setLang, t } = useLanguage()
    const zh = lang === 'zh'
    const { isDark, toggleDark, accentColor, setAccentColor, currentTheme } = useTheme()
    const [isEditing, setIsEditing] = useState(false)
    const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
    const [memoryToDelete, setMemoryToDelete] = useState<UserPreference | null>(null)
    const [isDeletingMemory, setIsDeletingMemory] = useState(false)
    const [apiKey, setApiKey] = useState("")
    const [hasApiKey, setHasApiKey] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deleteConfirmText, setDeleteConfirmText] = useState("")
    const [isDeleting, setIsDeleting] = useState(false)
    const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false)
    const [usageGuideOpen, setUsageGuideOpen] = useState(false)

    // 🆕 捐贈功能 state（獨立區塊，不影響現有邏輯）
    const [donationProgress, setDonationProgress] = useState({ current: 0, goal: 2000 })
    const [isDonationLoading, setIsDonationLoading] = useState(true)
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

    // 🧠 AI Adaptive Memory Preferences
    const [preferences, setPreferences] = useState<UserPreference[]>([])
    const [isLoadPrefs, setIsLoadPrefs] = useState(false)
    const [memoryExpanded, setMemoryExpanded] = useState(false)
    const [contactDialogOpen, setContactDialogOpen] = useState(false)
    const [copied, setCopied] = useState(false)
 // 🧠 AI 記憶展開狀態

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
        const secureKey = getSecureApiKey()

        if (secureKey && isMounted) {
            const devKey = process.env.NEXT_PUBLIC_DEV_GEMINI_KEY
            setApiKey(devKey === secureKey ? (zh ? "(開發者模式)" : "(Dev Mode)") : secureKey)
            setHasApiKey(true)
            
            // Auto-migration: If we have a legacy key but no encrypted key, encrypt it now
            if (!devKey && !localStorage.getItem("user_gemini_key") && localStorage.getItem("gemini_api_key")) {
                localStorage.setItem("user_gemini_key", encryptData(secureKey))
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

        // 🧠 載入 AI 記憶偏好
        if (userId) {
            setIsLoadPrefs(true)
            usersApi.getPreferences(userId)
                .then(data => {
                    if (isMounted) setPreferences(data)
                })
                .catch(err => console.error("Failed to load preferences:", err))
                .finally(() => {
                    if (isMounted) setIsLoadPrefs(false)
                })
        }

        return () => {
            isMounted = false
        }
    }, [zh])

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
            } finally {
                if (isMounted) setIsDonationLoading(false)
            }
        }
        fetchDonationProgress()
        return () => { isMounted = false }
    }, [])

    const handleSaveProfile = async () => {
        const userId = localStorage.getItem("user_uuid")
        if (!userId) {
            toast.error(t('profile_user_not_found'))
            return
        }

        try {
            // Optimistic update
            localStorage.setItem("user_nickname", profile.nickname)
            setIsEditing(false)

            // API update
            await usersApi.updateProfile(userId, { name: profile.nickname })
            toast.success(t('profile_updated'))
        } catch (error) {
            console.error(error)
            toast.error("Failed to update profile on server")
        }
    }

    const handleConfirmDeleteMemory = async () => {
        if (!memoryToDelete) return
        
        const userId = localStorage.getItem("user_uuid")
        if (!userId) return

        setIsDeletingMemory(true)
        try {
            await usersApi.deletePreference(userId, memoryToDelete.id)
            setPreferences(prev => prev.filter(p => p.id !== memoryToDelete.id))
            toast.success(t('update_success'))
            setMemoryToDelete(null)
        } catch {
            toast.error(t('profile_delete_failed'))
        } finally {
            setIsDeletingMemory(false)
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

    const handleCopyEmail = async () => {
        const email = "ryanpig228@gmail.com"
        try {
            await navigator.clipboard.writeText(email)
            setCopied(true)
            toast.success(zh ? "已複製信箱！" : "Email copied!")
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error(zh ? "無法複製，請手動輸入" : "Failed to copy")
        }
    }

    const handleWriteEmail = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        
        // 🚀 GMAIL DIRECT COMPOSE: Bypasses system-level mailto issues
        const gmailUrl = "https://mail.google.com/mail/?view=cm&fs=1&to=ryanpig228@gmail.com"
        window.open(gmailUrl, '_blank')
    }

    const handleSaveApiKey = () => {
        if (!apiKey.trim()) return
        // 🛡️ Security Hardened: Encrypt key before storage
        localStorage.setItem("user_gemini_key", encryptData(apiKey))
        setHasApiKey(true)
        setApiKeyDialogOpen(false)
        toast.success(t('profile_key_set'))
    }

    const handleClearApiKey = () => {
        setApiKey("")
        localStorage.removeItem("user_gemini_key")
        setHasApiKey(false)
        toast.info(t('profile_key_cleared'))
    }

    const handleDeleteAllData = async () => {
        if (deleteConfirmText !== "DELETE") {
            toast.error(t('profile_type_delete'))
            return
        }
        setIsDeleting(true)
        try {
            const userId = localStorage.getItem("user_uuid")
            if (!userId) throw new Error(t('profile_user_not_found'))

            const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://tyrantpiper-ryan-travel-api.hf.space"
            const res = await fetch(`${API_BASE}/api/user/${userId}/data`, {
                method: "DELETE",
                headers: {
                    "X-User-ID": userId
                }
            })

            if (!res.ok) throw new Error(t('profile_delete_failed'))

            const data = await res.json()
            toast.success(zh ? `已刪除 ${data.deleted?.trips || 0} 個行程、${data.deleted?.expenses || 0} 筆消費` : `Deleted ${data.deleted?.trips || 0} trips and ${data.deleted?.expenses || 0} expenses`)

            // 清除 localStorage 並重新載入
            localStorage.clear()
            window.location.reload()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : t('profile_delete_failed'))
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
                                className="relative w-28 h-28 border-4 border-background shadow-xl bg-card rounded-full overflow-hidden cursor-pointer hover:ring-4 hover:ring-blue-50/10 transition-all duration-300"
                                onClick={() => profile.avatarUrl && setAvatarPreviewOpen(true)}
                            >
                                <Avatar className="w-full h-full">
                                    <AvatarImage src={profile.avatarUrl || undefined} className="object-cover" />
                                    <AvatarFallback className="bg-muted text-muted-foreground text-3xl font-bold flex items-center justify-center w-full h-full">
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
                                        className="w-11 h-11 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-accent active:scale-95 transition-all group"
                                        title={t('profile_switch_avatar')}
                                    >
                                        <Camera className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                    </div>
                                }
                                showPreview={false} // Custom trigger
                            />

                            {/* Remove Button - Icon Only */}
                            {profile.avatarUrl && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleRemoveAvatar(); }}
                                    className="w-11 h-11 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-100 dark:hover:border-red-900/50 active:scale-95 transition-all group"
                                    title={t('profile_preview')}
                                >
                                    <Trash2 className="w-5 h-5 text-muted-foreground group-hover:text-red-500 transition-colors" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 頭像全螢幕預覽 (使用 ZoomableImage) */}
                    <Dialog open={avatarPreviewOpen} onOpenChange={setAvatarPreviewOpen}>
                        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/90 border-0 flex items-center justify-center">
                            <VisuallyHidden>
                                <DialogTitle>{t('profile_preview')}</DialogTitle>
                                <DialogDescription>{t('profile_preview_desc')}</DialogDescription>
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
                                    <Button variant="outline" size="sm" className="flex-1 h-11 rounded-xl border-border" onClick={() => setIsEditing(false)}>
                                        Cancel
                                    </Button>
                                    <Button size="sm" className="flex-1 h-11 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-xl shadow-lg" onClick={handleSaveProfile}>
                                        <Save className="w-4 h-4 mr-2" /> Save
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
                                        title={t('profile_edit_tooltip')}
                                    >
                                        <Edit3 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                    </button>
                                </h2>
                                <p className="text-sm text-slate-400 font-medium tracking-wide uppercase">{t('rank_explorer')}</p>
                            </>
                        )}
                    </div>
                </div>

                {/* 🆕 捐贈區塊 - 藥學系治療窗口版 */}
                {showDonation && (() => {
                    if (isDonationLoading) {
                        return (
                            <div className="mt-6 rounded-xl p-5 shadow-lg relative overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50">
                                {/* Skeleton 標題區 */}
                                <div className="flex items-center justify-between mb-4">
                                    <Skeleton className="h-5 w-24 bg-slate-200/80 dark:bg-slate-700" />
                                    <Skeleton className="h-5 w-16 rounded-full bg-slate-200/80 dark:bg-slate-700" />
                                </div>
                                <Skeleton className="h-3 w-40 mb-6 bg-slate-200/80 dark:bg-slate-700" />
                                
                                {/* Skeleton 進度條與節點 */}
                                <div className="mb-4">
                                    <Skeleton className="h-6 w-full rounded-full bg-slate-200/80 dark:bg-slate-700" />
                                    <div className="flex justify-between mt-2 px-1">
                                        <Skeleton className="h-2 w-4 bg-slate-200/80 dark:bg-slate-700" />
                                        <Skeleton className="h-2 w-4 bg-slate-200/80 dark:bg-slate-700" />
                                        <Skeleton className="h-2 w-4 bg-slate-200/80 dark:bg-slate-700" />
                                        <Skeleton className="h-2 w-4 bg-slate-200/80 dark:bg-slate-700" />
                                        <Skeleton className="h-2 w-4 bg-slate-200/80 dark:bg-slate-700" />
                                    </div>
                                </div>
                                
                                {/* Skeleton 數字區域 */}
                                <div className="flex justify-between items-end mb-4">
                                    <Skeleton className="h-3 w-12 bg-slate-200/80 dark:bg-slate-700" />
                                    <Skeleton className="h-6 w-32 bg-slate-200/80 dark:bg-slate-700" />
                                </div>
                                
                                <div className="space-y-2 mb-4">
                                    <Skeleton className="h-2 w-1/2 bg-slate-200/80 dark:bg-slate-700" />
                                    <Skeleton className="h-2 w-2/3 bg-slate-200/80 dark:bg-slate-700" />
                                </div>
                                
                                <Skeleton className="h-10 w-full rounded-lg bg-slate-200/80 dark:bg-slate-700" />
                            </div>
                        )
                    }

                    const percentage = Math.min((donationProgress.current / donationProgress.goal) * 100, 120)

                    // 治療窗口狀態判斷
                    const getTherapeuticStatus = () => {
                        if (percentage < 30) return {
                            zone: 'ineffective',
                            label: t('profile_donation_status_low'),
                            labelBg: 'bg-amber-900/80',
                            color: 'from-[#FF9966] to-[#FF5E62]',
                            message: t('profile_donation_msg_low'),
                            emoji: '😵'
                        }
                        if (percentage < 80) return {
                            zone: 'therapeutic',
                            label: t('profile_donation_status_ok'),
                            labelBg: 'bg-emerald-900/80',
                            color: 'from-emerald-500 to-teal-500',
                            message: t('profile_donation_msg_ok'),
                            emoji: '😊'
                        }
                        return {
                            zone: 'toxic',
                            label: t('profile_donation_status_high'),
                            labelBg: 'bg-purple-900/80',
                            color: 'from-purple-500 to-pink-500',
                            message: t('profile_donation_msg_high'),
                            emoji: '🤩'
                        }
                    }

                    const status = getTherapeuticStatus()

                    // 里程碑節點
                    const milestones = [
                        { percent: 0, label: t('profile_donation_milestone_1'), desc: t('profile_donation_milestone_1_desc') },
                        { percent: 25, label: t('profile_donation_milestone_2'), desc: t('profile_donation_milestone_2_desc') },
                        { percent: 50, label: t('profile_donation_milestone_3'), desc: t('profile_donation_milestone_3_desc') },
                        { percent: 75, label: t('profile_donation_milestone_4'), desc: t('profile_donation_milestone_4_desc') },
                        { percent: 100, label: t('profile_donation_milestone_5'), desc: t('profile_donation_milestone_5_desc') }
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
                                    {t('profile_donation_monitor')}
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
                                <span className="mb-1">{t('profile_accumulator')}</span>
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
                                        ✅ {percentage < 25 ? (percentage < 1 && percentage > 0 ? percentage.toFixed(1) : Math.floor(percentage)) : 0}% - {t('profile_donation_milestone_1')}
                                    </div>
                                )}
                                {percentage >= 25 && (
                                    <div>
                                        ✅ {percentage < 50 ? Math.floor(percentage) : 25}% - {t('profile_donation_milestone_2')}
                                    </div>
                                )}
                                {percentage >= 50 && (
                                    <div>
                                        ✅ {percentage < 75 ? Math.floor(percentage) : 50}% - {t('profile_donation_milestone_3')}
                                    </div>
                                )}
                                {percentage >= 75 && (
                                    <div>
                                        ✅ {percentage < 100 ? Math.floor(percentage) : 75}% - {t('profile_donation_milestone_4')}
                                    </div>
                                )}
                                {percentage >= 100 && <div>🔓 100% - {t('profile_donation_milestone_5')}</div>}
                            </div>

                            {/* 展開/收合 QR Code */}
                            <button
                                onClick={() => setDonationExpanded(!donationExpanded)}
                                className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg p-2.5 flex items-center justify-center gap-2 text-sm font-medium text-white shadow-sm transition-all border border-white/10"
                            >
                                {donationExpanded ? (
                                    <>{t('profile_donation_qr_collapse')} <ChevronUp className="w-4 h-4" /></>
                                ) : (
                                    <>{t('profile_donation_qr_expand')} <ChevronDown className="w-4 h-4" /></>
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
                                            {t('profile_donation_scan_hint')}
                                        </p>

                                        {/* 手機收款資訊 */}
                                        <div className="text-left bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3">
                                            <h4 className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                                                <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                                                {t('profile_donation_phone_pay')} <span className="text-slate-400 font-normal">(代碼 812)</span>
                                            </h4>
                                            <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
                                                {t('profile_donation_phone_desc')}
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
                                                        toast.success(t('profile_key_copied'))
                                                    }}
                                                    title={t('profile_copy_key')}
                                                >
                                                    <Copy className="w-3 h-3 text-slate-500" />
                                                </Button>
                                            </div>
                                        </div>

                                        <p className="text-[10px] text-slate-400 mt-1">
                                            {t('profile_donation_pharmacist')}
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
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t('account_recovery_key')}</h3>
                    <p className="text-[10px] text-slate-400 mb-3">
                        {t('recovery_key_desc')}
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
                                <span className="text-sm font-medium">{t('profile_theme')}</span>
                            </div>
                            <Switch checked={isDark} onCheckedChange={toggleDark} />
                        </div>
                        <Separator />

                        {/* 🎨 Accent Color Selector */}
                        <div className="p-4 text-slate-700 dark:text-slate-200">
                            <div className="flex items-center gap-3 mb-3">
                                <Palette className="w-5 h-5 text-slate-400" />
                                <span className="text-sm font-medium">{t('profile_accent_color')}</span>
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

                        {/* 🧠 AI Adaptive Memory Section */}
                        <div className="p-4 bg-white dark:bg-slate-800">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                        <Brain className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-800 dark:text-white">{t('profile_ai_memory')}</span>
                                        <span className="text-[10px] text-slate-400 font-medium">{t('profile_ai_memory_desc')}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isLoadPrefs && <Loader2 className="w-4 h-4 animate-spin text-slate-300" />}
                                    {preferences.length > 0 && (
                                        <button
                                            onClick={() => setMemoryExpanded(!memoryExpanded)}
                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all text-slate-400"
                                            title={memoryExpanded ? "收合" : "展開全部"}
                                        >
                                            {memoryExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {preferences.length === 0 ? (
                                <div className="ml-11 py-2 text-[11px] text-slate-400 italic">
                                    {isLoadPrefs ? t('loading') : t('profile_ai_memory_empty')}
                                </div>
                            ) : (
                                <div className="relative group/memory">
                                    <div className={cn(
                                        "ml-11 flex flex-wrap gap-2 transition-all duration-500 ease-in-out relative",
                                        !memoryExpanded && preferences.length > 3 ? "max-h-24 overflow-hidden" : "max-h-[1000px]"
                                    )}>
                                        {preferences.map((pref) => (
                                            <div
                                                key={pref.id}
                                                className="group relative flex items-center gap-2 px-3 py-1.5 bg-stone-50 dark:bg-slate-900/50 border border-stone-200 dark:border-slate-700 rounded-xl hover:border-blue-200 dark:hover:border-blue-900/50 transition-all"
                                            >
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-blue-500/70">
                                                            {t(`profile_pref_${pref.category}` as TranslationKey) || pref.category}
                                                        </span>
                                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{pref.preference}</span>
                                                    </div>
                                                    {pref.reasoning && (
                                                        <span className="text-[8px] text-slate-400 leading-tight max-w-[150px] truncate">{pref.reasoning}</span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => setMemoryToDelete(pref)}
                                                    className="opacity-40 lg:opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all"
                                                    title={t('profile_pref_delete')}
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-400" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* 🆕 漸層遮罩 (僅在收合且有更多資料時顯示) */}
                                    {!memoryExpanded && preferences.length > 3 && (
                                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white dark:from-slate-800 to-transparent pointer-events-none z-10" />
                                    )}

                                    {/* 🆕 展開/收合輔助按鈕 (僅在條目較多時顯示) */}
                                    {preferences.length > 3 && (
                                        <div className={cn(
                                            "ml-11 mt-2 flex justify-start transition-opacity duration-300",
                                            memoryExpanded ? "opacity-100" : "opacity-70 group-hover/memory:opacity-100"
                                        )}>
                                            <button
                                                onClick={() => setMemoryExpanded(!memoryExpanded)}
                                                className="text-[10px] font-bold text-blue-500 hover:text-blue-600 flex items-center gap-1 py-1"
                                            >
                                                {memoryExpanded ? (
                                                    <><ChevronUp className="w-3 h-3" /> {zh ? "收起" : "Collapse"}</>
                                                ) : (
                                                    <><ChevronDown className="w-3 h-3" /> {zh ? `瀏覽全部 (${preferences.length})` : `View All (${preferences.length})`}</>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <Separator />
                        <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
                            <DialogTrigger asChild>
                                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-stone-50 transition-colors text-slate-700">
                                    <div className="flex items-center gap-3">
                                        <Sparkles className="w-5 h-5 text-amber-500" />
                                        <span className="text-sm font-medium">{t('profile_gemini_api_key')}</span>
                                    </div>
                                    <span className={cn("text-xs px-2 py-1 rounded", hasApiKey ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600")}>
                                        {hasApiKey ? t('profile_key_active') : t('profile_key_inactive')}
                                    </span>
                                </div>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[450px]">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <Key className="w-5 h-5 text-amber-500" />
                                        {t('profile_api_key_settings')}
                                    </DialogTitle>
                                    <DialogDescription>
                                        {t('profile_api_key_desc')}<br />
                                        <span className="text-xs text-slate-400">({t('profile_api_key_local_only')})</span>
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="grid gap-4 py-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="apiKey" className="text-xs font-bold text-slate-500 uppercase">{t('profile_your_api_key')}</Label>
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
                                                🤔 {t('profile_how_to_get_api')}
                                            </AccordionTrigger>
                                            <AccordionContent className="text-xs text-slate-500 space-y-3 pb-4">
                                                <div className="flex gap-3">
                                                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">1</div>
                                                    <div>
                                                        {zh ? '前往' : 'Go to'} <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold inline-flex items-center">Google AI Studio <ExternalLink className="w-3 h-3 ml-0.5" /></a> {zh ? '並登入 Google 帳號。' : 'and sign in with Google.'}
                                                    </div>
                                                </div>
                                                <div className="flex gap-3">
                                                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">2</div>
                                                    <div>{zh ? '點擊左側選單的' : 'Click'} <b>Get API key</b>{zh ? '。' : ' in the left menu.'}</div>
                                                </div>
                                                <div className="flex gap-3">
                                                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">3</div>
                                                    <div>{zh ? '點擊' : 'Click'} <b>Create API key</b>{zh ? '，複製' : ', copy the code starting with'} <code>AIza...</code> {zh ? '開頭的代碼。' : '.'}</div>
                                                </div>
                                                <div className="bg-amber-50 text-amber-700 p-2 rounded border border-amber-100 flex items-start gap-2 mt-2">
                                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                                    <span>{zh ? '完全免費！每日可用 1,500 次。' : 'Completely free! 1,500 calls/day.'}</span>
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
                                        <Key className="w-4 h-4 mr-2" /> {zh ? '儲存設定' : 'Save'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* 🧠 AI 記憶移除確認視窗 */}
                        <Dialog 
                            open={!!memoryToDelete} 
                            onOpenChange={() => {
                                if (!isDeletingMemory) setMemoryToDelete(null)
                            }}
                        >
                            <DialogContent className="sm:max-w-[400px]">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-red-600">
                                        <Brain className="w-5 h-5 text-blue-500" />
                                        {t('profile_memory_delete_confirm_title')}
                                    </DialogTitle>
                                    <DialogDescription asChild>
                                        <div className="text-left text-sm text-muted-foreground pt-2">
                                            {t('profile_memory_delete_confirm_desc')}
                                            {memoryToDelete && (
                                                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                                    <span className="text-[10px] font-bold text-blue-500/70 uppercase tracking-wider block mb-1">
                                                        {t(`profile_pref_${memoryToDelete.category}` as TranslationKey) || memoryToDelete.category}
                                                    </span>
                                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                        &quot;{memoryToDelete.preference}&quot;
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter className="mt-4">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setMemoryToDelete(null)}
                                        disabled={isDeletingMemory}
                                    >
                                        {t('cancel')}
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => handleConfirmDeleteMemory()}
                                        disabled={isDeletingMemory}
                                        className="min-w-[100px]"
                                    >
                                        {isDeletingMemory ? (
                                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('profile_memory_deleting')}</>
                                        ) : (
                                            <>{t('profile_pref_delete')}</>
                                        )}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* 🆕 POI 推薦偏好設定 */}
                        <Separator />
                        <div className="p-4 space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Globe className="w-5 h-5 text-blue-500" />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{t('poi_pref_title')}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="pref-rating" className="text-sm text-slate-600 dark:text-slate-300">{t('poi_pref_rating')}</Label>
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
                                <Label htmlFor="pref-distance" className="text-sm text-slate-600 dark:text-slate-300">{t('poi_pref_distance')}</Label>
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
                                <Label htmlFor="pref-price" className="text-sm text-slate-600 dark:text-slate-300">{t('poi_pref_price')}</Label>
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
                        <MenuItem icon={BookOpen} label={t('usage_guide')} onClick={() => setUsageGuideOpen(true)} />
                        <Separator />
                        <MenuItem icon={Smartphone} label={t('app_version')} value="v1.0.0" />
                        <Separator />
                        <MenuItem icon={CreditCard} label={t('default_currency')} value="TWD (NT$)" />
                        <Separator />
                        <MenuItem 
                            icon={Mail} 
                            label={zh ? "聯絡開發者" : "Contact Developer"} 
                            onClick={() => setContactDialogOpen(true)} 
                        />
                        <Separator />
                        <MenuItem icon={Trash2} label={t('clear_cache')} isDestructive onClick={handleClearCache} />
                        <Separator />
                        {/* 🔴 刪除所有資料 (GDPR) */}
                        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                            <DialogTrigger asChild>
                                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-red-50 transition-colors text-red-600">
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle className="w-5 h-5 text-red-500" />
                                        <span className="text-sm font-medium">{t('profile_delete_all_data')}</span>
                                    </div>
                                    <span className="text-xs text-red-400">GDPR</span>
                                </div>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[400px]">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-red-600">
                                        <AlertTriangle className="w-5 h-5" />
                                        {t('profile_delete_all_data')}
                                    </DialogTitle>
                                    <DialogDescription asChild>
                                        <div className="text-left text-sm text-muted-foreground">
                                            {t('profile_delete_warning')}
                                            <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-500">
                                                <li>{t('profile_all_trips')}</li>
                                                <li>{t('profile_all_expenses')}</li>
                                                <li>{t('profile_all_photos')}</li>
                                            </ul>
                                            <p className="mt-3 text-red-600 font-bold">{t('profile_delete_irreversible')}</p>
                                        </div>
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <Label htmlFor="deleteConfirm" className="text-sm text-slate-600">
                                        {t('profile_type_delete')}
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
                                    <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>{t('cancel')}</Button>
                                    <Button
                                        variant="destructive"
                                        onClick={handleDeleteAllData}
                                        disabled={deleteConfirmText !== "DELETE" || isDeleting}
                                    >
                                        {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                        {t('profile_confirm_delete')}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* ✉️ 聯絡開發者 Dialog */}
                        <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
                            <DialogContent className="sm:max-w-[400px] border-blue-100/50 bg-white/90 backdrop-blur-xl dark:bg-slate-900/90 dark:border-slate-800">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-blue-600">
                                        <Mail className="w-5 h-5" />
                                        {zh ? "聯絡開發者" : "Contact Developer"}
                                    </DialogTitle>
                                    <DialogDescription className="text-left pt-2">
                                        {zh ? "如果您有任何建議、功能回報或合作意向，歡迎隨時聯繫我。" : "Feel free to reach out for suggestions, bug reports, or collaboration."}
                                    </DialogDescription>
                                </DialogHeader>
                                
                                <div className="py-6 flex flex-col items-center gap-4">
                                    <div className="p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/50 w-full flex flex-col items-center gap-1 group">
                                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{zh ? '官方信箱' : 'OFFICIAL EMAIL'}</span>
                                        <span className="text-lg font-mono font-medium text-slate-700 dark:text-slate-200">ryanpig228@gmail.com</span>
                                    </div>

                                    <div className="flex gap-3 w-full">
                                        <Button 
                                            variant="outline" 
                                            className={cn(
                                                "flex-1 h-11 transition-all duration-300",
                                                copied ? "border-green-500 text-green-500 bg-green-50 dark:bg-green-900/10" : "border-slate-200 dark:border-slate-700"
                                            )}
                                            onClick={handleCopyEmail}
                                        >
                                            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                                            {zh ? (copied ? "已複製" : "複製信箱") : (copied ? "Copied" : "Copy")}
                                        </Button>
                                    <Button 
                                        className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white"
                                        onClick={handleWriteEmail}
                                    >
                                        <Mail className="w-4 h-4 mr-2" />
                                        {zh ? "撰寫郵件" : "Write Email"}
                                    </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* 📖 使用說明 Dialog */}
                    <UsageGuideDialog open={usageGuideOpen} onOpenChange={setUsageGuideOpen} />

                    <Button variant="outline" className="w-full h-12 text-red-500 border-red-100 hover:bg-red-50 hover:text-red-600 mt-4" onClick={handleLogout}>
                        <LogOut className="w-4 h-4 mr-2" /> {t('logout')}
                    </Button>
                    <div className="h-20" />
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
