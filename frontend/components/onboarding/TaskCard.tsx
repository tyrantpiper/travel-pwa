"use client"

/**
 * TaskCard - Gamified Onboarding Task Tracker
 * 
 * 🆕 2026 Best Practice:
 * - Derived state from actual data (not manual tracking)
 * - Collapsible to avoid annoying returning users
 * - Click-to-navigate for each task
 */
import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    CheckCircle, Circle, ChevronDown, ChevronUp,
    Sparkles, Calendar, DollarSign, User, PartyPopper
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTripContext } from "@/lib/trip-context"
import { useLanguage } from "@/lib/LanguageContext"
import { getSecureApiKey } from "@/lib/security"

interface Task {
    id: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    completed: boolean
    action?: () => void
}

interface TaskCardProps {
    onNavigateToApiKey?: () => void
    className?: string
}

export function TaskCard({ onNavigateToApiKey, className }: TaskCardProps) {
    const { t } = useLanguage()
    const [isExpanded, setIsExpanded] = useState(true)
    const [showCelebration, setShowCelebration] = useState(false)
    const { trips } = useTripContext()

    // 🆕 Derived state - calculate from actual data
    const tasks = useMemo((): Task[] => {
        const hasNickname = typeof window !== 'undefined' && !!localStorage.getItem("user_nickname")
        const hasTrip = trips && trips.length > 0
        const hasApiKey = !!getSecureApiKey()

        return [
            {
                id: "nickname",
                label: t('tc_set_nickname'),
                icon: User,
                completed: hasNickname,
            },
            {
                id: "trip",
                label: t('tc_create_trip'),
                icon: Calendar,
                completed: hasTrip,
            },
            {
                id: "apikey",
                label: t('tc_setup_ai'),
                icon: Sparkles,
                completed: hasApiKey,
                action: onNavigateToApiKey,
            },
            {
                id: "expense",
                label: t('tc_add_expense'),
                icon: DollarSign,
                // 🔧 TODO: Add expense check when expense API is available
                completed: false,
            },
        ]
    }, [trips, onNavigateToApiKey, t])

    const completedCount = tasks.filter(t => t.completed).length
    const progress = (completedCount / tasks.length) * 100
    const allCompleted = completedCount === tasks.length

    // 🎉 Celebration effect when all tasks complete
    // 🔧 FIX: Use microtask delay to avoid React Compiler warning
    useEffect(() => {
        if (allCompleted) {
            // Use microtask to avoid synchronous setState warning
            queueMicrotask(() => setShowCelebration(true))
            const timer = setTimeout(() => setShowCelebration(false), 3000)
            return () => clearTimeout(timer)
        }
    }, [allCompleted])

    // Auto-collapse after all tasks done (after celebration)
    useEffect(() => {
        if (allCompleted) {
            const timer = setTimeout(() => setIsExpanded(false), 4000)
            return () => clearTimeout(timer)
        }
    }, [allCompleted])

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "rounded-xl border overflow-hidden transition-all duration-300",
                allCompleted
                    ? "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200"
                    : "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200",
                className
            )}
        >
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-white/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="text-lg">🎯</span>
                    <span className="font-bold text-slate-700">{t('tc_title')}</span>
                    {allCompleted && (
                        <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="text-xs px-2 py-0.5 bg-emerald-500 text-white rounded-full"
                        >
                            {t('tc_done')}
                        </motion.span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-500">
                        {completedCount}/{tasks.length}
                    </span>
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                </div>
            </button>

            {/* Progress Bar */}
            <div className="px-4 pb-2">
                <div className="h-2 bg-white/50 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className={cn(
                            "h-full rounded-full",
                            allCompleted
                                ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                                : "bg-gradient-to-r from-blue-400 to-indigo-500"
                        )}
                    />
                </div>
            </div>

            {/* Task List */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 space-y-2">
                            {tasks.map((task) => (
                                <div
                                    key={task.id}
                                    onClick={task.action}
                                    className={cn(
                                        "flex items-center gap-3 p-2.5 rounded-lg transition-all",
                                        task.completed
                                            ? "bg-white/30 text-slate-400"
                                            : "bg-white/60 text-slate-700",
                                        task.action && !task.completed && "cursor-pointer hover:bg-white/80"
                                    )}
                                >
                                    {task.completed ? (
                                        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                                    ) : (
                                        <Circle className="w-5 h-5 text-slate-300 shrink-0" />
                                    )}
                                    <task.icon className={cn(
                                        "w-4 h-4 shrink-0",
                                        task.completed ? "text-slate-400" : "text-blue-500"
                                    )} />
                                    <span className={cn(
                                        "text-sm",
                                        task.completed && "line-through"
                                    )}>
                                        {task.label}
                                    </span>
                                    {task.action && !task.completed && (
                                        <span className="ml-auto text-xs text-blue-500 font-medium">
                                            {t('tc_go_setup')}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 🎉 Celebration Overlay */}
            <AnimatePresence>
                {showCelebration && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="text-center"
                        >
                            <PartyPopper className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                            <p className="font-bold text-lg text-slate-700">{t('tc_congrats')}</p>
                            <p className="text-sm text-slate-500">{t('tc_all_done')}</p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
