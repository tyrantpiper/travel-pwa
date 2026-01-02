"use client"

import { useMemo, Fragment } from "react"
import { cn } from "@/lib/utils"

interface RichDisplayProps {
    text: string
    className?: string
}

/**
 * 解析並渲染富文本（安全版）
 * 支援語法：
 *   **粗體** → <strong>
 *   *斜體*  → <em>
 *   <r>紅色</r> → 紅色文字
 *   <b>藍色</b> → 藍色文字
 *   <g>綠色</g> → 綠色文字
 *   <y>黃底</y> → 黃色背景
 */
export function RichDisplay({ text, className }: RichDisplayProps) {
    const rendered = useMemo(() => parseRichText(text || ""), [text])

    return (
        <div className={cn("whitespace-pre-wrap", className)}>
            {rendered}
        </div>
    )
}

// 解析器：將文字轉換為 React 元素（安全，無 dangerouslySetInnerHTML）
function parseRichText(text: string): React.ReactNode[] {
    if (!text) return []

    // 合併所有 pattern 為一個大 regex
    const combinedRegex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(<r>(.+?)<\/r>)|(<b>(.+?)<\/b>)|(<g>(.+?)<\/g>)|(<y>(.+?)<\/y>)/g

    const result: React.ReactNode[] = []
    let lastIndex = 0
    let match
    let keyCounter = 0

    while ((match = combinedRegex.exec(text)) !== null) {
        // 加入匹配前的純文字
        if (match.index > lastIndex) {
            result.push(<Fragment key={keyCounter++}>{text.substring(lastIndex, match.index)}</Fragment>)
        }

        // 判斷是哪種匹配
        if (match[1]) {
            // **粗體**
            result.push(<strong key={keyCounter++}>{match[2]}</strong>)
        } else if (match[3]) {
            // *斜體*
            result.push(<em key={keyCounter++}>{match[4]}</em>)
        } else if (match[5]) {
            // <r>紅色</r>
            result.push(<span key={keyCounter++} className="text-red-500">{match[6]}</span>)
        } else if (match[7]) {
            // <b>藍色</b>
            result.push(<span key={keyCounter++} className="text-blue-500">{match[8]}</span>)
        } else if (match[9]) {
            // <g>綠色</g>
            result.push(<span key={keyCounter++} className="text-green-500">{match[10]}</span>)
        } else if (match[11]) {
            // <y>黃底</y>
            result.push(<span key={keyCounter++} className="bg-yellow-200 px-0.5 rounded">{match[12]}</span>)
        }

        lastIndex = match.index + match[0].length
    }

    // 加入最後的純文字
    if (lastIndex < text.length) {
        result.push(<Fragment key={keyCounter++}>{text.substring(lastIndex)}</Fragment>)
    }

    return result.length > 0 ? result : [<Fragment key={0}>{text}</Fragment>]
}
