"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { Check, ChevronsUpDown, Map, Edit3, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useTripContext } from "@/lib/trip-context"
import { useLanguage } from "@/lib/LanguageContext"
import { toast } from "sonner"
import { tripsApi } from "@/lib/api"
import { preload } from "swr"
import { fetcherWithUserId } from "@/lib/hooks"



export function TripSwitcher({
    className,
    pencilPosition = "right"
}: {
    className?: string,
    pencilPosition?: "left" | "right"
}) {
    const { t } = useLanguage()
    const { trips, activeTripId, setActiveTripId, mutate, userId, isTransitioning } = useTripContext()
    const activeTrip = trips.find((t) => t.id === activeTripId)

    // 狀態管理
    const [isEditing, setIsEditing] = useState(false)
    const [newTitle, setNewTitle] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [isHovered, setIsHovered] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // 自動聚焦
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    const startEdit = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!activeTrip) return
        setNewTitle(activeTrip.title || "")
        setIsEditing(true)
    }

    const handleSave = async () => {
        if (!newTitle.trim() || !activeTripId) {
            toast.warning(t('ts_title_required'))
            return
        }
        if (newTitle.trim() === activeTrip?.title) {
            setIsEditing(false)
            return
        }

        setIsSaving(true)
        try {
            // 🔒 Standardized: Use tripsApi.updateTitle to include userId/Auth header
            await tripsApi.updateTitle(activeTripId, newTitle.trim(), userId || "")

            mutate()
            toast.success(t('ts_title_updated'))
            setIsEditing(false)
        } catch (e) {
            console.error("Update title error:", e)
            toast.error(t('update_failed'))
        } finally {
            setIsSaving(false)
        }
    }

    const handleCancel = () => {
        setIsEditing(false)
        setNewTitle("")
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            handleSave()
        } else if (e.key === "Escape") {
            handleCancel()
        }
    }

    const pencilButton = activeTrip && !isEditing && (
        <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={startEdit}
            className="p-1.5 rounded-full text-slate-400/50 hover:text-amber-600 hover:bg-amber-50/50 transition-colors"
            title={t('ts_edit_title')}
        >
            <Edit3 className="w-3.5 h-3.5" />
        </motion.button>
    )

    return (
        <div className="flex items-center gap-2 flex-wrap max-w-full relative group/switcher">
            {pencilPosition === "left" && pencilButton}

            <AnimatePresence mode="wait">
                {isEditing ? (
                    <motion.div
                        key="editing"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50/30 backdrop-blur-md shadow-sm",
                            className
                        )}
                    >
                        <Input
                            ref={inputRef}
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={() => {
                                setTimeout(() => { if (!isSaving) handleCancel() }, 150)
                            }}
                            className="h-7 text-inherit font-inherit border-none focus:ring-0 bg-transparent p-0 selection:bg-amber-100 min-w-[120px]"
                            placeholder={t('ts_title_placeholder')}
                            disabled={isSaving}
                        />
                        <div className="flex gap-1 shrink-0 ml-2 border-l pl-2 border-amber-200">
                            <button onClick={handleSave} className="text-emerald-600 hover:scale-110 active:scale-95 transition-transform p-1"><Check className="w-4 h-4" /></button>
                            <button onClick={handleCancel} className="text-slate-400 hover:scale-110 active:scale-95 transition-transform p-1"><X className="w-4 h-4" /></button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="switcher"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1"
                    >
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-label="Select a trip"
                                    className={cn(
                                        "relative overflow-hidden transition-all duration-300 w-full",
                                        "justify-between rounded-xl",
                                        "bg-white/40 dark:bg-slate-900/40 backdrop-blur-md",
                                        "border border-white/40 dark:border-slate-800/40 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.05)]",
                                        "hover:bg-white/60 dark:hover:bg-slate-900/60 hover:shadow-md",
                                        "h-auto py-2",
                                        className
                                    )}
                                >
                                    <div className="flex items-center gap-2 min-w-0 pr-2 w-full">
                                        {/* 🏮 Zen Seal: 狀態指示器 */}
                                        <div className="relative flex items-center justify-center shrink-0">
                                            <Map className={cn(
                                                "h-4 w-4 transition-colors duration-500",
                                                isTransitioning ? "text-amber-500" : "text-slate-900/30 dark:text-white/30"
                                            )} />
                                            {isTransitioning && (
                                                <motion.div
                                                    layoutId="seal-pulse"
                                                    className="absolute inset-0 bg-amber-400/20 rounded-full"
                                                    animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
                                                    transition={{ duration: 1.5, repeat: Infinity }}
                                                />
                                            )}
                                        </div>
                                        <span className="truncate tracking-tight font-serif drop-shadow-sm">
                                            {activeTrip?.title || t('ts_select_trip')}
                                        </span>
                                    </div>
                                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-20" />

                                    {/* 🌊 Ink Flow: React 19 並發進度條 */}
                                    <AnimatePresence>
                                        {isTransitioning && (
                                            <motion.div
                                                initial={{ width: 0, opacity: 0 }}
                                                animate={{ width: "100%", opacity: 1 }}
                                                exit={{ opacity: 0, transition: { duration: 0.5 } }}
                                                className="absolute bottom-0 left-0 h-[1.5px] bg-gradient-to-r from-transparent via-slate-900/50 to-transparent dark:via-white/50"
                                                transition={{ duration: 1.2, ease: "easeInOut" }}
                                            />
                                        )}
                                    </AnimatePresence>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-[240px] p-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-white/20 dark:border-slate-800/20 shadow-2xl rounded-2xl overflow-hidden">
                                <DropdownMenuLabel className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] px-3 py-2 opacity-50">
                                    {t('my_trips') || "My Journeys"}
                                </DropdownMenuLabel>
                                <div className="space-y-0.5">
                                    {trips.map((trip) => (
                                        <DropdownMenuItem
                                            key={trip.id}
                                            onSelect={() => setActiveTripId(trip.id)}
                                            onMouseEnter={() => {
                                                setIsHovered(trip.id)
                                                if (userId) preload([`/api/trips/${trip.id}`, userId], fetcherWithUserId)
                                            }}
                                            onMouseLeave={() => setIsHovered(null)}
                                            className={cn(
                                                "relative text-sm py-2.5 px-3 rounded-xl cursor-pointer transition-all duration-300",
                                                "focus:bg-slate-900/5 dark:focus:bg-white/5",
                                                activeTripId === trip.id ? "bg-slate-900/5 dark:bg-white/5 font-bold" : ""
                                            )}
                                        >
                                            <div className="flex items-center gap-2 w-full">
                                                <div className="relative">
                                                    <div className={cn(
                                                        "w-1.5 h-1.5 rounded-full transition-all duration-500",
                                                        activeTripId === trip.id ? "bg-slate-900 dark:bg-white scale-110 shadow-sm" : "bg-slate-300 dark:bg-slate-700"
                                                    )} />
                                                    {isHovered === trip.id && (
                                                        <motion.div
                                                            layoutId="hover-dot"
                                                            className="absolute inset-0 bg-amber-400/40 rounded-full scale-[2.5] blur-[2px] -z-10"
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                        />
                                                    )}
                                                </div>
                                                <span className="truncate flex-1">{trip.title}</span>
                                                {activeTripId === trip.id && <Check className="w-3 h-3 text-slate-400" />}
                                            </div>
                                        </DropdownMenuItem>
                                    ))}
                                </div>
                                {trips.length === 0 && (
                                    <div className="p-8 text-[10px] text-slate-400 text-center font-bold uppercase tracking-widest opacity-30">
                                        Empty Path
                                    </div>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </motion.div>
                )}
            </AnimatePresence>

            {pencilPosition === "right" && pencilButton}
        </div>
    )
}
