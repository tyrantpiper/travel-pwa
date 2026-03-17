"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { MessageCircle, X, Send, Image as ImageIcon, Bot, User } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useTripContext } from "@/lib/trip-context"
import { useFocusedDay } from "@/lib/stores/tripStore"
import { useTripDetail } from "@/lib/hooks"
import { useDynamicPolling } from "@/lib/polling-manager"
import { getSecureApiKey } from "@/lib/security"
import { getLeanItinerary, LeanItinerary } from "@/lib/getLeanItinerary"
import SourceCitation from "@/components/chat/SourceCitation"
import ThinkingIndicator from "@/components/chat/ThinkingIndicator"
import POIPreviewCard, { extractFunctionCall } from "@/components/chat/POIPreviewCard"
import { streamChat } from "@/lib/sse-parser"
import { toast } from "sonner"
import { useWeatherStore } from "@/lib/stores/weatherStore"
import { debugLog } from "@/lib/debug"
import { useLanguage, type TranslationKey } from "@/lib/LanguageContext"
import { type ParsedItinerary, type ParsedItineraryItem } from "@/lib/itinerary-types"

// 🆕 Part 結構 (與 Gemini API 對應)
interface Part {
    text?: string
    function_call?: { name: string; args: Record<string, unknown> }
    thought?: string  // 思想簽名 (加密)
    _raw?: string
}

