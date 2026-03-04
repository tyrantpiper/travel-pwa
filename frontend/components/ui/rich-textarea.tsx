"use client"

import { useRef, forwardRef, useImperativeHandle, useState, useCallback } from "react"
import { Bold, Italic } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/LanguageContext"
import { TranslationKey } from "@/lib/i18n"

// 格式類型定義
type FormatType = "bold" | "italic" | "color-r" | "color-b" | "color-g" | "color-y"

// 格式設定常數
const FORMAT_CONFIG: Record<FormatType, { prefix: string; suffix: string }> = {
    bold: { prefix: "**", suffix: "**" },
    italic: { prefix: "*", suffix: "*" },
    "color-r": { prefix: "<r>", suffix: "</r>" },
    "color-b": { prefix: "<b>", suffix: "</b>" },
    "color-g": { prefix: "<g>", suffix: "</g>" },
    "color-y": { prefix: "<y>", suffix: "</y>" },
}

// 顏色選項 (moved inside component to use translation hook)
const COLOR_OPTIONS_FACTORY = (t: (key: TranslationKey) => string) => [
    { key: "r", format: "color-r" as FormatType, color: "#ef4444", label: t('rt_red'), className: "bg-red-500" },
    { key: "b", format: "color-b" as FormatType, color: "#3b82f6", label: t('rt_blue'), className: "bg-blue-500" },
    { key: "g", format: "color-g" as FormatType, color: "#22c55e", label: t('rt_green'), className: "bg-green-500" },
    { key: "y", format: "color-y" as FormatType, color: "#fbbf24", label: t('rt_yellow'), className: "bg-yellow-400" },
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
        const { t } = useLanguage()
        const textareaRef = useRef<HTMLTextAreaElement>(null)

        // 🆕 啟用中的格式狀態
        const [activeFormats, setActiveFormats] = useState<Set<FormatType>>(new Set())

        // 🆕 IME 組字狀態
        const [isComposing, setIsComposing] = useState(false)

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
            if (start === end) return false // 沒選取文字

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
            return true
        }

        // 🆕 Toggle 格式狀態
        const toggleFormat = useCallback((format: FormatType) => {
            setActiveFormats(prev => {
                const next = new Set(prev)

                // 顏色互斥處理
                if (format.startsWith("color-")) {
                    for (const f of next) {
                        if (f.startsWith("color-")) next.delete(f)
                    }
                }

                // Toggle
                if (next.has(format)) {
                    next.delete(format)
                } else {
                    next.add(format)
                }

                return next
            })
        }, [])

        // 🆕 清除所有格式
        const clearFormats = useCallback(() => {
            setActiveFormats(new Set())
        }, [])

        // 格式處理器 (增強版：有選取就套用，無選取就 toggle)
        const handleFormat = (format: FormatType) => {
            const config = FORMAT_CONFIG[format]
            const applied = wrapSelection(config.prefix, config.suffix)
            if (!applied) {
                // 沒有選取文字，進入 toggle 模式
                toggleFormat(format)
                // 確保 textarea 保持 focus
                textareaRef.current?.focus()
            }
        }

        const handleBold = () => handleFormat("bold")
        const handleItalic = () => handleFormat("italic")
        const handleColor = (format: FormatType) => handleFormat(format)

        // 🆕 鍵盤輸入處理
        const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            // 沒有啟用格式，不處理
            if (activeFormats.size === 0) return

            // IME 組字中，不處理
            if (isComposing) return

            // 只處理單一可見字元
            if (e.key.length !== 1) return

            // 排除修飾鍵
            if (e.ctrlKey || e.metaKey || e.altKey) return

            e.preventDefault()

            // 建構前後綴 (嵌套順序：Bold > Italic > Color)
            let prefix = ""
            let suffix = ""

            if (activeFormats.has("bold")) {
                prefix = "**" + prefix
                suffix = suffix + "**"
            }
            if (activeFormats.has("italic")) {
                prefix = prefix + "*"
                suffix = "*" + suffix
            }

            // 顏色（最內層）
            for (const f of activeFormats) {
                if (f.startsWith("color-")) {
                    const config = FORMAT_CONFIG[f]
                    prefix = prefix + config.prefix
                    suffix = config.suffix + suffix
                }
            }

            const textarea = textareaRef.current!
            const pos = textarea.selectionStart
            const newValue = value.substring(0, pos) + prefix + e.key + suffix + value.substring(pos)
            onChange(newValue)

            // 設定游標位置
            setTimeout(() => {
                textarea.focus()
                const newPos = pos + prefix.length + 1
                textarea.setSelectionRange(newPos, newPos)
            }, 0)

            // 清除啟用狀態
            clearFormats()
        }

        // 🆕 失焦時清除格式
        const handleBlur = () => {
            clearFormats()
        }

        return (
            <div className="space-y-2">
                {/* 工具列 */}
                <div
                    role="toolbar"
                    aria-label={t('rt_format_toolbar')}
                    className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200"
                >
                    {/* 粗體 */}
                    <button
                        type="button"
                        onClick={handleBold}
                        aria-pressed={activeFormats.has("bold")}
                        aria-label={t('rt_bold')}
                        className={cn(
                            "p-1.5 rounded transition-all duration-150",
                            activeFormats.has("bold")
                                ? "bg-amber-100 ring-2 ring-amber-400 scale-110"
                                : "hover:bg-white hover:shadow-sm"
                        )}
                        title={t('rt_bold')}
                    >
                        <Bold className={cn(
                            "w-4 h-4 transition-colors",
                            activeFormats.has("bold") ? "text-amber-600" : "text-slate-600"
                        )} />
                    </button>

                    {/* 斜體 */}
                    <button
                        type="button"
                        onClick={handleItalic}
                        aria-pressed={activeFormats.has("italic")}
                        aria-label={t('rt_italic')}
                        className={cn(
                            "p-1.5 rounded transition-all duration-150",
                            activeFormats.has("italic")
                                ? "bg-amber-100 ring-2 ring-amber-400 scale-110"
                                : "hover:bg-white hover:shadow-sm"
                        )}
                        title={t('rt_italic')}
                    >
                        <Italic className={cn(
                            "w-4 h-4 transition-colors",
                            activeFormats.has("italic") ? "text-amber-600" : "text-slate-600"
                        )} />
                    </button>

                    {/* 分隔線 */}
                    <div className="w-px h-5 bg-slate-300 mx-1" />

                    {/* 顏色按鈕 */}
                    {COLOR_OPTIONS_FACTORY(t).map((opt) => (
                        <button
                            key={opt.key}
                            type="button"
                            onClick={() => handleColor(opt.format)}
                            aria-pressed={activeFormats.has(opt.format)}
                            aria-label={opt.label}
                            className={cn(
                                "w-6 h-6 rounded-full shadow-sm transition-all duration-150",
                                activeFormats.has(opt.format)
                                    ? "ring-2 ring-offset-1 ring-slate-500 scale-125 border-2 border-slate-700"
                                    : "border-2 border-white hover:scale-110",
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
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={() => setIsComposing(false)}
                    placeholder={placeholder}
                    className={cn(
                        "text-sm",
                        isComposing && "transition-none",
                        className
                    )}
                    style={{ minHeight }}
                />
            </div>
        )
    }
)

RichTextarea.displayName = "RichTextarea"
