"use client"

import { useRef, forwardRef, useImperativeHandle } from "react"
import { Bold, Italic } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// 顏色選項
const COLOR_OPTIONS = [
    { key: "r", color: "#ef4444", label: "紅", className: "bg-red-500" },
    { key: "b", color: "#3b82f6", label: "藍", className: "bg-blue-500" },
    { key: "g", color: "#22c55e", label: "綠", className: "bg-green-500" },
    { key: "y", color: "#fbbf24", label: "黃底", className: "bg-yellow-400" },
]

interface RichTextareaProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
    minHeight?: string
}

export const RichTextarea = forwardRef<HTMLTextAreaElement, RichTextareaProps>(
    ({ value, onChange, placeholder, className, minHeight = "80px" }, ref) => {
        const textareaRef = useRef<HTMLTextAreaElement>(null)

        useImperativeHandle(ref, () => textareaRef.current!)

        // 取得選取的文字範圍
        const getSelection = () => {
            const textarea = textareaRef.current
            if (!textarea) return { start: 0, end: 0, text: "" }
            return {
                start: textarea.selectionStart,
                end: textarea.selectionEnd,
                text: value.substring(textarea.selectionStart, textarea.selectionEnd)
            }
        }

        // 包裝選取的文字
        const wrapSelection = (prefix: string, suffix: string) => {
            const { start, end, text } = getSelection()
            if (start === end) return // 沒選取文字

            const newValue = value.substring(0, start) + prefix + text + suffix + value.substring(end)
            onChange(newValue)

            // 恢復 focus 並更新選取範圍
            setTimeout(() => {
                const textarea = textareaRef.current
                if (textarea) {
                    textarea.focus()
                    textarea.setSelectionRange(start + prefix.length, end + prefix.length)
                }
            }, 0)
        }

        // 格式處理器
        const handleBold = () => wrapSelection("**", "**")
        const handleItalic = () => wrapSelection("*", "*")
        const handleColor = (colorKey: string) => wrapSelection(`<${colorKey}>`, `</${colorKey}>`)

        return (
            <div className="space-y-2">
                {/* 工具列 */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                    {/* 粗體 */}
                    <button
                        type="button"
                        onClick={handleBold}
                        className="p-1.5 rounded hover:bg-white hover:shadow-sm transition-all"
                        title="粗體"
                    >
                        <Bold className="w-4 h-4 text-slate-600" />
                    </button>

                    {/* 斜體 */}
                    <button
                        type="button"
                        onClick={handleItalic}
                        className="p-1.5 rounded hover:bg-white hover:shadow-sm transition-all"
                        title="斜體"
                    >
                        <Italic className="w-4 h-4 text-slate-600" />
                    </button>

                    {/* 分隔線 */}
                    <div className="w-px h-5 bg-slate-300 mx-1" />

                    {/* 顏色按鈕 */}
                    {COLOR_OPTIONS.map((opt) => (
                        <button
                            key={opt.key}
                            type="button"
                            onClick={() => handleColor(opt.key)}
                            className={cn(
                                "w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform",
                                opt.className
                            )}
                            title={opt.label}
                        />
                    ))}
                </div>

                {/* 文字輸入區 */}
                <Textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={cn("text-sm", className)}
                    style={{ minHeight }}
                />
            </div>
        )
    }
)

RichTextarea.displayName = "RichTextarea"
