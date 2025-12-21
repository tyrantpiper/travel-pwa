"use client"

import { useState, useEffect, useRef } from "react"
import {
    LogOut, CreditCard, Edit3, Save, Camera, Trash2, Smartphone, User, Loader2, X,
    Shield, Copy, Globe
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { createClient } from "@supabase/supabase-js"
import { useLanguage } from "@/lib/LanguageContext"
import { ImageUpload } from "@/components/ui/image-upload"
import { toast } from "sonner"

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function ProfileView() {
    const { lang, setLang, t } = useLanguage()
    const [isEditing, setIsEditing] = useState(false)

    const [profile, setProfile] = useState({
        nickname: "Traveler",
        avatarUrl: "",
        email: "",
        bio: "Explorer"
    })

    useEffect(() => {
        const name = localStorage.getItem("user_nickname")
        const avatar = localStorage.getItem("user_avatar")

        setProfile(prev => ({
            ...prev,
            nickname: name || "Traveler",
            avatarUrl: avatar || ""
        }))
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

    return (
        <div className="min-h-screen bg-stone-50 pb-32">

            <div className="h-48 bg-slate-900 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1480796927426-f609979314bd?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-40"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-stone-50/90"></div>
            </div>

            <div className="px-6 relative -mt-20">
                <div className="flex flex-col items-center">
                    <div className="relative group">
                        {/* Avatar Display */}
                        <Avatar className="w-28 h-28 border-4 border-white shadow-xl bg-white">
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

                    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
                        <MenuItem icon={Globe} label={t('language')} value={lang === 'zh' ? '繁體中文' : 'English'} onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} />
                        <Separator />
                        <MenuItem icon={User} label={t('account_settings')} />
                        <Separator />
                        <MenuItem icon={Smartphone} label={t('app_version')} value="v1.0.0" />
                        <Separator />
                        <MenuItem icon={CreditCard} label={t('default_currency')} value="TWD (NT$)" />
                        <Separator />
                        <MenuItem icon={Trash2} label={t('clear_cache')} isDestructive onClick={handleClearCache} />
                    </div>

                    <Button variant="outline" className="w-full h-12 text-red-500 border-red-100 hover:bg-red-50 hover:text-red-600 mt-4" onClick={handleLogout}>
                        <LogOut className="w-4 h-4 mr-2" /> {t('logout')}
                    </Button>
                </div>

            </div>
        </div>
    )
}

function MenuItem({ icon: Icon, label, value, isDestructive, onClick }: any) {
    return (
        <div className={cn("flex items-center justify-between p-4 cursor-pointer hover:bg-stone-50 transition-colors", isDestructive ? "text-red-500 hover:bg-red-50" : "text-slate-700")} onClick={onClick}>
            <div className="flex items-center gap-3"><Icon className={cn("w-5 h-5", isDestructive ? "text-red-400" : "text-slate-400")} /><span className="text-sm font-medium">{label}</span></div>
            {value && <span className="text-xs text-slate-400 bg-stone-100 px-2 py-1 rounded">{value}</span>}
        </div>
    )
}
