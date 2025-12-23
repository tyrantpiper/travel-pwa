"use client"

import { useState, useEffect, useRef } from "react"

interface TypewriterTextProps {
    text: string
    speed?: number  // 每字符毫秒數
    onComplete?: () => void
    className?: string
    children?: React.ReactNode  // 用於渲染 (接收目前文字)
}

/**
 * ⌨️ 智慧打字機效果
 * 
 * 使用 requestAnimationFrame 優化效能
 * 只顯示純文字，不洩漏思想簽名
 */
export default function TypewriterText({
    text,
    speed = 20,
    onComplete,
    className,
    children
}: TypewriterTextProps) {
    const [displayedText, setDisplayedText] = useState("")
    const [isComplete, setIsComplete] = useState(false)
    const indexRef = useRef(0)
    const lastTimeRef = useRef(0)
    const rafRef = useRef<number | null>(null)

    // 重置當文字改變時
    useEffect(() => {
        indexRef.current = 0
        lastTimeRef.current = 0
        setDisplayedText("")
        setIsComplete(false)
    }, [text])

    // 動畫循環
    useEffect(() => {
        if (!text || isComplete) return

        const animate = (timestamp: number) => {
            if (!lastTimeRef.current) lastTimeRef.current = timestamp

            const elapsed = timestamp - lastTimeRef.current

            if (elapsed >= speed) {
                const currentIndex = indexRef.current

                if (currentIndex < text.length) {
                    // 一次顯示多個字符以加速長文
                    const charsToAdd = Math.min(
                        Math.ceil(elapsed / speed),
                        text.length - currentIndex
                    )

                    setDisplayedText(text.slice(0, currentIndex + charsToAdd))
                    indexRef.current = currentIndex + charsToAdd
                    lastTimeRef.current = timestamp

                    rafRef.current = requestAnimationFrame(animate)
                } else {
                    // 完成
                    setIsComplete(true)
                    onComplete?.()
                }
            } else {
                rafRef.current = requestAnimationFrame(animate)
            }
        }

        rafRef.current = requestAnimationFrame(animate)

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current)
            }
        }
    }, [text, speed, onComplete, isComplete])

    // 如果有 children，用 render props 模式
    if (children && typeof children === "function") {
        return (children as (text: string) => React.ReactNode)(displayedText)
    }

    // 預設：直接渲染文字
    return (
        <span className={className}>
            {displayedText}
            {!isComplete && (
                <span className="animate-pulse">▋</span>
            )}
        </span>
    )
}

/**
 * 從 rawParts 中安全提取可顯示的文字
 * 過濾掉 thought_signature 和其他系統資訊
 */
export function extractDisplayableText(rawParts: { text?: string; thought?: string }[]): string {
    if (!rawParts || !Array.isArray(rawParts)) return ""

    // 只提取 text 欄位，忽略 thought/thought_signature
    return rawParts
        .filter(part => part.text && !part.thought)
        .map(part => part.text)
        .join("")
}
