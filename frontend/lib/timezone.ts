/**
 * 時區工具函數 - 使用原生 Intl API（零依賴）
 * 
 * 功能：
 * - 自動偵測用戶時區
 * - 格式化指定時區時間
 * - 計算時差
 * - 取得城市/國家時區
 */

// 常用旅行目的地時區對照表
export const TRAVEL_TIMEZONES: Record<string, { timezone: string; label: string; flag: string }> = {
    // 亞洲
    'tokyo': { timezone: 'Asia/Tokyo', label: '東京', flag: '🇯🇵' },
    'osaka': { timezone: 'Asia/Tokyo', label: '大阪', flag: '🇯🇵' },
    'seoul': { timezone: 'Asia/Seoul', label: '首爾', flag: '🇰🇷' },
    'bangkok': { timezone: 'Asia/Bangkok', label: '曼谷', flag: '🇹🇭' },
    'singapore': { timezone: 'Asia/Singapore', label: '新加坡', flag: '🇸🇬' },
    'hongkong': { timezone: 'Asia/Hong_Kong', label: '香港', flag: '🇭🇰' },
    'taipei': { timezone: 'Asia/Taipei', label: '台北', flag: '🇹🇼' },
    'shanghai': { timezone: 'Asia/Shanghai', label: '上海', flag: '🇨🇳' },

    // 歐洲
    'london': { timezone: 'Europe/London', label: '倫敦', flag: '🇬🇧' },
    'paris': { timezone: 'Europe/Paris', label: '巴黎', flag: '🇫🇷' },
    'rome': { timezone: 'Europe/Rome', label: '羅馬', flag: '🇮🇹' },
    'berlin': { timezone: 'Europe/Berlin', label: '柏林', flag: '🇩🇪' },

    // 美洲
    'newyork': { timezone: 'America/New_York', label: '紐約', flag: '🇺🇸' },
    'losangeles': { timezone: 'America/Los_Angeles', label: '洛杉磯', flag: '🇺🇸' },
    'vancouver': { timezone: 'America/Vancouver', label: '溫哥華', flag: '🇨🇦' },

    // 大洋洲
    'sydney': { timezone: 'Australia/Sydney', label: '雪梨', flag: '🇦🇺' },
    'auckland': { timezone: 'Pacific/Auckland', label: '奧克蘭', flag: '🇳🇿' },
}

/**
 * 取得用戶當前時區
 * @returns IANA 時區名稱，如 "Asia/Taipei"
 */
export function getUserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
        return 'Asia/Taipei' // 預設
    }
}

/**
 * 取得用戶語言設定
 * @returns 語言代碼，如 "zh-TW"
 */
export function getUserLocale(): string {
    if (typeof navigator !== 'undefined') {
        return navigator.language || 'zh-TW'
    }
    return 'zh-TW'
}

/**
 * 取得完整用戶時間脈絡（給 AI 使用）
 */
export function getUserTimeContext() {
    const now = new Date()
    const timezone = getUserTimezone()

    return {
        timezone,
        locale: getUserLocale(),
        currentTime: now.toISOString(),
        localTime: formatTimeInZone(now, timezone),
        localDate: formatDateInZone(now, timezone),
    }
}

/**
 * 格式化時間（指定時區）
 * @param date - Date 物件或 ISO 字串
 * @param timezone - IANA 時區名稱
 * @param options - 格式化選項
 */
export function formatTimeInZone(
    date: Date | string,
    timezone: string,
    options?: { hour12?: boolean; showSeconds?: boolean }
): string {
    const d = typeof date === 'string' ? new Date(date) : date
    const { hour12 = false, showSeconds = false } = options || {}

    try {
        return new Intl.DateTimeFormat(getUserLocale(), {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            ...(showSeconds && { second: '2-digit' }),
            hour12,
        }).format(d)
    } catch {
        return '--:--'
    }
}

/**
 * 格式化日期（指定時區）
 */
export function formatDateInZone(
    date: Date | string,
    timezone: string,
    options?: { weekday?: boolean; year?: boolean }
): string {
    const d = typeof date === 'string' ? new Date(date) : date
    const { weekday = true, year = false } = options || {}

    try {
        return new Intl.DateTimeFormat(getUserLocale(), {
            timeZone: timezone,
            month: 'numeric',
            day: 'numeric',
            ...(weekday && { weekday: 'short' }),
            ...(year && { year: 'numeric' }),
        }).format(d)
    } catch {
        return '--/--'
    }
}

/**
 * 格式化完整日期時間
 */
