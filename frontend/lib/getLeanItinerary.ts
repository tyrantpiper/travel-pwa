"use client"

/**
 * getLeanItinerary - 資料瘦身函數
 * 
 * 只提取 AI 需要的行程欄位，減少 Token 消耗
 * 排除：id, image_url, created_at, ui_flags 等
 */

export interface LeanItineraryItem {
    time: string
    place: string
    category?: string
    notes?: string       // This is the "Guide/Info" (desc)
    memo?: string        // 🆕 2026: User's private notes
    sub_items?: { name: string; desc?: string }[] // 🆕 2026: Sub-items
    is_highlight?: boolean
}

export interface LeanDay {
    day_number: number
    date: string
    items: LeanItineraryItem[]
}

export interface LeanItinerary {
    title: string
    start_date: string | null
    end_date: string | null
    total_days: number
    days: LeanDay[]
    // AI context additions
    day_notes?: Record<number, { icon?: string; title: string; content: string }[]>
    day_costs?: Record<number, { item: string; amount: string; note?: string }[]>
    day_checklists?: Record<number, { text: string; checked: boolean }[]> // 🆕 2026
    day_tickets?: Record<number, { name: string; price: string; note?: string }[]> // 🆕 2026
    weather_context?: string // 🆕 2026 Weather Neural context
    focused_day?: number // 🆕 2026 Focus
}

/**
 * 將完整行程資料轉換為精簡版本
 * @param fullTrip - 來自 TripContext 的完整行程物件
 * @param items - 行程項目列表
 * @param dayNotes - 每日注意事項
 * @param dayCosts - 每日預估花費
 * @returns 精簡版行程或 null
 */
export function getLeanItinerary(
    fullTrip: {
        title?: string
        start_date?: string | null
        end_date?: string | null
    } | null,
    items: Array<{
        day_number?: number
        time_slot?: string
        place_name?: string
        category?: string
        desc?: string        // Guide information
        memo?: string        // User private notes
        sub_items?: Array<{ name: string; desc?: string }>
        is_highlight?: boolean
    }>,
    dayNotes?: Record<number, { icon?: string; title: string; content: string }[]>,
    dayCosts?: Record<number, { item: string; amount: string; note?: string }[]>,
    dayChecklists?: Record<number, { text: string; checked: boolean }[]>,
    dayTickets?: Record<number, { name: string; price: string; note?: string }[]>,
    focusedDay?: number
): LeanItinerary | null {
    if (!fullTrip) return null
    if (!items || items.length === 0) return null

    // 按天數分組
    const dayMap = new Map<number, LeanItineraryItem[]>()

    for (const item of items) {
        const dayNum = item.day_number || 1
        if (!dayMap.has(dayNum)) {
            dayMap.set(dayNum, [])
        }
        dayMap.get(dayNum)!.push({
            time: item.time_slot || "?",
            place: item.place_name || "Unknown",
            category: item.category,
            notes: item.desc,
            memo: item.memo,
            sub_items: item.sub_items,
            is_highlight: item.is_highlight
        })
    }

    // 轉換為 days 陣列
    const days: LeanDay[] = []
    const startDate = fullTrip.start_date ? new Date(fullTrip.start_date) : null

    const sortedDays = Array.from(dayMap.keys()).sort((a, b) => a - b)
    for (const dayNum of sortedDays) {
        let dateStr = ""
        if (startDate) {
            const dayDate = new Date(startDate)
            dayDate.setDate(dayDate.getDate() + dayNum - 1)
            dateStr = dayDate.toISOString().split("T")[0]
        }

        // 按時間排序
        const dayItems = dayMap.get(dayNum) || []
        dayItems.sort((a, b) => a.time.localeCompare(b.time))

        days.push({
            day_number: dayNum,
            date: dateStr,
            items: dayItems
        })
    }

    return {
        title: fullTrip.title || "My Trip",
        start_date: fullTrip.start_date || null,
        end_date: fullTrip.end_date || null,
        total_days: days.length,
        days,
        day_notes: dayNotes,
        day_costs: dayCosts,
        day_checklists: dayChecklists,
        day_tickets: dayTickets,
        focused_day: focusedDay,
        weather_context: undefined // Will be filled by ChatWidget from global store
    }
}

/**
 * 🔒 2026 Privacy Shield
 * 修剪備忘錄中的私密資訊 (標記為 [PRIVATE] 的行)
 */
