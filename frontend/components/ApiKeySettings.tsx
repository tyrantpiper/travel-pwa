"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import {
    Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import { Settings, Key, ExternalLink, CheckCircle2, AlertCircle, Eraser } from "lucide-react"
import { toast } from "sonner"

interface ApiKeySettingsProps {
    onKeySaved: (key: string) => void;
    className?: string;
}

export function ApiKeySettings({ onKeySaved, className }: ApiKeySettingsProps) {
    const [open, setOpen] = useState(false)
    const [key, setKey] = useState("")
    const [isDev, setIsDev] = useState(false)

    // 👇 新增：是否已掛載 (避免 SSR/Client hydration 不一致)
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true) // 代表現在是瀏覽器環境了

        // 1. 優先檢查開發者後門
        const devKey = process.env.NEXT_PUBLIC_DEV_GEMINI_KEY
        if (devKey) {
            console.log("🚀 Developer Mode: Key Auto-loaded")
            setKey(devKey)
            onKeySaved(devKey)
            setIsDev(true)
            return
        }

        // 2. 檢查瀏覽器庫存
        const storedKey = localStorage.getItem("user_gemini_key")
        if (storedKey) {
            setKey(storedKey)
            onKeySaved(storedKey)
        }
    }, [onKeySaved])

    const handleSave = () => {
        if (!key.trim()) return
        localStorage.setItem("user_gemini_key", key)
        onKeySaved(key)
        setOpen(false)
        toast.success("API Key 設定成功！")
    }

    const handleClear = () => {
        setKey("")
        localStorage.removeItem("user_gemini_key")
        toast.info("API Key 已清除")
    }

    // 👇 關鍵：如果還沒掛載 (還在伺服器)，就不要渲染任何東西，避免 ID 不一樣
    if (!isMounted) return null

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className={`fixed top-3 right-3 z-[60] bg-white/90 backdrop-blur-md shadow-lg border-slate-200 rounded-full hover:bg-slate-100 ${className}`}
                >
                    <Settings className="h-5 w-5 text-slate-600" />
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Key className="w-5 h-5 text-amber-500" />
                        API Key 設定
                    </DialogTitle>
                    <DialogDescription>
                        為了使用 AI 行程規劃，請輸入您的 Google Gemini API Key。<br />
                        <span className="text-xs text-slate-400">（本機儲存，這把鑰匙不會傳送給開發者，請安心使用）</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    {/* 輸入區 */}
                    <div className="space-y-2">
                        <Label htmlFor="apiKey" className="text-xs font-bold text-slate-500 uppercase">您的 API Key</Label>
                        <div className="relative">
                            <Input
                                id="apiKey"
                                type="password"
                                value={key}
                                disabled={isDev}
                                onChange={(e) => setKey(e.target.value)}
                                placeholder={isDev ? "Developer Mode Active" : "AIzaSy**************************"}
                                className="font-mono text-sm pr-10"
                            />
                            {key && <CheckCircle2 className="w-4 h-4 text-green-500 absolute right-3 top-3" />}
                        </div>
                        {isDev && <p className="text-[10px] text-blue-500 font-medium">✨ 開發者後門已啟用，無需手動輸入。</p>}
                    </div>

                    {/* 📖 保姆級教學 (手風琴) */}
                    <Accordion type="single" collapsible className="w-full bg-slate-50 rounded-lg px-4 border border-slate-100">
                        <AccordionItem value="item-1" className="border-b-0">
                            <AccordionTrigger className="text-sm text-slate-600 hover:no-underline py-3">
                                🤔 如何免費獲取 API Key？ (30秒完成)
                            </AccordionTrigger>
                            <AccordionContent className="text-xs text-slate-500 space-y-3 pb-4">

                                {/* 步驟 1 */}
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">1</div>
                                    <div>
                                        前往 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold inline-flex items-center">Google AI Studio <ExternalLink className="w-3 h-3 ml-0.5" /></a> 並登入 Google 帳號。
                                    </div>
                                </div>

                                {/* 步驟 2 (修正版) */}
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">2</div>
                                    <div>
                                        點擊頁面 <b>左側選單</b> 的 <span className="inline-block border border-slate-300 rounded px-1 text-[10px] font-bold mx-1">Get API key</span> 分頁。
                                    </div>
                                </div>

                                {/* 步驟 3 (修正版) */}
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">3</div>
                                    <div>
                                        點擊 <b>Create API key</b> 按鈕，選擇第一個選項 <b>"Create API key in new project"</b>，複製那串 <code>AIza...</code> 開頭的代碼並貼在上方。
                                    </div>
                                </div>

                                <div className="bg-amber-50 text-amber-700 p-2 rounded border border-amber-100 flex items-start gap-2 mt-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>這是完全免費的 (Free Tier)，每日可用 1,500 次，個人使用綽綽有餘。</span>
                                </div>

                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>

                <DialogFooter className="flex flex-row justify-between sm:justify-between gap-2">
                    <Button variant="outline" onClick={handleClear} className="text-slate-400 hover:text-red-500">
                        <Eraser className="w-4 h-4 mr-2" /> 清除
                    </Button>
                    <Button onClick={handleSave} className="bg-slate-900 text-white hover:bg-slate-800 flex-1 sm:flex-none">
                        <Key className="w-4 h-4 mr-2" /> 儲存設定
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
