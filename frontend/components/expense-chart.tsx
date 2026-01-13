"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"

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
        const radius = 50 // Reduced to fit exploded segments
        const innerRadius = 30 // Thicker donut
        const center = 64 // Increased center for offset space
        const explodeOffset = 6 // Distance each segment moves outward

        const paths = data.map(item => {
            const percent = item.amount / total
            const angle = percent * 360
            const startAngle = currentAngle
            const endAngle = currentAngle + angle

            // Calculate mid-angle for explode direction
            const midAngle = (startAngle + endAngle) / 2
            const offsetX = Math.cos((midAngle - 90) * Math.PI / 180) * explodeOffset
            const offsetY = Math.sin((midAngle - 90) * Math.PI / 180) * explodeOffset

            const path = describeArc(center, center, innerRadius, radius, startAngle, endAngle)

            currentAngle = endAngle

            return {
                ...item,
                percent: Math.round(percent * 100),
                d: path,
                offsetX,
                offsetY
            }
        })

        // Determine what total to show in center
        const activeItem = data.find(d => d.category === activeCategory)
        const displayTotal = activeCategory && activeItem ? activeItem.amount : total

        return { paths, centerTotal: displayTotal }
    }, [data, total, activeCategory])

    if (total === 0 || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
                No expenses to display
            </div>
        )
    }

    return (
        <div className="flex gap-4 items-start">
            {/* SVG Exploded Donut Chart */}
            <div className="flex-shrink-0 relative w-32 h-32">
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
                                    scale: isActive ? 1.08 : 1,
                                    x: item.offsetX,
                                    y: item.offsetY
                                }}
                                whileHover={{ scale: 1.1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                onClick={() => onCategoryClick?.(isActive ? "" : item.category)}
                                className="cursor-pointer hover:drop-shadow-lg transition-shadow"
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
                            className="text-sm font-bold text-slate-800"
                        >
                            {formatAmount(centerTotal)}
                        </motion.div>
                        <div className="text-[9px] text-slate-400">
                            {activeCategory ? (CATEGORY_ICONS[activeCategory] || '類別') : "總支出"}
                        </div>
                    </div>
                </div>
            </div>

            {/* Legend / List */}
            <div className="flex-1 space-y-1.5">
                <div className="text-[10px] text-slate-400 font-medium flex justify-between items-center">
                    <span>📊 類別排行</span>
                    {activeCategory && (
                        <button
                            onClick={() => onCategoryClick?.("")}
                            className="text-xs text-blue-500 hover:underline"
                        >
                            清除篩選
                        </button>
                    )}
                </div>
                {paths.slice(0, 5).map((item, idx) => {
                    const isActive = activeCategory === item.category
                    const isDimmed = activeCategory && !isActive

                    return (
                        <div
                            key={idx}
                            className={`flex items-center gap-2 cursor-pointer p-1 rounded transition-colors ${isActive ? 'bg-slate-100 ring-1 ring-slate-200' : 'hover:bg-slate-50'}`}
                            style={{ opacity: isDimmed ? 0.5 : 1 }}
                            onClick={() => onCategoryClick?.(isActive ? "" : item.category)}
                        >
                            <div
                                className="w-2.5 h-2.5 rounded-sm shrink-0"
                                style={{ backgroundColor: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.general }}
                            />
                            <span className="text-[11px] text-slate-600 flex-1 flex items-center gap-1">
                                <span>{CATEGORY_ICONS[item.category] || '📦'}</span>
                                <span className={isActive ? 'font-bold' : ''}>{item.percent}%</span>
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                                {currencySymbol}{Math.round(item.amount).toLocaleString()}
                            </span>
                        </div>
                    )
                })}
                {paths.length > 5 && (
                    <div className="text-[10px] text-slate-400 text-center">+{paths.length - 5} more</div>
                )}
            </div>
        </div>
    )
}

export { CATEGORY_COLORS, CATEGORY_ICONS }