// 🆕 v22.1: JSON 防漏閥與行程偵測
function tryParseItinerary(text: string): ParsedItinerary | null {
    if (!text || !text.includes('{"')) return null
    try {
        // 嘗試提取 JSON (處理可能存在的 Markdown 標籤)
        const cleanJson = text.replace(/```json|```/g, "").trim()
        const data = JSON.parse(cleanJson)
        if (data.items && Array.isArray(data.items)) {
            return data as ParsedItinerary
        }
        // 處理嵌套在 data 裡的情況
        if (data.data && data.data.items) {
            return data.data as ParsedItinerary
        }
    } catch (error) {
        console.error("Failed to parse itinerary from chat content:", error)
        return null
    }
    return null
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

/** 🆕 Read device safe area bottom inset from CSS env() bridge */
function getSafeAreaBottom(): number {
    if (typeof window === 'undefined') return 0
    const val = getComputedStyle(document.documentElement).getPropertyValue('--sab').trim()
    return parseInt(val, 10) || 0
}

export default function ChatWidget() {
    const { t } = useLanguage()
    // 🔒 登錄狀態檢查 - 未登錄時不顯示聊天氣泡
    const [isLoggedIn, setIsLoggedIn] = useState(false)

    useEffect(() => {
        // 初始檢查
        const checkLogin = () => {
            const userId = localStorage.getItem("user_uuid")
            const userName = localStorage.getItem("user_nickname")
            setIsLoggedIn(!!(userId && userName))
        }
        checkLogin()

        // 監聽 storage 變化 (跨 tab 同步)
        window.addEventListener('storage', checkLogin)
        // 🆕 監聯同 tab 登入狀態變化
        window.addEventListener('user-login-state-changed', checkLogin)
        return () => {
            window.removeEventListener('storage', checkLogin)
            window.removeEventListener('user-login-state-changed', checkLogin)
        }
    }, [])

    // 🔒 登錄狀態 - 在 JSX 中使用此變數決定是否渲染

    // ✅ 直接使用 TripContext（現在 ChatWidget 在 TripProvider 內）
    const { activeTrip, activeTripId, userId: contextUserId } = useTripContext()

    // 🆕 取得行程詳細資料 (包含 items)
    // 🔧 FIX: 傳入 contextUserId 確保 SWR 鍵值完整
    // 🔧 FIX 2: 加入 useDynamicPolling 的 refreshInterval，對齊 ItineraryView 的 SWR Key 實現快取共用
    const refreshInterval = useDynamicPolling()
    const { trip: tripDetail } = useTripDetail(activeTripId, contextUserId, refreshInterval)
    const weatherStore = useWeatherStore()

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

    const focusedDay = useFocusedDay()
    // 🆕 產生精簡版行程供 AI 使用 (含 day_notes/costs/checklists/tickets)
    const leanItinerary: LeanItinerary | null = useMemo(() => {
        if (!activeTrip || !tripDetail) return null // 🔧 FIX: Don't check for .items yet

        // 🔧 2026 FIX: Flatten API 'days' structure to 'items' & map keys
        let items = tripDetail.items
        if (!items && tripDetail.days && Array.isArray(tripDetail.days)) {
            items = (tripDetail.days as Array<{ day: number; activities: Array<Record<string, unknown> & { time: string; place: string }> }>).flatMap((d) =>
                d.activities.map((act) => ({
                    ...act,
                    day_number: d.day,
                    time_slot: act.time,      // Map API 'time' to 'time_slot'
                    place_name: act.place     // Map API 'place' to 'place_name'
                }))
            )
        }

        // Return null ONLY if we truly have no items after flattening
        if (!items || items.length === 0) return null

        const lean = getLeanItinerary(
            activeTrip,
            items,
            tripDetail.day_notes,   // 🆕 每日注意事項
            tripDetail.day_costs,   // 🆕 每日預估花費
            tripDetail.day_checklists, // 🆕 2026 Checklist
            tripDetail.day_tickets,    // 🆕 2026 Tickets
            focusedDay               // 🆕 2026 Adaptive Focus
        )

        // 🔗 🆕 2026 Neural Connection: 注入天氣數據
        if (lean && tripLocation) {
            const today = new Date().toISOString().split('T')[0]
            const cached = weatherStore.getWeatherData(tripLocation.lat, tripLocation.lng, today)
            if (cached) {
                const isStale = Date.now() - cached.timestamp > 3 * 60 * 60 * 1000 // 3小時過期
                const avgTemp = cached.forecast.length > 0
                    ? Math.round(cached.forecast.reduce((a, b) => a + b.temp, 0) / cached.forecast.length)
                    : '--'

                lean.weather_context = `[2026 Neural Weather] 
- 當前位置: ${tripLocation.name}
- 預測均溫: ${avgTemp}°C
- 信心度: ${cached.confidenceScore ?? '--'}%
- WBGT 風險: ${(cached.confidenceScore ?? 100) < 50 ? '高 (預報不穩)' : '正常'}
${isStale ? '⚠️ 提醒：此數據已超過 3 小時，可能存在誤差。' : ''}`
            }
        }

        if (lean) {
            debugLog("🧠 Neural Connection Active: Itinerary context generated", {
                title: lean.title,
                days: lean.total_days,
                focused: lean.focused_day,
                hasWeather: !!lean.weather_context
            })
        }

        return lean
    }, [activeTrip, tripDetail, tripLocation, weatherStore, focusedDay])

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
            displayContent: "__GREETING__"
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

    // 🛡️ Cleanup AbortController on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort()
        }
    }, [])

    // ----------------------------------------------------------------------
    // 🆕 修復：當使用者切換不同行程時，強制清除上一個行程的對話記憶與摘要
    // ----------------------------------------------------------------------
    const prevTripIdRef = useRef(activeTripId)

    useEffect(() => {
        if (activeTripId && prevTripIdRef.current !== activeTripId) {
            // 🚨 關鍵補全：切斷前一個行程還在生成的 AI 回應
            abortControllerRef.current?.abort()
            setIsLoading(false)

            // 重置對話清單為初始的打招呼訊息
            setMessages([
                hydrateMessage({
                    role: "model",
                    displayContent: "__GREETING__"
                })
            ])

            // 清除長期的記憶摘要片段
            setMemorySummary(null)

            // 更新追蹤器
            prevTripIdRef.current = activeTripId

            // (選用) 切換時自動將可能開著的聊天氣泡關閉
            if (isOpen) {
                setIsOpen(false)
            }
        }
    }, [activeTripId, isOpen])

    // Draggable state
    const [position, setPosition] = useState<Position>({ x: 16, y: 100 })
    const [isDragging, setIsDragging] = useState(false)
    const dragRef = useRef<HTMLDivElement>(null)
    const dragOffset = useRef<Position>({ x: 0, y: 0 })

    // Load saved position + clamp to current viewport
    useEffect(() => {
        const saved = localStorage.getItem("chat_widget_position")
        if (saved) {
            try {
                const pos = JSON.parse(saved)
                // 🆕 Clamp to current viewport on load
                const buttonSize = 56
                const margin = 16
                const safeBottom = getSafeAreaBottom()
                const minY = 80 + safeBottom
                const maxY = window.innerHeight - buttonSize - margin
                pos.y = Math.max(minY, Math.min(pos.y, maxY))
                setPosition(pos)
            } catch { }
        }
    }, [])

    // 🆕 Re-clamp position on viewport resize / orientation change
    useEffect(() => {
        const reclamp = () => {
            setPosition(prev => {
                const buttonSize = 56
                const margin = 16
                const safeBottom = getSafeAreaBottom()
                const minY = 80 + safeBottom
                const maxY = window.innerHeight - buttonSize - margin
                const clampedY = Math.max(minY, Math.min(prev.y, maxY))
                if (clampedY !== prev.y) {
                    const newPos = { x: prev.x, y: clampedY }
                    localStorage.setItem("chat_widget_position", JSON.stringify(newPos))
                    return newPos
                }
                return prev
            })
        }

        window.addEventListener('resize', reclamp)
        window.addEventListener('orientationchange', reclamp)
        return () => {
            window.removeEventListener('resize', reclamp)
            window.removeEventListener('orientationchange', reclamp)
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
        const safeBottom = getSafeAreaBottom()
        const minY = 80 + safeBottom // 🆕 minimum distance includes safe area
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
        const apiKey = getSecureApiKey()
        if (!apiKey) {
            const errorMsg = t('ai_apikey_missing')
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
            displayContent: userMsg + (currentImage ? t('ai_image_uploaded') : ""),
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
            toast.info(t('ai_summarizing'), { duration: 2000 })

            const toSummarize = messages.slice(0, messages.length - KEEP_RECENT)
            const targetUserId = contextUserId || localStorage.getItem("user_uuid") || ""
            fetch(`${API_BASE}/api/chat/summarize`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Gemini-API-Key": apiKey,
                    "X-User-ID": targetUserId
                },
                body: JSON.stringify({
                    history: toSummarize.map((m: Message) => ({
                        role: m.role,
                        displayContent: m.displayContent
                    }))
                })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.summary) {
                        setMemorySummary(data.summary)
                        toast.success(t('ai_summarized'))
                    }
                })
                .catch(err => console.error(t('ai_summary_failed'), err))
                .finally(() => setIsSummarizing(false))
        }

        // 準備 history
        let historySource = messages
        if (messages.length > MAX_HISTORY) {
            if (memorySummary) {
                // 有摘要：注入摘要 + 最近 N 條
                toast.success(t('ai_using_memory'))
                const recentMessages = messages.slice(-KEEP_RECENT)
                const summaryMessage = {
                    role: "model" as const,
                    rawParts: [{ text: `[對話記憶摘要] ${memorySummary}` }],
                    displayContent: `[對話記憶摘要] ${memorySummary}`
                }
                historySource = [summaryMessage, ...recentMessages]
            } else {
                // 無摘要：Fallback 到簡單截斷
                toast.info(t('ai_history_limit'))
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
                            debugLog("🟢 SSE 連線建立")
                        },
                        onThinking: (status) => {
                            debugLog("🧠 AI 思考中:", status)
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
                            debugLog("✅ SSE 完成:", data.model_used, "來源數:", data.sources?.length ?? 0)
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
                            console.error("🔴 SSE 錯誤:", JSON.stringify(error, null, 2))
                            // 若已經接收到文字，則強迫終止 Fallback 並保留半殘對話
                            if (streamingText.trim().length > 0) {
                                streamingSuccess = true
                                streamingText += "\n\n[⚠️ 系統提示：連線異常，訊息中斷]"
                                setMessages(prev => {
                                    const updated = [...prev]
                                    const lastMsg = updated[updated.length - 1]
                                    if (lastMsg?.role === "model") {
                                        lastMsg.displayContent = streamingText
                                        lastMsg.rawParts = [{ text: streamingText }]
                                        lastMsg.modelUsed = "error_recovered"
                                    }
                                    return updated
                                })
                            }
                        }
                    },
                    abortControllerRef.current?.signal,  // 🆕 傳入 AbortSignal
                    leanItinerary,  // 🆕 行程上下文
                    focusedDay,   // 🆕 v3.8: 傳入當前焦點天數
                    contextUserId || localStorage.getItem("user_uuid") || ""
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
                        "X-Gemini-API-Key": apiKey,
                        "X-User-ID": contextUserId || localStorage.getItem("user_uuid") || ""
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
                    hydrateMessage({ role: "model", displayContent: t('ai_connection_error') })
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

    // 🔒 未登錄時不渲染任何內容
    if (!isLoggedIn) return null

    return (
        <>
            {/* Chat Window - Fixed Center */}
            {isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-sm h-[70vh] max-h-[500px] flex flex-col border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header - No longer draggable */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex justify-between items-center text-white">
                            <div className="flex items-center gap-2">
                                <div className="bg-white/20 p-1.5 rounded-full">
                                    <Bot className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm">Ryan AI Assistant</h3>
                                    <p className="text-[10px] text-blue-100 opacity-80">{t('ai_subtitle')}</p>
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
                                        msg.role === "model" ? "bg-white text-slate-700 rounded-tl-none border border-slate-200" : "bg-blue-600 text-white rounded-tr-none"
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
                                                    {(() => {
                                                        const itinerary = tryParseItinerary(msg.displayContent)
                                                        if (itinerary) {
                                                            // 🛡️ JSON 防漏閥：將 JSON 轉為友善的 Markdown
                                                            const summary = `### ✨ ${itinerary.title || t('ai_itinerary_found' as TranslationKey)}\n` +
                                                                itinerary.items.slice(0, 5).map((it: ParsedItineraryItem) => `- Day ${it.day_number}: ${it.place_name} (${it.time_slot || ''})`).join('\n') +
                                                                (itinerary.items.length > 5 ? `\n... (還有 ${itinerary.items.length - 5} 個地點)` : '')
                                                            return <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
                                                        }
                                                        return <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.displayContent === "__GREETING__" ? t('ai_greet_msg') : msg.displayContent}</ReactMarkdown>
                                                    })()}
                                                </div>

                                                {/* 🆕 v22.1: 一鍵匯入橋樑 */}
                                                {(tryParseItinerary(msg.displayContent) || msg.displayContent.includes('| Day |') || msg.displayContent.includes('## Day 1')) && (
                                                    <div className="mt-3">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="w-full h-9 rounded-xl border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300 font-bold gap-2 shadow-sm transition-all active:scale-95"
                                                            onClick={async () => {
                                                                // 將內容傳遞給 ToolsView (透過事件)
                                                                const event = new CustomEvent('ai-import-itinerary', {
                                                                    detail: { content: msg.displayContent }
                                                                })
                                                                window.dispatchEvent(event)
                                                                toast.success(t('ai_sending_to_import' as TranslationKey))
                                                                // 自動開啟 ToolsView (假設有導航邏輯)
                                                                const navEvent = new CustomEvent('navigate-to-tools')
                                                                window.dispatchEvent(navEvent)
                                                            }}
                                                        >
                                                            ✨ {t('ai_one_click_import' as TranslationKey) || "立即匯入行程"}
                                                        </Button>
                                                    </div>
                                                )}

                                                {/* 來源標籤 */}
                                                {msg.groundingSources && msg.groundingSources.length > 0 && (
                                                    <SourceCitation sources={msg.groundingSources} />
                                                )}
                                                {/* 🆕 v3.7.1: 三源引用標籤 */}
                                                {msg.sources && msg.sources.length > 0 && (
                                                    <div className="mt-2 pt-2 border-t border-slate-200">
                                                        <p className="text-[10px] text-slate-400 mb-1">📚 {t('ai_sources')}</p>
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
                                            <X className="w-3 h-3" /> {t('ai_stop')}
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
                                        🔄 {t('ai_retry')}
                                    </button>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-white border-t border-slate-200">
                            {selectedImage && (
                                <div className="mb-2 relative inline-block">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
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
                                    placeholder={t('ai_ask_placeholder')}
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
                className="fixed z-[110]"
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
