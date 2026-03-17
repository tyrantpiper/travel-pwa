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
import { useLanguage } from "@/lib/LanguageContext"
import { encryptData, getSecureApiKey } from "@/lib/security"

interface ApiKeySettingsProps {
    onKeySaved: (key: string) => void;
    className?: string;
}

export function ApiKeySettings({ onKeySaved, className }: ApiKeySettingsProps) {
    const { t } = useLanguage()
    const [open, setOpen] = useState(false)
    const [key, setKey] = useState("")
    const [isDev, setIsDev] = useState(false)
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration safety
        setIsMounted(true)

        const secureKey = getSecureApiKey()
        if (secureKey) {
            setKey(secureKey)
            onKeySaved(secureKey)
            if (secureKey === process.env.NEXT_PUBLIC_DEV_GEMINI_KEY) {
                setIsDev(true)
            }
        }
    }, [onKeySaved])


    const handleSave = () => {
        if (!key.trim()) return
        localStorage.setItem("user_gemini_key", encryptData(key))
        onKeySaved(key)
        // 🆕 Real-time update event
        window.dispatchEvent(new CustomEvent('gemini-key-updated', { detail: key }))
        setOpen(false)
        toast.success(t('api_key_success'))
    }

    const handleClear = () => {
        setKey("")
        localStorage.removeItem("user_gemini_key")
        // 🆕 Real-time create event
        window.dispatchEvent(new CustomEvent('gemini-key-updated', { detail: '' }))
        toast.info(t('api_key_cleared'))
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
                        {t('api_key_settings')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('api_key_desc')}<br />
                        <span className="text-xs text-slate-400">{t('api_key_secure_note')}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    {/* 輸入區 */}
                    <div className="space-y-2">
                        <Label htmlFor="apiKey" className="text-xs font-bold text-slate-500 uppercase">{t('your_api_key')}</Label>
                        <div className="relative">
                            <Input
                                id="apiKey"
                                type="password"
                                value={key}
                                disabled={isDev}
                                onChange={(e) => setKey(e.target.value)}
                                placeholder={isDev ? t('api_key_dev_mode') : "AIzaSy**************************"}
                                className="font-mono text-sm pr-10"
                            />
                            {key && <CheckCircle2 className="w-4 h-4 text-green-500 absolute right-3 top-3" />}
                        </div>
                        {isDev && <p className="text-[10px] text-blue-500 font-medium">{t('api_key_dev_mode')}</p>}
                    </div>

                    {/* 📖 保姆級教學 (手風琴) */}
                    <Accordion type="single" collapsible className="w-full bg-slate-50 rounded-lg px-4 border border-slate-100">
                        <AccordionItem value="item-1" className="border-b-0">
                            <AccordionTrigger className="text-sm text-slate-600 hover:no-underline py-3">
                                {t('api_key_how_to')}
                            </AccordionTrigger>
                            <AccordionContent className="text-xs text-slate-500 space-y-3 pb-4">

                                {/* 步驟 1 */}
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">1</div>
                                    <div>
                                        {t('api_key_step1_1')} <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold inline-flex items-center">{t('api_key_step1_2')} <ExternalLink className="w-3 h-3 ml-0.5" /></a> {t('api_key_step1_3')}
                                    </div>
                                </div>

                                {/* 步驟 2 (修正版) */}
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">2</div>
                                    <div>
                                        {t('api_key_step2')}
                                    </div>
                                </div>

                                {/* 步驟 3 (修正版) */}
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">3</div>
                                    <div>
                                        {t('api_key_step3_1')} <code>AIza...</code> {t('api_key_step3_2')}
                                    </div>
                                </div>

                                <div className="bg-amber-50 text-amber-700 p-2 rounded border border-amber-100 flex items-start gap-2 mt-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{t('api_key_free_tier')}</span>
                                </div>

                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>

                <DialogFooter className="flex flex-row justify-between sm:justify-between gap-2">
                    <Button variant="outline" onClick={handleClear} className="text-slate-400 hover:text-red-500">
                        <Eraser className="w-4 h-4 mr-2" /> {t('clear')}
                    </Button>
                    <Button onClick={handleSave} className="bg-slate-900 text-white hover:bg-slate-800 flex-1 sm:flex-none">
                        <Key className="w-4 h-4 mr-2" /> {t('save_settings')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
