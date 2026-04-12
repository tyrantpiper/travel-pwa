"use client"

import { useState, useEffect, useRef } from "react"

/**
 * 2026 Master Scroll Strategy: 
 * Detects scroll direction and distance across internal containers using event capture.
 */
export function useScrollState() {
    const [isNavVisible, setIsNavVisible] = useState(true)
    const [isAtTop, setIsAtTop] = useState(true) // 🆕 頂端感應狀態
    const [showTopButton, setShowTopButton] = useState(false)
    const lastScrollY = useRef(0)
    const scrollContainerRef = useRef<HTMLElement | null>(null)

    useEffect(() => {
        const SCROLL_THRESHOLD = 15 // 滾動超過 15px 才變更導覽列狀態
        const BUTTON_THRESHOLD = 400 // 超過 400px 顯示回頂部

        const handleScroll = (e: Event) => {
            const target = e.target as HTMLElement
            if (!target || !(target instanceof HTMLElement)) return
            
            // 紀錄目前的滾動容器，供回頂部按鈕使用
            scrollContainerRef.current = target

            const currentScrollY = target.scrollTop
            
            // 0. 處理頂端感應 (保留 10px 容錯)
            setIsAtTop(currentScrollY < 10)

            // 1. 處理回頂部按鈕顯示 (絕對位置)
            setShowTopButton(currentScrollY > BUTTON_THRESHOLD)

            // 2. 處理導覽列隱藏/顯示 (方向判定)
            const diff = currentScrollY - lastScrollY.current

            // 如果滾動距離非常小，忽略它（避免抖動）
            if (Math.abs(diff) < SCROLL_THRESHOLD) return

            if (diff > 0 && isNavVisible && currentScrollY > 100) {
                // 向下滾動且位置不在最頂端 -> 隱藏
                setIsNavVisible(false)
            } else if (diff < 0 && !isNavVisible) {
                // 向上滾動 -> 顯示
                setIsNavVisible(true)
            }

            lastScrollY.current = currentScrollY
        }

        // 使用 capture: true 以便在捕獲階段捕捉到子元件的滾動事件
        window.addEventListener("scroll", handleScroll, true)
        return () => window.removeEventListener("scroll", handleScroll, true)
    }, [isNavVisible])

    const scrollToTop = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
                top: 0,
                behavior: "smooth"
            })
        }
    }

    return { isNavVisible, isAtTop, showTopButton, scrollToTop }
}
