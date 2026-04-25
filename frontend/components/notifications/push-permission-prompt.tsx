"use client"

import { useState } from "react"
import { Bell, BellRing, X, Smartphone } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useLanguage } from "@/lib/LanguageContext"
import { useTheme } from "@/lib/ThemeContext"
import { usePushNotifications } from "@/lib/hooks/usePushNotifications"

interface PushPermissionPromptProps {
    isOpen: boolean
    onClose: () => void
    onSubscribed?: () => void
}

/**
 * 情境式推播授權引導彈窗
 *
 * 在關鍵時機（加入行程、新增費用後）顯示，
 * 說明通知價值後才呼叫原生 Notification.requestPermission()
 */
export function PushPermissionPrompt({ isOpen, onClose, onSubscribed }: PushPermissionPromptProps) {
    const { lang } = useLanguage()
    const zh = lang === "zh"
    const { currentTheme } = useTheme()
    const { subscribe, isLoading, permissionState } = usePushNotifications()
    const [step, setStep] = useState<"intro" | "done" | "denied">("intro")

    // 已授權或不支援時不顯示
    if (permissionState === "granted" || permissionState === "unsupported") return null

    const handleEnable = async () => {
        const success = await subscribe()
        if (success) {
            setStep("done")
            onSubscribed?.()
            setTimeout(() => { onClose(); setStep("intro") }, 2000)
        } else if (Notification.permission === "denied") {
            setStep("denied")
        }
    }

    const handleSkip = () => {
        onClose()
        setStep("intro")
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300]"
                        onClick={handleSkip}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="fixed inset-x-4 bottom-24 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[380px] z-[301] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-slate-700 overflow-hidden"
                    >
                        {/* Close */}
                        <button
                            onClick={handleSkip}
                            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors z-10"
                        >
                            <X className="w-4 h-4 text-slate-400" />
                        </button>

                        {step === "intro" && (
                            <div className="p-6 text-center">
                                <div
                                    className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                                    style={{ backgroundColor: currentTheme.primary + "20" }}
                                >
                                    <BellRing className="w-7 h-7" style={{ color: currentTheme.primary }} />
                                </div>

                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                                    {zh ? "開啟旅行通知" : "Enable Travel Alerts"}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                                    {zh
                                        ? "即時收到同伴加入行程、費用更新、出發倒數提醒，不錯過任何旅行動態！"
                                        : "Get instant updates when buddies join, expenses are added, and trip countdowns — never miss a beat!"}
                                </p>

                                {/* Feature highlights */}
                                <div className="space-y-2.5 mb-6 text-left">
                                    {[
                                        { icon: "🤝", text: zh ? "新夥伴加入行程" : "New buddy joins trip" },
                                        { icon: "💰", text: zh ? "費用分帳即時同步" : "Expense splits in real-time" },
                                        { icon: "✈️", text: zh ? "出發倒數提醒" : "Trip countdown reminders" },
                                    ].map((item) => (
                                        <div key={item.text} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-stone-50 dark:bg-slate-800/50">
                                            <span className="text-base">{item.icon}</span>
                                            <span className="text-sm text-slate-600 dark:text-slate-300">{item.text}</span>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={handleEnable}
                                    disabled={isLoading}
                                    className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-60"
                                    style={{ backgroundColor: currentTheme.primary }}
                                >
                                    {isLoading
                                        ? (zh ? "啟用中..." : "Enabling...")
                                        : (zh ? "開啟通知" : "Enable Notifications")}
                                </button>
                                <button
                                    onClick={handleSkip}
                                    className="w-full mt-2 py-2 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                >
                                    {zh ? "稍後再說" : "Maybe later"}
                                </button>
                            </div>
                        )}

                        {step === "done" && (
                            <div className="p-6 text-center">
                                <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/40">
                                    <Bell className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
                                    {zh ? "通知已開啟 🎉" : "Notifications Enabled 🎉"}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {zh ? "你不會錯過任何旅行動態了" : "You won't miss any travel updates"}
                                </p>
                            </div>
                        )}

                        {step === "denied" && (
                            <div className="p-6 text-center">
                                <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-amber-100 dark:bg-amber-900/40">
                                    <Smartphone className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                                    {zh ? "通知被封鎖了" : "Notifications Blocked"}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                                    {zh
                                        ? "請在瀏覽器設定中允許通知權限，然後重新開啟此功能。"
                                        : "Please allow notifications in your browser settings, then try again."}
                                </p>
                                <button
                                    onClick={handleSkip}
                                    className="w-full py-3 rounded-xl text-sm font-medium bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all active:scale-[0.98]"
                                >
                                    {zh ? "知道了" : "Got it"}
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
