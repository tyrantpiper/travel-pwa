"use client"

import { useState, useEffect, useRef } from "react"
import { Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/LanguageContext"
import { aiApi } from "@/lib/api"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface Expense {
    id: string
    title: string
    amount: number
    exchange_rate?: number
    currency?: string
    payer_id?: string | null
    notes?: string
}

interface TripMember {
    user_id: string
    user_name: string
    user_avatar?: string | null
}

interface ActuaryDialogCardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    expenses: Expense[]
    members: TripMember[]
}

type Message = { role: "user" | "model"; content: string }

export function ActuaryDialogCard({ open, onOpenChange, expenses, members }: ActuaryDialogCardProps) {
    const { t } = useLanguage()
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [isThinking, setIsThinking] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    // 自動捲動到底部
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }, [messages, isThinking])

    // 如果打開且沒有紀錄，發文自動觸發第一次精算
    // 為了避免重複觸發，使用 ref 紀錄是否已發送過初始歡迎詞
    const hasInitialized = useRef(false)

    useEffect(() => {
        if (open && messages.length === 0 && !hasInitialized.current) {
            hasInitialized.current = true
            handleSendMessage(t('actuary_welcome') || "請開始分析這趟旅行的公帳")
        }
        if (!open) {
            hasInitialized.current = false // reset on close
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, messages.length, t])

    const handleSendMessage = async (msgContent: string) => {
        if (!msgContent.trim()) return

        // 加入用戶訊息
        const newHistory = [...messages, { role: "user" as const, content: msgContent }]
        setMessages(newHistory)
        setInput("")
        setIsThinking(true)

        try {
            // 組裝 Payload：包含 TWD 預鑄，以配合精算師
            const enrichedExpenses = expenses.map(e => ({
                id: e.id,
                title: e.title,
                amount_twd: Math.round(e.amount * (e.exchange_rate || 1)),
                payer_name: members.find(m => m.user_id === e.payer_id)?.user_name || "Unknown",
                notes: e.notes || ""
            }))

            const memberContext = members.map(m => ({
                uid: m.user_id,
                name: m.user_name
            }))

            const response = await aiApi.actuaryChat(
                enrichedExpenses,
                memberContext,
                msgContent,
                messages // 前送的歷史記錄
            )

            if (response.status === "success" && response.response) {
                setMessages(prev => [...prev, { role: "model" as const, content: response.response }])
            } else {
                setMessages(prev => [...prev, { role: "model" as const, content: "⚠️ " + (response.response || "API 回傳異常，請重試。") }])
            }
        } catch (error) {
            console.error("Actuary Failed:", error)
            setMessages(prev => [...prev, { role: "model" as const, content: "⚠️ 伺服器連線異常，請檢查網路。小提醒：若是開發環境，請確認後端已啟動。" }])
        } finally {
            setIsThinking(false)
        }
    }

    // 處理手動發送
    const onSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        handleSendMessage(input)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            onSubmit()
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] h-[85vh] sm:h-[80vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-50 dark:bg-slate-950">

                {/* 標頭 */}
                <DialogHeader className="p-4 border-b bg-white dark:bg-slate-900 flex-shrink-0 flex flex-row items-center justify-between">
                    <div>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            🤖 {t('actuary_title') || "Travel Actuary"}
                        </DialogTitle>
                        <DialogDescription className="text-xs mt-1">
                            {members.length} members · {expenses.length} public records
                        </DialogDescription>
                    </div>
                </DialogHeader>

                {/* 對話區 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={cn(
                            "flex w-full",
                            msg.role === "user" ? "justify-end" : "justify-start"
                        )}>
                            <div className={cn(
                                "max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                                msg.role === "user"
                                    ? "bg-slate-800 text-white rounded-tr-sm"
                                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-tl-sm text-slate-800 dark:text-slate-200 prose prose-sm dark:prose-invert"
                            )}>
                                {msg.role === "user" ? (
                                    <span className="whitespace-pre-wrap">{msg.content}</span>
                                ) : (
                                    <div className="break-words w-full">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {isThinking && (
                        <div className="flex justify-start w-full">
                            <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-3 bg-white dark:bg-slate-900 border shadow-sm flex items-center gap-2 text-slate-500 text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>{t('actuary_thinking') || "Calculating..."}</span>
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} className="h-4" />
                </div>

                {/* 底部輸入 */}
                <div className="p-3 bg-white dark:bg-slate-900 border-t shrink-0">
                    <form onSubmit={onSubmit} className="flex items-center gap-2">
                        <Input
                            placeholder={t('actuary_placeholder') || "Ask me anything..."}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isThinking}
                            className="bg-slate-50 dark:bg-slate-800 border-0 focus-visible:ring-1 focus-visible:ring-slate-300"
                        />
                        <Button
                            type="button"
                            size="icon"
                            disabled={!input.trim() || isThinking}
                            onClick={() => onSubmit()}
                            className="bg-slate-800 hover:bg-slate-700 text-white shrink-0 rounded-xl"
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </form>
                </div>

            </DialogContent>
        </Dialog>
    )
}
