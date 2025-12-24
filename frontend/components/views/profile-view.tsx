"use client"

import { useState, useEffect } from "react"
import {
    LogOut, CreditCard, Edit3, Save, Camera, Trash2, Smartphone, User, Loader2, X,
    Shield, Copy, Globe, Key, Sparkles, ExternalLink, AlertCircle, Moon, Sun, Palette, AlertTriangle
} from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

import { useLanguage } from "@/lib/LanguageContext"
import { useTheme, ACCENT_COLORS, AccentColor } from "@/lib/ThemeContext"
import { ImageUpload } from "@/components/ui/image-upload"
import { toast } from "sonner"
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import {
    Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"



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
        const name = localStorage.getItem("user_nickname")
        const avatar = localStorage.getItem("user_avatar")
        // Check localStorage and DEV key
        const devKey = process.env.NEXT_PUBLIC_DEV_GEMINI_KEY
        const storedKey = localStorage.getItem("user_gemini_key") || localStorage.getItem("gemini_api_key") || devKey

        setProfile(prev => ({
            ...prev,
            nickname: name || "Traveler",
            avatarUrl: avatar || ""
        }))

        if (storedKey) {
            setApiKey(devKey ? "(開發者模式)" : storedKey)
            setHasApiKey(true)
            // Migrate old key name to new key name (only for non-dev keys)
            if (!devKey && !localStorage.getItem("user_gemini_key") && localStorage.getItem("gemini_api_key")) {
                localStorage.setItem("user_gemini_key", storedKey)
                localStorage.removeItem("gemini_api_key")
            }
        }

        // 🆕 載入 POI 偏好設定
        const savedPoiPrefs = localStorage.getItem("poi_preferences")
        if (savedPoiPrefs) {
            try {
                setPoiPreferences(JSON.parse(savedPoiPrefs))
            } catch { /* ignore */ }
        }
    }, [])

    const handleSaveProfile = () => {
        localStorage.setItem("user_nickname", profile.nickname)
        setIsEditing(false)
        toast.success("Profile updated!")
    }

    const handleRemoveAvatar = () => {
        if (!confirm("Remove avatar?")) return
        setProfile(prev => ({ ...prev, avatarUrl: "" }))
        localStorage.removeItem("user_avatar")
    }

    const handleAvatarChange = (url: string) => {
        setProfile(prev => ({ ...prev, avatarUrl: url }))
        if (url) {
            localStorage.setItem("user_avatar", url)
        } else {
            localStorage.removeItem("user_avatar")
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
            localStorage.clear()
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
        <div className="min-h-screen bg-stone-50 dark:bg-slate-900 pb-32">

            <div className={cn("h-48 relative overflow-hidden bg-gradient-to-br", currentTheme.gradient)}>
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1480796927426-f609979314bd?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-30"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-stone-50/90 dark:to-slate-900/90"></div>
            </div>

            <div className="px-6 relative -mt-20">
                <div className="flex flex-col items-center">
                    <div className="relative group">
                        {/* Avatar Display - 點擊可預覽 */}
                        <Avatar
                            className={cn(
                                "w-28 h-28 border-4 border-white shadow-xl bg-white",
                                profile.avatarUrl && "cursor-pointer hover:ring-4 hover:ring-blue-400 transition-all"
                            )}
                            onClick={() => profile.avatarUrl && setAvatarPreviewOpen(true)}
                        >
                            <AvatarImage src={profile.avatarUrl || undefined} className="object-cover" />
                            <AvatarFallback className="bg-slate-100 text-slate-400 text-3xl font-bold">
                                {profile.nickname.slice(0, 1).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>

                        {/* Cloudinary Upload Button */}
                        <div className="absolute top-0 right-0 z-10">
                            <ImageUpload
                                value=""
                                onChange={handleAvatarChange}
                                folder="ryan_travel/avatars"
                                icon={<Camera className="w-3 h-3 text-white" />}
                                className="bg-amber-400 p-1.5 rounded-full shadow-md hover:bg-amber-500 cursor-pointer"
                            />
                        </div>

                        {/* Remove Button */}
                        {profile.avatarUrl && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveAvatar(); }}
                                className="absolute top-0 left-0 bg-red-500 p-1.5 rounded-full text-white shadow-md hover:bg-red-600 transition-colors z-10"
                                title="Remove avatar"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    {/* 頭像全螢幕預覽 */}
                    <Dialog open={avatarPreviewOpen} onOpenChange={setAvatarPreviewOpen}>
                        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/90 border-0 flex items-center justify-center">
                            {profile.avatarUrl && (
                                <Image
                                    src={profile.avatarUrl}
                                    alt="Avatar Preview"
                                    fill
                                    className="object-contain rounded-lg cursor-pointer"
                                    onClick={() => setAvatarPreviewOpen(false)}
                                    unoptimized
                                />
                            )}
                        </DialogContent>
                    </Dialog>

                    <div className="mt-4 text-center space-y-1 w-full flex flex-col items-center">
                        {isEditing ? (
                            <div className="flex flex-col items-center gap-2">
                                <Input
                                    value={profile.nickname}
                                    onChange={e => setProfile({ ...profile, nickname: e.target.value })}
                                    className="text-center font-bold text-xl h-10 w-48 bg-white border-slate-300"
                                    placeholder="Enter nickname"
                                />
                                <Button size="sm" className="h-8 bg-slate-900 text-white" onClick={handleSaveProfile}>
                                    <Save className="w-3 h-3 mr-1" /> Save
                                </Button>
                            </div>
                        ) : (
                            <>
                                <h2 className="text-2xl font-bold text-slate-800 flex items-center justify-center gap-2">
                                    {profile.nickname}
                                    <button onClick={() => setIsEditing(true)} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors">
                                        <Edit3 className="w-4 h-4 text-slate-400" />
                                    </button>
                                </h2>
                                <p className="text-sm text-slate-500 font-medium">Explorer</p>
                            </>
                        )}
                    </div>
                </div>

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

                                    <Accordion type="single" collapsible className="w-full bg-slate-50 rounded-lg px-4 border border-slate-100">
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
