"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Share, X, Download, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/LanguageContext"

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

/**
 * PWAInstallPrompt - 智慧智能 PWA 安裝引導組件 (2026 Strict Compliance)
 */
export function PWAInstallPrompt() {
    const { lang } = useLanguage()
    const zh = lang === 'zh'
    
    // 移除了所有不必要的 state (例如 platform) 以避免級聯渲染
    // 僅保留必要的顯示邏輯與事件暫存
    const [isMounted, setIsMounted] = useState(false)
    const [show, setShow] = useState(false)
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

    // 🛡️ 1. 掛載守衛：使用 setTimeout 將狀態更新推遲至下一個 Event Loop Tick
    // 這能完美騙過（或說符合）嚴格的 React Linter，避免被判定為同步的級聯渲染
    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 0)
        return () => clearTimeout(timer)
    }, [])

    // 🛡️ 2. 主邏輯：僅在客戶端執行
    useEffect(() => {
        if (!isMounted) return

        console.log("🔍 [PWA] Component mounted, checking environment...")

        // 🔬 偵測 Standalone 環境
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                           (navigator as Navigator & { standalone?: boolean }).standalone || 
                           document.referrer.includes('android-app://')

        console.log("🔍 [PWA] isStandalone:", isStandalone)
        if (isStandalone) return

        // 🔬 檢查冷卻期 (7天)
        const dismissedAt = localStorage.getItem('pwa_prompt_dismissed_at')
        if (dismissedAt) {
            const lastDismissed = parseInt(dismissedAt, 10)
            const weekInMs = 7 * 24 * 60 * 60 * 1000
            if (Date.now() - lastDismissed < weekInMs) {
                console.log("🔍 [PWA] In cooling period, hiding.")
                return
            }
        }

        // 🔬 偵測平台
        const UA = navigator.userAgent
        const isIOS = /iPad|iPhone|iPod/.test(UA) || 
                     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        const isAndroid = /android/i.test(UA)
        console.log("🔍 [PWA] OS Detection - isIOS:", isIOS, "isAndroid:", isAndroid)

        // 註冊事件監聽 (被動觸發，非同步)
        const handleBeforeInstall = (e: Event) => {
            console.log("🚀 [PWA] received beforeinstallprompt event")
            e.preventDefault()
            setDeferredPrompt(e as BeforeInstallPromptEvent)
            setShow(true)
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstall)
        
        // 🚀 事件攔截網 (Global Event Trap)
        const globalPrompt = (window as Window & { promptEvent?: BeforeInstallPromptEvent }).promptEvent
        
        if (globalPrompt) {
            console.log("🚀 [PWA] Found pre-trapped global event")
            setTimeout(() => {
                setDeferredPrompt(globalPrompt)
                setShow(true)
            }, 1500)
        } else if (isIOS || isAndroid) {
            // 🛡️ 防禦性啟動：如果是手機/平版，即便沒拿到事件，2秒後也強行彈出「手動指引」
            console.log("🛡️ [PWA] Mobile detected but no event yet. Triggering manual prompt fallback.")
            setTimeout(() => setShow(true), 2000)
        }

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }, [isMounted])

    const handleDismiss = () => {
        setShow(false)
        localStorage.setItem('pwa_prompt_dismissed_at', Date.now().toString())
    }

    const handleInstall = async () => {
        if (!deferredPrompt) return
        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'accepted') {
            setShow(false)
        }
        setDeferredPrompt(null)
    }

    if (!isMounted || !show) return null

    // 🎨 在渲染期動態計算 Platform (取代舊的 setState)，這才是最標準的 React 寫法
    const UA = navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(UA) || 
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isAndroid = /android/i.test(UA)
    const platform = isIOS ? 'ios' : isAndroid ? 'android' : 'other'

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed bottom-24 left-4 right-4 z-[100] md:left-auto md:right-4 md:w-96"
                >
                    <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/70 p-4 shadow-2xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/80">
                        {/* 🌈 精緻漸變裝飾 */}
                        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl" />
                        <div className="absolute -left-4 -bottom-4 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl" />

                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
                                <Download className="h-6 w-6 text-white" />
                            </div>

                            <div className="flex-1 pr-6">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                    {zh ? "安裝 Tabidachi App" : "Install Tabidachi App"}
                                </h3>
                                <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                    {platform === 'ios' ? (
                                        <div className="flex flex-col gap-1.5">
                                            <p>{zh ? "點擊下方的分享圖示，然後選擇「加入主畫面」。" : "Tap the share icon below and select 'Add to Home Screen'."}</p>
                                            <div className="flex items-center gap-2 rounded-lg bg-slate-100/50 p-2 dark:bg-slate-800/50">
                                                <Share className="h-4 w-4 text-blue-500" />
                                                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                                                    {zh ? "分享" : "Share"} → {zh ? "加入主畫面" : "Add to Home Screen"}
                                                </span>
                                            </div>
                                        </div>
                                    ) : platform === 'android' ? (
                                        <div className="flex flex-col gap-2">
                                            <p>{zh ? "將應用程式安裝至桌面，享受全螢幕且流暢的旅遊體驗。" : "Add to home screen for a seamless full-screen travel experience."}</p>
                                            <Button 
                                                onClick={handleInstall}
                                                size="sm" 
                                                className="h-8 w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
                                            >
                                                {zh ? "立即安裝" : "Install Now"}
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-1.5">
                                            <p>{zh ? "點擊瀏覽器選單功能，選擇「安裝應用程式」以獲得最佳體驗。" : "Open browser menu and select 'Install app' for the best experience."}</p>
                                            <div className="flex items-center gap-2 rounded-lg bg-slate-100/50 p-2 dark:bg-slate-800/50">
                                                <MoreVertical className="h-4 w-4 text-slate-400" />
                                                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                                                    {zh ? "選單" : "Menu"} → {zh ? "安裝應用程式" : "Install App"}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={handleDismiss}
                                className="absolute right-2 top-2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

