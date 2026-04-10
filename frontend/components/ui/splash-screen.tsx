"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"

export function SplashScreen() {
    const [show, setShow] = useState(true)
    const [isStandalone, setIsStandalone] = useState(false)

    // 檢查 PWA 模式和是否已顯示過閃屏
    useEffect(() => {
        // 檢查是否為 PWA 模式
        const standalone = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as unknown as { standalone?: boolean }).standalone === true
        // eslint-disable-next-line react-hooks/set-state-in-effect -- PWA detection requires init on mount
        setIsStandalone(standalone)

        // 檢查是否已經顯示過（同一 session）
        const hasShown = sessionStorage.getItem('splash_shown')
        if (hasShown || !standalone) {
            setShow(false)
            return
        }

        // 🚀 [2026 Perf Sync] 將閃屏停留時間優化為 1.2秒，提升「即開即用」的直觀感受
        const timer = setTimeout(() => {
            setShow(false)
            sessionStorage.setItem('splash_shown', 'true')
        }, 1200)

        return () => clearTimeout(timer)
    }, [])

    // 非 PWA 模式不顯示
    if (!isStandalone) return null

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-b from-stone-50 via-white to-stone-100"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                >
                    {/* 背景裝飾 - 更淡的圓形 */}
                    <div className="absolute inset-0 overflow-hidden">
                        <motion.div
                            className="absolute -top-32 -right-32 w-80 h-80 bg-stone-200/20 rounded-full blur-3xl"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 1, ease: "easeOut" }}
                        />
                        <motion.div
                            className="absolute -bottom-32 -left-32 w-80 h-80 bg-stone-200/20 rounded-full blur-3xl"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                        />
                    </div>

                    {/* Icon 動畫 */}
                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{
                            type: "spring",
                            stiffness: 200,
                            damping: 15,
                            duration: 0.8
                        }}
                        className="relative"
                    >
                        <motion.div
                            animate={{
                                scale: [1, 1.08, 1],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className="w-32 h-32"
                        >
                            <Image
                                src="/icon.png"
                                alt="Tabidachi"
                                width={128}
                                height={128}
                                className="w-full h-full object-contain drop-shadow-lg"
                                priority
                            />
                        </motion.div>

                        {/* 光暈效果 */}
                        <motion.div
                            className="absolute inset-0 rounded-3xl"
                            initial={{ boxShadow: "0 0 0 0 rgba(251, 191, 36, 0)" }}
                            animate={{
                                boxShadow: [
                                    "0 0 0 0 rgba(251, 191, 36, 0.4)",
                                    "0 0 0 20px rgba(251, 191, 36, 0)",
                                ]
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: "easeOut"
                            }}
                        />
                    </motion.div>

                    {/* 文字 */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.5 }}
                        className="mt-8 text-center"
                    >
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
                            Tabidachi
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">AI Travel Planner</p>
                    </motion.div>

                    {/* Loading 指示器 */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="mt-8"
                    >
                        <div className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    className="w-2 h-2 rounded-full bg-amber-400"
                                    animate={{
                                        scale: [1, 1.5, 1],
                                        opacity: [0.5, 1, 0.5]
                                    }}
                                    transition={{
                                        duration: 1,
                                        repeat: Infinity,
                                        delay: i * 0.2
                                    }}
                                />
                            ))}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
