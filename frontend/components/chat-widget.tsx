"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { MessageCircle, X, Send, Image as ImageIcon, Bot, User } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useTripContext } from "@/lib/trip-context"
import { useTripDetail } from "@/lib/hooks"
import { getLeanItinerary, LeanItinerary } from "@/lib/getLeanItinerary"
import SourceCitation from "@/components/chat/SourceCitation"
import ThinkingIndicator from "@/components/chat/ThinkingIndicator"
import POIPreviewCard, { extractFunctionCall } from "@/components/chat/POIPreviewCard"
import { streamChat } from "@/lib/sse-parser"
import { toast } from "sonner"

// 🆕 Part 結構 (與 Gemini API 對應)
interface Part {
    text?: string
    function_call?: { name: string; args: Record<string, unknown> }
    thought?: string  // 思想簽名 (加密)
    _raw?: string
}

// 🆕 來源標籤
interface GroundingSource {
    title: string
    uri: string
}

interface Message {
    role: "user" | "model"
    displayContent: string    // UI 渲染用的文字
    rawParts: Part[]          // 🔒 Round-trip 回後端 (含 thought_signature)
    groundingSources?: GroundingSource[]  // 來源標籤 (如有)
    modelUsed?: string        // 使用的模型 (調試用)
    sources?: Array<{ title: string; url: string }>  // 🆕 v3.7.1: 三源引用
}

interface Position {
    x: number
    y: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// 城市座標映射
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
    "東京": { lat: 35.6895, lng: 139.6917 },
    "tokyo": { lat: 35.6895, lng: 139.6917 },
    "大阪": { lat: 34.6937, lng: 135.5023 },
    "osaka": { lat: 34.6937, lng: 135.5023 },
    "京都": { lat: 35.0116, lng: 135.7681 },
    "kyoto": { lat: 35.0116, lng: 135.7681 },
    "福岡": { lat: 33.5904, lng: 130.4017 },
    "名古屋": { lat: 35.1815, lng: 136.9066 },
    "札幌": { lat: 43.0618, lng: 141.3545 },
    "沖繩": { lat: 26.2124, lng: 127.6809 },
}

