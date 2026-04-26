"use client"

import { useState, useEffect, useCallback } from "react"
import { Bell, CheckCheck, Users, DollarSign, Plane, Megaphone, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { getSupabaseClient } from "@/lib/supabase"
import { useLanguage } from "@/lib/LanguageContext"
import { useTheme } from "@/lib/ThemeContext"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"

interface Notification {
    id: string
    user_id: string
    type: "trip_invite" | "new_expense" | "trip_countdown" | "system_announcement"
    title: string
    body: string
    link: string | null
    metadata: Record<string, unknown>
    is_read: boolean
    created_at: string
}

const TYPE_ICONS: Record<string, typeof Users> = {
    trip_invite: Users,
    new_expense: DollarSign,
    trip_countdown: Plane,
    system_announcement: Megaphone,
}

const TYPE_COLORS: Record<string, string> = {
    trip_invite: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
    new_expense: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
    trip_countdown: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
    system_announcement: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
}

function timeAgo(dateStr: string, zh: boolean): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return zh ? "剛剛" : "Just now"
    if (mins < 60) return zh ? `${mins} 分鐘前` : `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return zh ? `${hours} 小時前` : `${hours}h ago`
    const days = Math.floor(hours / 24)
    return zh ? `${days} 天前` : `${days}d ago`
}

export function NotificationBell() {
    const { lang } = useLanguage()
    const zh = lang === "zh"
    const { currentTheme, accentColor } = useTheme()
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)

    const fetchNotifications = useCallback(async () => {
        const userId = localStorage.getItem("user_uuid")
        const supabase = getSupabaseClient()
        if (!supabase || !userId) return

        const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(30)

        if (!error && data) {
            setNotifications(data as Notification[])
            setUnreadCount(data.filter((n: Notification) => !n.is_read).length)
        }
    }, [])

    useEffect(() => {
        const userId = localStorage.getItem("user_uuid")
        const supabase = getSupabaseClient()

        // 非同步排程初始載入
        const initialFetch = setTimeout(fetchNotifications, 0)

        // Supabase Realtime 訂閱：監聽該使用者的新通知
        let channel: ReturnType<NonNullable<ReturnType<typeof getSupabaseClient>>["channel"]> | null = null

        if (supabase && userId) {
            channel = supabase
                .channel("notifications-realtime")
                .on(
                    "postgres_changes" as const,
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "notifications",
                        filter: `user_id=eq.${userId}`,
                    },
                    (payload: { new: Notification }) => {
                        // 新通知即時推入列表頂部
                        setNotifications((prev) => [payload.new as Notification, ...prev].slice(0, 30))
                        setUnreadCount((prev) => prev + 1)
                    }
                )
                .subscribe()
        }

        return () => {
            clearTimeout(initialFetch)
            if (channel) {
                supabase?.removeChannel(channel)
            }
        }
    }, [fetchNotifications])

    const markAsRead = async (id: string) => {
        const supabase = getSupabaseClient()
        if (!supabase) return

        await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("id", id)

        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
    }

    const markAllRead = async () => {
        const userId = localStorage.getItem("user_uuid")
        const supabase = getSupabaseClient()
        if (!supabase || !userId) return

        await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("user_id", userId)
            .eq("is_read", false)

        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
        setUnreadCount(0)
    }

    const handleNotificationClick = (notif: Notification) => {
        if (!notif.is_read) markAsRead(notif.id)
        setIsOpen(false)
        // Deep link navigation handled by the app's routing
        if (notif.link) {
            router.push(notif.link)
        }
    }

    return (
        <div className="relative">
            {/* Bell Button */}
            <button
                onClick={() => { setIsOpen(!isOpen); if (!isOpen) fetchNotifications(); }}
                className="relative p-2 rounded-full hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
                aria-label={zh ? "通知" : "Notifications"}
            >
                <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                {unreadCount > 0 && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1"
                        style={{ backgroundColor: accentColor !== "default" ? currentTheme.primary : "#ef4444" }}
                    >
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </motion.span>
                )}
            </button>

            {/* Notification Panel Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[200]"
                            onClick={() => setIsOpen(false)}
                        />
                        {/* Panel */}
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            className="absolute right-0 top-12 z-[201] w-[340px] max-h-[70vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-slate-700 overflow-hidden"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-slate-800">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                                    {zh ? "通知" : "Notifications"}
                                </h3>
                                <div className="flex items-center gap-1">
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={markAllRead}
                                            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                        >
                                            <CheckCheck className="w-3.5 h-3.5 inline mr-1" />
                                            {zh ? "全部已讀" : "Read all"}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <X className="w-4 h-4 text-slate-400" />
                                    </button>
                                </div>
                            </div>

                            {/* Notification List */}
                            <div className="overflow-y-auto max-h-[calc(70vh-52px)] overscroll-contain">
                                {notifications.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <Bell className="w-10 h-10 mx-auto text-stone-300 dark:text-slate-600 mb-3" />
                                        <p className="text-sm text-stone-400 dark:text-slate-500">
                                            {zh ? "暫無通知" : "No notifications yet"}
                                        </p>
                                    </div>
                                ) : (
                                    notifications.map((notif) => {
                                        const Icon = TYPE_ICONS[notif.type] || Bell
                                        const colorClass = TYPE_COLORS[notif.type] || ""
                                        return (
                                            <button
                                                key={notif.id}
                                                onClick={() => handleNotificationClick(notif)}
                                                className={cn(
                                                    "w-full text-left px-4 py-3 flex gap-3 items-start border-b border-stone-50 dark:border-slate-800/50 hover:bg-stone-50 dark:hover:bg-slate-800/50 transition-colors",
                                                    !notif.is_read && "bg-blue-50/50 dark:bg-blue-950/20"
                                                )}
                                            >
                                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5", colorClass)}>
                                                    <Icon className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={cn(
                                                        "text-sm leading-snug",
                                                        notif.is_read
                                                            ? "text-slate-500 dark:text-slate-400"
                                                            : "text-slate-800 dark:text-white font-medium"
                                                    )}>
                                                        {notif.body}
                                                    </p>
                                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                                                        {timeAgo(notif.created_at, zh)}
                                                    </p>
                                                </div>
                                                {!notif.is_read && (
                                                    <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
                                                )}
                                            </button>
                                        )
                                    })
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
