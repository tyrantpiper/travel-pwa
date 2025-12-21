"use client"

import { cn } from "@/lib/utils"

interface ExpenseChartProps {
    data: { category: string; amount: number; color: string }[]
    total: number
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

export function ExpenseChart({ data, total }: ExpenseChartProps) {
    if (total === 0 || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
                No expenses to display
            </div>
        )
    }

    // Calculate percentages and build conic gradient
    let currentAngle = 0
    const segments: string[] = []
    const legends: { category: string; percent: number; amount: number; color: string }[] = []

    data.forEach(item => {
        const percent = (item.amount / total) * 100
        const startAngle = currentAngle
        const endAngle = currentAngle + (percent * 3.6) // 360 / 100 = 3.6

        const color = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.general
        segments.push(`${color} ${startAngle}deg ${endAngle}deg`)

        legends.push({
            category: item.category,
            percent: Math.round(percent),
            amount: item.amount,
            color
        })

        currentAngle = endAngle
    })

    const gradient = `conic-gradient(${segments.join(', ')})`

    return (
        <div className="space-y-4">
            {/* Pie Chart */}
            <div className="flex items-center justify-center">
                <div
                    className="w-32 h-32 rounded-full shadow-inner relative"
                    style={{ background: gradient }}
                >
                    <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <div className="text-center">
                            <div className="text-lg font-bold text-slate-800">{Math.round((total / 1000))}K</div>
                            <div className="text-[10px] text-slate-400">JPY</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-2">
                {legends.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                        <div
                            className="w-3 h-3 rounded-sm shrink-0"
                            style={{ backgroundColor: item.color }}
                        />
                        <span className="text-slate-600">
                            {CATEGORY_ICONS[item.category] || '📦'} {item.percent}%
                        </span>
                        <span className="text-slate-400 font-mono text-[10px] ml-auto">
                            ¥{item.amount.toLocaleString()}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export { CATEGORY_COLORS, CATEGORY_ICONS }