export default function ChatWidget() {
    // ✅ 直接使用 TripContext（現在 ChatWidget 在 TripProvider 內）
    const { activeTrip, activeTripId } = useTripContext()

    // 🆕 取得行程詳細資料 (包含 items)
    const { trip: tripDetail } = useTripDetail(activeTripId)

    // 從行程標題解析位置（即時更新）
    const tripLocation = useMemo(() => {
        if (!activeTrip?.title) return null
        const titleLower = (activeTrip.title as string).toLowerCase()
        for (const [city, coords] of Object.entries(CITY_COORDS)) {
            if (titleLower.includes(city)) {
                return { ...coords, name: city }
            }
        }
        return null
    }, [activeTrip])

    // 🆕 產生精簡版行程供 AI 使用
    const leanItinerary: LeanItinerary | null = useMemo(() => {
        if (!activeTrip || !tripDetail?.items) return null
        return getLeanItinerary(activeTrip, tripDetail.items)
    }, [activeTrip, tripDetail])

    const [isOpen, setIsOpen] = useState(false)
    // 🆕 向後相容：將舊格式訊息遷移到新格式
    const hydrateMessage = (msg: Partial<Message> & { content?: string }): Message => ({
        role: msg.role || "model",
        displayContent: msg.displayContent || msg.content || "",
        rawParts: msg.rawParts || [{ text: msg.displayContent || msg.content || "" }],
        groundingSources: msg.groundingSources,
        modelUsed: msg.modelUsed
    })

    const [messages, setMessages] = useState<Message[]>([
        hydrateMessage({
            role: "model",
            displayContent: "👋哈囉！我是 Ryan，你的 AI 旅遊達人！\n\n💡 **我能幫你：**\n• 翻譯、推薦美食、查詢交通\n• 解決旅途中的疑難雜症\n• 🩺 **行程健檢**：跟我說「幫我看這行程順不順？」\n\n有什麼我可以幫忙的嗎？😎"
        })
    ])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [selectedImage, setSelectedImage] = useState<string | null>(null)
    // 🆕 v3.5: 保存失敗的訊息用於重試
    const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)
    // 🆕 v3.6: 記憶摘要永動機
    const [memorySummary, setMemorySummary] = useState<string | null>(null)
    const [isSummarizing, setIsSummarizing] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    // 🆕 v3.5: AbortController for stopping generation
    const abortControllerRef = useRef<AbortController | null>(null)

    // Draggable state
    const [position, setPosition] = useState<Position>({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const dragRef = useRef<HTMLDivElement>(null)
    const dragOffset = useRef<Position>({ x: 0, y: 0 })

    // Load saved position
    useEffect(() => {
        const saved = localStorage.getItem("chat_widget_position")
        if (saved) {
            try {
                const pos = JSON.parse(saved)
                setPosition(pos)
            } catch (e) { }
        }
    }, [])

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, isOpen])

    // Handle drag start
    const handleDragStart = useCallback((clientX: number, clientY: number) => {
        if (!dragRef.current) return
        const rect = dragRef.current.getBoundingClientRect()
        dragOffset.current = {
            x: clientX - rect.left,
            y: clientY - rect.top
        }
        setIsDragging(true)
    }, [])

    // Handle drag move - constrain to screen edges (bottom-right corner only, slide along edges)
    const handleDragMove = useCallback((clientX: number, clientY: number) => {
        if (!isDragging) return

        const buttonSize = 56
        const margin = 16 // margin from edge
        const minY = 80 // minimum distance from bottom (above bottom nav)
        const maxY = window.innerHeight - buttonSize - margin // maximum Y (near top of screen)

        // Calculate position from bottom-right
        const newY = window.innerHeight - clientY - (buttonSize - dragOffset.current.y)

        // Clamp Y to valid range (slide vertically along right edge)
        const clampedY = Math.max(minY, Math.min(newY, maxY))

        setPosition({ x: margin, y: clampedY })
    }, [isDragging])

    // Handle drag end - snap to edge
    const handleDragEnd = useCallback(() => {
        if (isDragging) {
            setIsDragging(false)
            // Snap to right edge
            const snappedPosition = { x: 16, y: position.y }
            setPosition(snappedPosition)
            localStorage.setItem("chat_widget_position", JSON.stringify(snappedPosition))
        }
    }, [isDragging, position.y])

    // Mouse events
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault()
        handleDragStart(e.clientX, e.clientY)
    }

    // Touch events
    const handleTouchStart = (e: React.TouchEvent) => {
        e.preventDefault() // Prevent page scroll
        const touch = e.touches[0]
        handleDragStart(touch.clientX, touch.clientY)
    }

    // Global event listeners
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY)
        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length > 0) {
                e.preventDefault() // Prevent page scroll during drag
                handleDragMove(e.touches[0].clientX, e.touches[0].clientY)
            }
        }
        const handleEnd = () => handleDragEnd()

        if (isDragging) {
            document.addEventListener("mousemove", handleMouseMove)
            document.addEventListener("mouseup", handleEnd)
            document.addEventListener("touchmove", handleTouchMove, { passive: false })
            document.addEventListener("touchend", handleEnd)
            // Prevent body scroll while dragging
            document.body.style.overflow = "hidden"
        }

        return () => {
            document.removeEventListener("mousemove", handleMouseMove)
            document.removeEventListener("mouseup", handleEnd)
            document.removeEventListener("touchmove", handleTouchMove)
            document.removeEventListener("touchend", handleEnd)
            // Restore body scroll
            document.body.style.overflow = ""
        }
    }, [isDragging, handleDragMove, handleDragEnd])

    const handleSendMessage = async () => {
        if ((!input.trim() && !selectedImage) || isLoading) return

        // Check for API key
        const apiKey = localStorage.getItem("user_gemini_key") || localStorage.getItem("gemini_api_key") || ""
        if (!apiKey) {
            const errorMsg = "⚠️ 請先設定 AI API Key！\n\n前往 **Profile** 頁面 → 點擊 **AI API Key** 進行設定。\n\n💡 完全免費！"
            setMessages(prev => [
                ...prev,
                hydrateMessage({ role: "user", displayContent: input }),
                hydrateMessage({ role: "model", displayContent: errorMsg })
            ])
            setInput("")
            return
        }

        const userMsg = input
        const currentImage = selectedImage

        setInput("")
        setSelectedImage(null)

        // 🆕 建立使用者訊息 (新格式)
        const userMessage: Message = {
            role: "user",
            displayContent: userMsg + (currentImage ? " [圖片已上傳]" : ""),
            rawParts: [{ text: userMsg }]
        }

        setMessages(prev => [...prev, userMessage])
        setIsLoading(true)

        // 🆕 v3.5: 建立 AbortController
        abortControllerRef.current = new AbortController()

        // 🆕 v3.6: 記憶摘要永動機
        const PREHEAT_THRESHOLD = 20  // 預熱觸發點
        const MAX_HISTORY = 25        // 最大歷史條數
        const KEEP_RECENT = 10        // 保留最近 N 條

        // 預熱觸發摘要（背景執行，不阻塞）
        if (messages.length >= PREHEAT_THRESHOLD && messages.length < MAX_HISTORY && !memorySummary && !isSummarizing) {
            setIsSummarizing(true)
            toast.info("🧠 正在整理記憶...", { duration: 2000 })

            // 背景呼叫摘要 API
            const toSummarize = messages.slice(0, messages.length - KEEP_RECENT)
            fetch(`${API_BASE}/api/chat/summarize`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Gemini-API-Key": apiKey
                },
                body: JSON.stringify({
                    history: toSummarize.map(m => ({
                        role: m.role,
                        displayContent: m.displayContent
                    }))
                })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.summary) {
                        setMemorySummary(data.summary)
                        toast.success("🧠 記憶整理完成！")
                    }
                })
                .catch(err => console.error("摘要失敗:", err))
                .finally(() => setIsSummarizing(false))
        }

        // 準備 history
        let historySource = messages
        if (messages.length > MAX_HISTORY) {
            if (memorySummary) {
                // 有摘要：注入摘要 + 最近 N 條
                toast.success("🧠 使用記憶摘要繼續對話~")
                const recentMessages = messages.slice(-KEEP_RECENT)
                const summaryMessage = {
                    role: "model" as const,
                    rawParts: [{ text: `[對話記憶摘要] ${memorySummary}` }],
                    displayContent: `[對話記憶摘要] ${memorySummary}`
                }
                historySource = [summaryMessage, ...recentMessages]
            } else {
                // 無摘要：Fallback 到簡單截斷
                toast.info("💬 對話記錄已達上限，保留最近 25 條訊息~")
                historySource = messages.slice(-MAX_HISTORY)
            }
        }
        const history = historySource.map(m => ({
            role: m.role,
            rawParts: m.rawParts,
            displayContent: m.displayContent
        }))

        // 🆕 嘗試使用 Streaming API
        let streamingText = ""
        let streamingRawParts: Part[] = []
        let streamingSuccess = false

        // 如果有圖片，跳過 streaming (目前不支援)
        if (!currentImage && apiKey) {
            try {
                await streamChat(
                    API_BASE,
                    userMsg,
                    history,
                    apiKey,
                    {
                        onStart: () => {
                            console.log("🟢 SSE 連線建立")
                        },
                        onThinking: (status) => {
                            console.log("🧠 AI 思考中:", status)
                            // ThinkingIndicator 已經在 isLoading 時顯示
                        },
                        onText: (text) => {
                            streamingText += text
                            // 🆕 即時更新 UI (打字機效果)
                            setMessages(prev => {
                                const updated = [...prev]
                                const lastMsg = updated[updated.length - 1]
                                if (lastMsg?.role === "model" && lastMsg.modelUsed === "__streaming__") {
                                    lastMsg.displayContent = streamingText
                                } else {
                                    updated.push(hydrateMessage({
                                        role: "model",
                                        displayContent: streamingText,
                                        modelUsed: "__streaming__"
                                    }))
                                }
                                return updated
                            })
                        },
                        onDone: (data) => {
                            console.log("✅ SSE 完成:", data.model_used, "來源數:", data.sources?.length ?? 0)
                            streamingRawParts = data.raw_parts
                            streamingSuccess = true

                            // 更新最終訊息 (🆕 v3.7.1: 包含來源)
                            setMessages(prev => {
                                const updated = [...prev]
                                const lastMsg = updated[updated.length - 1]
                                if (lastMsg?.role === "model") {
                                    lastMsg.displayContent = streamingText
                                    lastMsg.rawParts = streamingRawParts
                                    lastMsg.modelUsed = data.model_used
                                    lastMsg.sources = data.sources ?? []  // 🆕 v3.7.1
                                }
                                return updated
                            })
                        },
                        onError: (error) => {
                            console.error("🔴 SSE 錯誤:", error)
                            // Fallback 會在下面處理
                        }
                    },
                    abortControllerRef.current?.signal,  // 🆕 傳入 AbortSignal
                    leanItinerary  // 🆕 行程上下文
                )
            } catch (streamError) {
                console.error("⚠️ Streaming 失敗，使用 fallback:", streamError)
            }
        }

        // 🔄 Fallback: 如果 streaming 失敗或有圖片，使用原有 API
        if (!streamingSuccess) {
            try {
                const res = await fetch(`${API_BASE}/api/chat`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Gemini-API-Key": apiKey
                    },
                    body: JSON.stringify({
                        message: userMsg,
                        history: history,
                        image: currentImage,
                        location: tripLocation,
                        // 🆕 注入精簡版行程上下文
                        current_itinerary: leanItinerary
                    })
                })

                const data = await res.json()

                if (!res.ok) throw new Error(data.detail || "Failed to send message")

                const aiMessage: Message = {
                    role: "model",
                    displayContent: data.response,
                    rawParts: data.raw_parts || [{ text: data.response }],
                    groundingSources: data.grounding_metadata?.sources,
                    modelUsed: data.model_used
                }

                setMessages(prev => [...prev, aiMessage])
            } catch (error) {
                console.error(error)
                // 🆕 v3.5: 保存失敗訊息供重試
                setLastFailedMessage(userMsg)
                setMessages(prev => [
                    ...prev,
                    hydrateMessage({ role: "model", displayContent: "🔥 連線中斷！點擊下方重試按鈕。" })
                ])
            }
        }

        // 🆕 清除失敗狀態（如果成功）
        if (streamingSuccess) {
            setLastFailedMessage(null)
        }

        setIsLoading(false)
    }

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setSelectedImage(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    return (
        <>
            {/* Chat Window - Fixed Center */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-sm h-[70vh] max-h-[500px] flex flex-col border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header - No longer draggable */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex justify-between items-center text-white">
                            <div className="flex items-center gap-2">
                                <div className="bg-white/20 p-1.5 rounded-full">
                                    <Bot className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm">Ryan AI Assistant</h3>
                                    <p className="text-[10px] text-blue-100 opacity-80">你的 AI 旅遊達人</p>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-full text-white/80 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 scroll-smooth">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={cn("flex gap-3 max-w-[85%]", msg.role === "user" ? "ml-auto flex-row-reverse" : "")}>
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
                                        msg.role === "model" ? "bg-indigo-100 text-indigo-600" : "bg-slate-200 text-slate-500"
                                    )}>
                                        {msg.role === "model" ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                                    </div>
                                    <div className={cn(
                                        "p-3 rounded-2xl text-sm shadow-sm",
                                        msg.role === "model" ? "bg-white text-slate-700 rounded-tl-none border border-slate-100" : "bg-blue-600 text-white rounded-tr-none"
                                    )}>
                                        {msg.role === "model" ? (
                                            <>
                                                {/* 🆕 POI 預覽卡片 (如果有 function_call) */}
                                                {(() => {
                                                    const poiData = extractFunctionCall(msg.rawParts)
                                                    if (poiData) {
                                                        return <POIPreviewCard poiData={poiData} />
                                                    }
                                                    return null
                                                })()}
                                                <div className="markdown-body prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-a:text-blue-600">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.displayContent}</ReactMarkdown>
                                                </div>
                                                {/* 來源標籤 */}
                                                {msg.groundingSources && msg.groundingSources.length > 0 && (
                                                    <SourceCitation sources={msg.groundingSources} />
                                                )}
                                                {/* 🆕 v3.7.1: 三源引用標籤 */}
                                                {msg.sources && msg.sources.length > 0 && (
                                                    <div className="mt-2 pt-2 border-t border-slate-100">
                                                        <p className="text-[10px] text-slate-400 mb-1">📚 資料來源</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {msg.sources.map((source, sidx) => (
                                                                <a
                                                                    key={sidx}
                                                                    href={source.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors truncate max-w-[150px]"
                                                                    title={source.url}
                                                                >
                                                                    {source.title}
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="whitespace-pre-wrap">{msg.displayContent}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex gap-3 max-w-[85%]">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-1">
                                        <Bot className="w-5 h-5" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {/* 🆕 脈衝手風琴 */}
                                        <ThinkingIndicator phase="thinking" />
                                        {/* 🆕 停止按鈕 */}
                                        <button
                                            onClick={() => {
                                                abortControllerRef.current?.abort()
                                                setIsLoading(false)
                                            }}
                                            className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                                        >
                                            <X className="w-3 h-3" /> 停止生成
                                        </button>
                                    </div>
                                </div>
                            )}
                            {/* 🆕 v3.5: 重試按鈕 */}
                            {lastFailedMessage && !isLoading && (
                                <div className="flex justify-center">
                                    <button
                                        onClick={() => {
                                            setInput(lastFailedMessage)
                                            setLastFailedMessage(null)
                                            // 移除最後一條錯誤訊息
                                            setMessages(prev => prev.slice(0, -1))
                                        }}
                                        className="text-sm bg-blue-50 text-blue-600 px-4 py-2 rounded-full hover:bg-blue-100 transition-colors flex items-center gap-2"
                                    >
                                        🔄 重新發送
                                    </button>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-white border-t border-slate-100">
                            {selectedImage && (
                                <div className="mb-2 relative inline-block">
                                    <img src={selectedImage} alt="Selected" className="h-16 w-auto rounded-lg border border-slate-200" />
                                    <button
                                        onClick={() => setSelectedImage(null)}
                                        className="absolute -top-2 -right-2 bg-slate-500 text-white rounded-full p-0.5 hover:bg-slate-600"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                            <div className="flex gap-2 items-end">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0 text-slate-400 hover:text-slate-600"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <ImageIcon className="w-5 h-5" />
                                </Button>
                                <Input
                                    placeholder="問問 Ryan..."
                                    className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault()
                                            handleSendMessage()
                                        }
                                    }}
                                />
                                <Button
                                    size="icon"
                                    className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                                    onClick={handleSendMessage}
                                    disabled={isLoading || (!input.trim() && !selectedImage)}
                                >
                                    <Send className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toggle Button - Edge Draggable */}
            <div
                ref={dragRef}
                className="fixed z-50"
                style={{
                    right: position.x,
                    bottom: position.y,
                    touchAction: isDragging ? "none" : "auto"
                }}
            >
                <Button
                    size="icon"
                    className={cn(
                        "h-14 w-14 rounded-full shadow-lg transition-all duration-300 hover:scale-105 touch-manipulation",
                        isOpen ? "bg-slate-200 text-slate-600 hover:bg-slate-300" : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white",
                        isDragging && "scale-110 shadow-2xl"
                    )}
                    onClick={() => !isDragging && setIsOpen(!isOpen)}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                >
                    {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-7 h-7" />}
                </Button>
            </div>
        </>
    )
}
