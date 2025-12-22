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

    // 智慧格式化金額：< 10000 顯示完整，否則顯示 K
    const formatAmount = (amount: number) => {
        if (amount < 10000) {
            return `¥${amount.toLocaleString()}`
        } else if (amount < 1000000) {
            return `¥${Math.round(amount / 1000)}K`
        } else {
            return `¥${(amount / 1000000).toFixed(1)}M`
        }
    }

    return (
        <div className="flex gap-4 items-start">
            {/* 左側：圓餅圖 + 總金額 (40%) */}
            <div className="flex-shrink-0">
                <div
                    className="w-28 h-28 rounded-full shadow-inner relative"
                    style={{ background: gradient }}
                >
                    <div className="absolute inset-3 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <div className="text-center">
                            <div className="text-sm font-bold text-slate-800">{formatAmount(total)}</div>
                            <div className="text-[9px] text-slate-400">總支出</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 右側：類別排行榜 (60%) */}
            <div className="flex-1 space-y-1.5">
                <div className="text-[10px] text-slate-400 font-medium">📊 類別排行</div>
                {legends.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                        <div
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: item.color }}
                        />
                        <span className="text-[11px] text-slate-600 flex-1">
                            {CATEGORY_ICONS[item.category] || '📦'} {item.percent}%
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                            ¥{item.amount.toLocaleString()}
                        </span>
                    </div>
                ))}
                {legends.length > 5 && (
                    <div className="text-[10px] text-slate-400 text-center">+{legends.length - 5} more</div>
                )}
            </div>
        </div>
    )
}

export { CATEGORY_COLORS, CATEGORY_ICONS }