function applyPrivacyShield(memo?: string): string | undefined {
    if (!memo) return undefined
    return memo
        .split('\n')
        .filter(line => !line.includes('[PRIVATE]'))
        .join('\n')
        .trim()
}

/**
 * 將 LeanItinerary 轉為人類可讀的 Markdown 格式
 * @param lean - 精簡版行程
 * @param focusedDay - 用戶正在查看的天數 (會標記 👉)
 */
export function formatLeanItineraryForAI(
    lean: LeanItinerary,
    focusedDay?: number
): string {
    const effectiveDay = focusedDay ?? lean.focused_day
    const lines: string[] = [
        `📅 行程: ${lean.title}`,
        `日期: ${lean.start_date || "?"} ~ ${lean.end_date || "?"}`,
        `總天數: ${lean.total_days} 天`,
        ""
    ]

    for (const day of lean.days) {
        const prefix = day.day_number === effectiveDay ? "👉 " : ""
        lines.push(`${prefix}**Day ${day.day_number}** (${day.date || "?"})`)

        for (const item of day.items) {
            const isFocused = day.day_number === effectiveDay
            const categoryIcon = getCategoryIcon(item.category)
            const highlight = item.is_highlight ? "⭐ " : ""
            lines.push(`  ${item.time} ${categoryIcon} ${highlight}${item.place}`)

            // 🧠 2026 Adaptive Resolution: Only expand details for the focused day
            if (isFocused) {
                // Render Guide/Info (if any)
                if (item.notes) {
                    lines.push(`    [Guide] ${item.notes.replace(/\n/g, ' ')}`)
                }

                // Render User Memo (with Privacy Shield)
                const safeMemo = applyPrivacyShield(item.memo)
                if (safeMemo) {
                    lines.push(`    [User Note] ${safeMemo.replace(/\n/g, ' ')}`)
                }

                // Render Sub-items
                if (item.sub_items && item.sub_items.length > 0) {
                    for (const sub of item.sub_items) {
                        lines.push(`    - ${sub.name}${sub.desc ? `: ${sub.desc}` : ''}`)
                    }
                }
            }
        }
        lines.push("")
    }

    // Add day_notes if available for focused day
    if (lean.day_notes && effectiveDay && lean.day_notes[effectiveDay]) {
        lines.push("⚠️ **重點提醒:**")
        for (const note of lean.day_notes[effectiveDay]) {
            lines.push(`  ${note.icon || '•'} **${note.title}**: ${note.content}`)
        }
        lines.push("")
    }

    // Add day_costs if available for focused day
    if (lean.day_costs && effectiveDay && lean.day_costs[effectiveDay]) {
        lines.push("💰 **預估花費:**")
        for (const cost of lean.day_costs[effectiveDay]) {
            lines.push(`  - ${cost.item}: ${cost.amount}${cost.note ? ` (${cost.note})` : ''}`)
        }
        lines.push("")
    }

    // 🆕 2026 Checklist Integration
    if (lean.day_checklists && effectiveDay && lean.day_checklists[effectiveDay]) {
        const tasks = lean.day_checklists[effectiveDay]
        if (tasks.length > 0) {
            lines.push("✅ **當日清單:**")
            for (const task of tasks) {
                lines.push(`  [${task.checked ? 'x' : ' '}] ${task.text}`)
            }
            lines.push("")
        }
    }

    // 🆕 2026 Ticket/Reservation context
    if (lean.day_tickets && effectiveDay && lean.day_tickets[effectiveDay]) {
        const tickets = lean.day_tickets[effectiveDay]
        if (tickets.length > 0) {
            lines.push("🎟️ **門票/預約資訊:**")
            for (const ticket of tickets) {
                lines.push(`  - ${ticket.name}: ${ticket.price} (${ticket.note || '無備註'})`)
            }
            lines.push("")
        }
    }

    // 🆕 Add weather context if available
    if (lean.weather_context) {
        lines.push("🌡️ **實時天氣脈絡:**")
        lines.push(lean.weather_context)
        lines.push("")
    }

    return lines.join("\n")
}

function getCategoryIcon(category?: string): string {
    const icons: Record<string, string> = {
        transport: "🚃",
        food: "🍽️",
        hotel: "🏨",
        shopping: "🛍️",
        sightseeing: "📸"
    }
    return icons[category || ""] || "📍"
}
