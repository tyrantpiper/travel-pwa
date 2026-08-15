"use client"

import { useState, useEffect } from "react"
import {
    Key, Sparkles, ExternalLink, AlertCircle, Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import {
    Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import { useLanguage } from "@/lib/LanguageContext"
import { toast } from "sonner"
import { poiApi } from "@/lib/api"
import { encryptData, getSecureApiKey } from "@/lib/security"

interface AIKeyDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    trigger?: React.ReactNode
}

export function AIKeyDialog({ open, onOpenChange, trigger }: AIKeyDialogProps) {
    const { t, lang } = useLanguage()
    const zh = lang === 'zh'

    const [apiKey, setApiKey] = useState("")
    const [isTestingKey, setIsTestingKey] = useState(false)

    useEffect(() => {
        if (open) {
            const secureKey = getSecureApiKey()
            if (secureKey) {
                const devKey = process.env.NEXT_PUBLIC_DEV_GEMINI_KEY
                setApiKey(devKey === secureKey ? (zh ? "(開發者模式)" : "(Dev Mode)") : secureKey)
            } else {
                setApiKey("")
            }
        }
    }, [open, zh])

    const handleSaveApiKey = () => {
        const keyToSave = apiKey.trim()
        if (!keyToSave) return
        localStorage.setItem("user_gemini_key", encryptData(keyToSave))
        window.dispatchEvent(new Event("apiKeyUpdated"))
        onOpenChange(false)
        toast.success(t('profile_key_set') || (zh ? "API Key 已儲存" : "API Key saved"))
    }

    const handleClearApiKey = () => {
        setApiKey("")
        localStorage.removeItem("user_gemini_key")
        window.dispatchEvent(new Event("apiKeyUpdated"))
        toast.info(t('profile_key_cleared') || (zh ? "API Key 已清除" : "API Key cleared"))
    }

    const handleTestApiKey = async () => {
        const keyToTest = apiKey.trim()
        if (!keyToTest) {
            toast.error(zh ? "請先輸入 API Key" : "Please enter an API Key")
            return
        }
        setIsTestingKey(true)
        try {
            const res = await poiApi.testApiKey(keyToTest)
            if (res.status === "ok") {
                toast.success(t('profile_api_key_valid') || (zh ? "✅ API Key 驗證成功且已連線！" : "✅ API Key is valid and connected!"))
            } else {
                toast.error(res.message || t('profile_api_key_invalid'))
            }
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : t('profile_api_key_invalid')
            toast.error(errMsg)
        } finally {
            setIsTestingKey(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-112.5">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Key className="w-5 h-5 text-amber-500" />
                        {t('profile_api_key_settings')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('profile_api_key_desc')}<br />
                        <span className="text-xs text-slate-400">({t('profile_api_key_local_only')})</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="apiKeyInput" className="text-xs font-bold text-slate-500 uppercase">{t('profile_your_api_key')}</Label>
                        <Input
                            id="apiKeyInput"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="AIzaSy**************************"
                            className="font-mono text-sm"
                        />
                    </div>

                    <Accordion type="single" collapsible className="w-full bg-slate-50 dark:bg-slate-900/50 rounded-lg px-4 border border-slate-200 dark:border-slate-800">
                        <AccordionItem value="item-1" className="border-b-0">
                            <AccordionTrigger className="text-sm text-slate-600 dark:text-slate-300 hover:no-underline py-3">
                                🤔 {t('profile_how_to_get_api')}
                            </AccordionTrigger>
                            <AccordionContent className="text-xs text-slate-500 dark:text-slate-400 space-y-3 pb-4">
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-200 font-bold shrink-0">1</div>
                                    <div>
                                        {zh ? '前往' : 'Go to'} <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 underline font-bold inline-flex items-center">Google AI Studio <ExternalLink className="w-3 h-3 ml-0.5" /></a> {zh ? '並登入 Google 帳號。' : 'and sign in with Google.'}
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-200 font-bold shrink-0">2</div>
                                    <div>{zh ? '點擊左側選單的' : 'Click'} <b>Get API key</b>{zh ? '。' : ' in the left menu.'}</div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-200 font-bold shrink-0">3</div>
                                    <div>{zh ? '點擊' : 'Click'} <b>Create API key</b>{zh ? ' 建立新版授權金鑰 (Auth key)，複製' : ' to create an Auth key, copy the code starting with'} <code>AIza...</code> {zh ? '開頭的代碼。' : '.'}</div>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 p-2 rounded border border-amber-100 dark:border-amber-900/50 flex items-start gap-2 mt-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{t('profile_api_key_auth_notice')}</span>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>

                <DialogFooter className="flex flex-row justify-between sm:justify-between gap-2">
                    <Button variant="outline" onClick={handleClearApiKey} className="text-slate-400 hover:text-red-500">
                        {zh ? '清除' : 'Clear'}
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button 
                            type="button" 
                            variant="secondary" 
                            onClick={handleTestApiKey} 
                            disabled={isTestingKey || !apiKey.trim()}
                            className="border border-slate-200 hover:bg-slate-100 dark:border-slate-700"
                        >
                            {isTestingKey ? (
                                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> {t('profile_testing_api_key')}</>
                            ) : (
                                <><Sparkles className="w-4 h-4 mr-1.5 text-amber-500" /> {t('profile_test_api_key')}</>
                            )}
                        </Button>
                        <Button onClick={handleSaveApiKey} className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
                            <Key className="w-4 h-4 mr-2" /> {zh ? '儲存設定' : 'Save'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
