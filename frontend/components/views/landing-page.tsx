"use client"

import { useState, useEffect } from "react"
import { Compass, Sparkles, ArrowRight, ShieldCheck, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AppShell } from "@/components/views/app-shell"
import { ApiKeySettings } from "@/components/ApiKeySettings"
import { toast } from "sonner"

function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function LandingPage() {
    const [mounted, setMounted] = useState(false)
    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [nickname, setNickname] = useState("")
    const [showRecover, setShowRecover] = useState(false)
    const [recoverCode, setRecoverCode] = useState("")

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration: must set mounted after client render
        setMounted(true)

        const storedName = localStorage.getItem("user_nickname")
        const storedId = localStorage.getItem("user_uuid")
        if (storedName && storedId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- Initialization from localStorage on mount is intentional
            setNickname(storedName)
            setIsLoggedIn(true)
        }
    }, [])

    const handleLogin = () => {
        if (!nickname.trim()) { toast.warning("Please enter nickname"); return }
        let uuid = localStorage.getItem("user_uuid")
        if (!uuid) {
            uuid = generateUUID()
            localStorage.setItem("user_uuid", uuid)
        }
        localStorage.setItem("user_nickname", nickname)
        setIsLoggedIn(true)
    }

    const handleRecover = async () => {
        if (!recoverCode.trim()) { toast.warning("Please enter recovery code"); return }
        if (recoverCode.length < 10) { toast.error("Invalid code format"); return }

        // 🆕 Async fetch profile
        const toastId = toast.loading("Verifying identity...")
        try {
            // Default nickname fallback
            const fallbackName = nickname || "Returned Traveler"
            let fetchedName = fallbackName

            // Call API
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/users/${recoverCode}/profile`)
            if (response.ok) {
                const data = await response.json()
                if (data.nickname) fetchedName = data.nickname
            }

            localStorage.setItem("user_uuid", recoverCode)
            localStorage.setItem("user_nickname", fetchedName)

            toast.dismiss(toastId)
            toast.success(`Welcome back, ${fetchedName}!`)

            // Give UI a moment to show success before reload
            setTimeout(() => window.location.reload(), 1000)

        } catch (e) {
            console.error("Recovery Error", e)
            toast.dismiss(toastId)

            // Fallback anyway to allow recovery even if API fails
            localStorage.setItem("user_uuid", recoverCode)
            localStorage.setItem("user_nickname", nickname || "Returned Traveler")
            toast.success("Account recovered (Offline Mode)")
            setTimeout(() => window.location.reload(), 1000)
        }
    }

    if (!mounted) return null;

    if (isLoggedIn) return <AppShell />

    return (
        <div className="min-h-screen bg-stone-50 flex flex-col relative">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-20 -left-20 w-64 h-64 bg-amber-100 rounded-full blur-3xl opacity-50"></div>
                <div className="absolute top-40 -right-20 w-80 h-80 bg-blue-100 rounded-full blur-3xl opacity-50"></div>
            </div>

            <ApiKeySettings onKeySaved={() => { }} />

            <main className="flex-1 flex flex-col items-center justify-center px-8 py-12 z-10">
                <div className="mb-10 relative animate-bounce-slow">
                    <div className="w-24 h-24 rounded-[2rem] bg-slate-900 shadow-2xl flex items-center justify-center -rotate-6 ring-4 ring-white">
                        <Compass className="w-12 h-12 text-amber-400" strokeWidth={1.5} />
                    </div>
                    <div className="absolute -bottom-3 -right-3 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg animate-pulse">
                        <Sparkles className="w-5 h-5 text-slate-900" />
                    </div>
                </div>

                <h1 className="text-4xl font-serif font-bold text-slate-900 mb-2 tracking-tight">Tabidachi</h1>
                <p className="text-sm text-slate-500 mb-10 tracking-[0.3em] uppercase font-medium">Travel Planner</p>

                <div className="w-full max-w-xs space-y-6">

                    {!showRecover ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Your Nickname</label>
                                <Input
                                    placeholder="E.g. Ryan"
                                    className="h-14 bg-white border-stone-200 text-lg text-center rounded-2xl shadow-sm focus-visible:ring-slate-900"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    autoComplete="off"
                                />
                            </div>

                            <Button onClick={handleLogin} className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-200/50 transition-all hover:scale-[1.02] text-lg font-medium">
                                Start Journey <ArrowRight className="ml-2 w-5 h-5" />
                            </Button>

                            <div className="pt-6">
                                <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-stone-200" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-stone-50 px-2 text-stone-400">Or</span></div></div>
                                <Button variant="ghost" className="w-full mt-4 text-slate-500 hover:text-slate-800 hover:bg-stone-100" onClick={() => setShowRecover(true)}><History className="w-4 h-4 mr-2" /> Use Recovery Code</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white p-6 rounded-3xl shadow-lg border border-stone-100 animate-in zoom-in-95 duration-300">
                            <div className="text-center mb-4">
                                <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-2"><ShieldCheck className="w-5 h-5 text-indigo-600" /></div>
                                <h3 className="font-bold text-slate-800">Account Recovery</h3>
                                <p className="text-xs text-slate-500 mt-1">Enter your backup UUID</p>
                            </div>
                            <Input className="h-10 text-xs font-mono bg-stone-50 mb-4 text-center" placeholder="xxxxxxxx-xxxx-xxxx..." value={recoverCode} onChange={e => setRecoverCode(e.target.value)} />
                            <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setShowRecover(false)}>Cancel</Button><Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleRecover}>Recover</Button></div>
                        </div>
                    )}

                </div>
            </main>

            <footer className="py-6 text-center">
                <p className="text-[10px] text-slate-300 uppercase tracking-widest">Designed for JPN Travel</p>
            </footer>
        </div>
    )
}
