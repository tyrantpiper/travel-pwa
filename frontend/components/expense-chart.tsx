"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/LanguageContext"

interface ExpenseChartProps {
    data: { category: string; amount: number; color: string }[]
    total: number
    currencySymbol?: string
    activeCategory?: string | null
    onCategoryClick?: (category: string) => void
}

const CATEGORY_COLORS: Record<string, string> = {
    food: '#f97316',
    transport: '#14b8a6',
    shopping: '#ec4899',
    hotel: '#6366f1',
    ticket: '#a855f7',
    general: '#64748b'
}

const CATEGORY_ICONS: Record<string, string> = {
    food: '🍜',
    transport: '🚃',
    shopping: '🛍️',
    hotel: '🏨',
    ticket: '🎫',
    general: '📦'
}

// Math helper to create arc paths
function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0
    return {
        x: centerX + (radius * Math.cos(angleInRadians)),
        y: centerY + (radius * Math.sin(angleInRadians))
    }
}

function describeArc(x: number, y: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(x, y, outerRadius, endAngle)
    const end = polarToCartesian(x, y, outerRadius, startAngle)
    const start2 = polarToCartesian(x, y, innerRadius, endAngle)
    const end2 = polarToCartesian(x, y, innerRadius, startAngle)

    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1"

    const d = [
        "M", start.x, start.y,
        "A", outerRadius, outerRadius, 0, largeArcFlag, 0, end.x, end.y,
        "L", end2.x, end2.y,
        "A", innerRadius, innerRadius, 0, largeArcFlag, 1, start2.x, start2.y,
        "Z"
    ].join(" ")

    return d
}

export function ExpenseChart({ data, total, currencySymbol = "¥", activeCategory, onCategoryClick }: ExpenseChartProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const { t } = useLanguage()

    // 智慧格式化金額
    const formatAmount = (amount: number) => {
        const symbol = currencySymbol
        if (amount < 10000) {
            return `${symbol}${amount.toLocaleString()}`
        } else if (amount < 1000000) {
            return `${symbol}${Math.round(amount / 1000)}K`
        } else {
            return `${symbol}${(amount / 1000000).toFixed(1)}M`
        }
    }

    const { paths, centerTotal } = useMemo(() => {
        if (total === 0 || data.length === 0) return { paths: [], centerTotal: 0 }

        let currentAngle = 0
        const radius = 64 // w-32 = 128px / 2
        const innerRadius = 42 // Thicker donut
        const center = 64

        const paths = data.map(item => {
            const percent = item.amount / total
            const angle = percent * 360
            const path = describeArc(center, center, innerRadius, radius, currentAngle, currentAngle + angle)

            currentAngle += angle

            return {
                ...item,
                percent: Math.round(percent * 100),
                d: path
            }
        })

        // Determine what total to show in center
        const activeItem = data.find(d => d.category === activeCategory)
        const displayTotal = activeCategory && activeItem ? activeItem.amount : total

        return { paths, centerTotal: displayTotal }
    }, [data, total, activeCategory])

    if (total === 0 || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-40 text-slate-400 dark:text-slate-500 text-sm font-medium">
                No expenses to display
            </div>
        )
    }

    return (
        <div className="flex gap-5 items-center">
            {/* SVG Exploded Donut Chart */}
            <div className="flex-shrink-0 relative w-32 h-32 drop-shadow-sm">
                <svg width="128" height="128" viewBox="0 0 128 128" className="overflow-visible">
                    {paths.map((item) => {
                        const isActive = activeCategory === item.category
                        const isDimmed = activeCategory && !isActive

                        return (
                            <motion.path
                                key={item.category}
                                d={item.d}
                                fill={CATEGORY_COLORS[item.category] || CATEGORY_COLORS.general}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{
                                    opacity: isDimmed ? 0.3 : 1,
                                    scale: isActive ? 1.08 : 1
                                }}
                                whileHover={{ scale: 1.05, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                onClick={() => onCategoryClick?.(isActive ? "" : item.category)}
                                className="cursor-pointer hover:drop-shadow-md transition-shadow"
                                style={{ transformOrigin: "64px 64px" }}
                            />
                        )
                    })}
                </svg>

                {/* Center Label */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                        <motion.div
                            key={activeCategory || 'total'} // Trigger animation on switch
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-base font-bold text-slate-800 dark:text-slate-100"
                        >
                            {formatAmount(centerTotal)}
                        </motion.div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                            {activeCategory ? (CATEGORY_ICONS[activeCategory] || t('exp_category')) : t('exp_total_expense')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Legend / List */}
            <div className="flex-1 space-y-2">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex justify-between items-center px-1">
                    <span>📊 {t('exp_category_ranking')}</span>
                    {activeCategory && (
                        <button
                            onClick={() => onCategoryClick?.("")}
                            className="text-xs text-blue-500 dark:text-blue-400 hover:underline transition-colors"
                        >
                            {t('exp_clear_filter')}
                        </button>
                    )}
                </div>
                <div className="space-y-1.5">
                    {paths.slice(0, isExpanded ? paths.length : 5).map((item, idx) => {
                        const isActive = activeCategory === item.category
                        const isDimmed = activeCategory && !isActive

                        return (
                            <div
                                key={idx}
                                className={cn(
                                    "flex items-center gap-2.5 cursor-pointer p-1.5 rounded-md transition-all",
                                    isActive 
                                        ? "bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700" 
                                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                )}
                                style={{ opacity: isDimmed ? 0.4 : 1 }}
                                onClick={() => onCategoryClick?.(isActive ? "" : item.category)}
                            >
                                <div
                                    className="w-3 h-3 rounded-sm shrink-0 shadow-sm"
                                    style={{ backgroundColor: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.general }}
                                />
                                <span className="text-xs text-slate-700 dark:text-slate-300 flex-1 flex items-center gap-1.5">
                                    <span>{CATEGORY_ICONS[item.category] || '📦'}</span>
                                    <span className={isActive ? 'font-bold text-slate-900 dark:text-white' : ''}>{item.percent}%</span>
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-medium">
                                    {currencySymbol}{Math.round(item.amount).toLocaleString()}
                                </span>
                            </div>
                        )
                    })}
                </div>
                {paths.length > 5 && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-center pt-1 transition-colors"
                    >
                        {isExpanded ? t('exp_show_less') : t('exp_show_more', { n: paths.length - 5 })}
                    </button>
                )}
            </div>
        </div>
    )
}

export { CATEGORY_COLORS, CATEGORY_ICONS }