export function formatFullDateTime(
    date: Date | string,
    timezone: string
): string {
    const d = typeof date === 'string' ? new Date(date) : date

    try {
        return new Intl.DateTimeFormat(getUserLocale(), {
            timeZone: timezone,
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(d)
    } catch {
        return '--'
    }
}

/**
 * 計算兩個時區之間的時差（小時）
 * @returns 時差，正數表示 toZone 比 fromZone 快
 */
export function getTimezoneOffset(fromZone: string, toZone: string): number {
    const now = new Date()

    try {
        // 取得兩個時區的 UTC offset
        const fromOffset = getZoneOffset(now, fromZone)
        const toOffset = getZoneOffset(now, toZone)

        return (toOffset - fromOffset) / 60 // 轉換為小時
    } catch {
        return 0
    }
}

/**
 * 內部函數：計算指定時區的 UTC offset（分鐘）
 */
function getZoneOffset(date: Date, timezone: string): number {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
    return (tzDate.getTime() - utcDate.getTime()) / 60000
}

/**
 * 取得時區的簡短標籤
 * @returns 如 "JST +9" 或 "TST +8"
 */
export function getTimezoneLabel(timezone: string): string {
    const offset = getZoneOffset(new Date(), timezone) / 60
    const sign = offset >= 0 ? '+' : ''

    // 常用時區縮寫
    const abbreviations: Record<string, string> = {
        'Asia/Tokyo': 'JST',
        'Asia/Taipei': 'TST',
        'Asia/Seoul': 'KST',
        'Asia/Hong_Kong': 'HKT',
        'Asia/Singapore': 'SGT',
        'Asia/Bangkok': 'ICT',
        'America/New_York': 'EST',
        'America/Los_Angeles': 'PST',
        'Europe/London': 'GMT',
        'Europe/Paris': 'CET',
    }

    const abbr = abbreviations[timezone] || timezone.split('/').pop()?.substring(0, 3).toUpperCase() || 'UTC'
    return `${abbr} ${sign}${offset}`
}

/**
 * 比較時間：判斷指定時區現在是否在某時間範圍內
 * @param startHour - 開始小時 (0-23)
 * @param endHour - 結束小時 (0-23)
 * @param timezone - 時區
 */
export function isTimeInRange(startHour: number, endHour: number, timezone: string): boolean {
    const now = new Date()
    const timeStr = formatTimeInZone(now, timezone)
    const currentHour = parseInt(timeStr.split(':')[0], 10)

    if (startHour <= endHour) {
        return currentHour >= startHour && currentHour < endHour
    } else {
        // 跨午夜的情況
        return currentHour >= startHour || currentHour < endHour
    }
}

/**
 * 取得「現在是...時間」的顯示文字
 */
export function getNowInZone(timezone: string): string {
    const time = formatTimeInZone(new Date(), timezone)
    const label = getTimezoneLabel(timezone)
    return `${time} (${label})`
}

/**
 * 根據機場代碼推測時區
 */
export function getTimezoneByAirport(airportCode: string): string | null {
    const airportTimezones: Record<string, string> = {
        // 日本
        'NRT': 'Asia/Tokyo', 'HND': 'Asia/Tokyo', 'KIX': 'Asia/Tokyo',
        'CTS': 'Asia/Tokyo', 'FUK': 'Asia/Tokyo', 'NGO': 'Asia/Tokyo',
        'OKA': 'Asia/Tokyo',
        // 台灣
        'TPE': 'Asia/Taipei', 'TSA': 'Asia/Taipei', 'KHH': 'Asia/Taipei',
        // 韓國
        'ICN': 'Asia/Seoul', 'GMP': 'Asia/Seoul', 'PUS': 'Asia/Seoul',
        // 東南亞
        'BKK': 'Asia/Bangkok', 'DMK': 'Asia/Bangkok',
        'SIN': 'Asia/Singapore',
        'HKG': 'Asia/Hong_Kong',
        'KUL': 'Asia/Kuala_Lumpur',
        'SGN': 'Asia/Ho_Chi_Minh', 'HAN': 'Asia/Ho_Chi_Minh',
        // 中國
        'PVG': 'Asia/Shanghai', 'SHA': 'Asia/Shanghai',
        'PEK': 'Asia/Shanghai', 'PKX': 'Asia/Shanghai',
        // 歐美
        'LHR': 'Europe/London', 'CDG': 'Europe/Paris',
        'JFK': 'America/New_York', 'LAX': 'America/Los_Angeles',
        'SFO': 'America/Los_Angeles', 'YVR': 'America/Vancouver',
    }

    return airportTimezones[airportCode.toUpperCase()] || null
}

/**
 * 計算兩地時差的友好顯示
 * @returns 如 "快 1 小時" 或 "慢 2 小時"
 */
export function getTimeDiffLabel(fromZone: string, toZone: string): string {
    const diff = getTimezoneOffset(fromZone, toZone)

    if (diff === 0) return '相同時間'
    if (diff > 0) return `快 ${diff} 小時`
    return `慢 ${Math.abs(diff)} 小時`
}
