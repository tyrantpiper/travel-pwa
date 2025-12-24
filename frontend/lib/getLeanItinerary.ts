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
    notes?: string
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
}

/**
 * 將完整行程資料轉換為精簡版本
 * @param fullTrip - 來自 TripContext 的完整行程物件
 * @param items - 行程項目列表
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
        desc?: string
    }>
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
            notes: item.desc
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
        days
    }
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
    const lines: string[] = [
        `📅 行程: ${lean.title}`,
        `日期: ${lean.start_date || "?"} ~ ${lean.end_date || "?"}`,
        `總天數: ${lean.total_days} 天`,
        ""
    ]

    for (const day of lean.days) {
        const prefix = day.day_number === focusedDay ? "👉 " : ""
        lines.push(`${prefix}**Day ${day.day_number}** (${day.date || "?"})`)

        for (const item of day.items) {
            const categoryIcon = getCategoryIcon(item.category)
            lines.push(`  ${item.time} ${categoryIcon} ${item.place}`)
        }
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
