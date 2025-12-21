"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { MessageCircle, X, Send, Image as ImageIcon, Loader2, Bot, User, GripVertical } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface Message {
    role: "user" | "model"
    content: string
}

interface Position {
    x: number
    y: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export default function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([
        { role: "model", content: "👋哈囉！我是 Ryan，你的 AI 旅遊達人。\n我可以幫你翻譯、推薦美食、查詢交通，或者解決任何旅途中的疑難雜症！😎" }
    ])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [selectedImage, setSelectedImage] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

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

        // Check for API key (check both new and old key names for backward compatibility)
        const apiKey = localStorage.getItem("user_gemini_key") || localStorage.getItem("gemini_api_key") || ""
        if (!apiKey) {
            setMessages(prev => [
                ...prev,
                { role: "user", content: input },
                { role: "model", content: "⚠️ 請先設定 AI API Key！\n\n前往 **Profile** 頁面 → 點擊 **AI API Key** 進行設定。\n\n💡 完全免費！" }
            ])
            setInput("")
            return
        }

        const userMsg = input
        const currentImage = selectedImage

        setInput("")
        setSelectedImage(null)

        const newMessages: Message[] = [
            ...messages,
            { role: "user", content: userMsg + (currentImage ? " [圖片已上傳]" : "") }
        ]
        setMessages(newMessages)
        setIsLoading(true)

        try {
            const history = messages.map(m => ({ role: m.role, content: m.content }))

            const res = await fetch(`${API_BASE}/api/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Gemini-API-Key": apiKey
                },
                body: JSON.stringify({
                    message: userMsg,
                    history: history,
                    image: currentImage
                })
            })

            const data = await res.json()

            if (!res.ok) throw new Error(data.detail || "Failed to send message")

            setMessages(prev => [
                ...prev,
                { role: "model", content: data.response }
            ])
        } catch (error) {
            console.error(error)
            setMessages(prev => [
                ...prev,
                { role: "model", content: "🔥 抱歉，我好像當機了... 請稍後再試。" }
            ])
        } finally {
            setIsLoading(false)
        }
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
                                            <div className="markdown-body prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-a:text-blue-600">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                            </div>
                                        ) : (
                                            <div className="whitespace-pre-wrap">{msg.content}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex gap-3 max-w-[85%]">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-1">
                                        <Bot className="w-5 h-5" />
                                    </div>
                                    <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                        <span className="text-xs text-slate-400">正在思考中...</span>
                                    </div>
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
