export interface Coordinate {
    lat: number
    lng: number
}

export interface LocationInfo extends Coordinate {
    name: string
    display_name?: string
    type?: string
    country?: string
    admin1?: string
    admin2?: string
    source?: string
}

export interface ItineraryItemState {
    id?: string
    itinerary_id?: string
    day_number?: number
    time: string
    place: string
    category?: string
    desc: string
    tags?: string[]
    lat?: number | string | null
    lng?: number | string | null
    image_url?: string
    image_urls?: string[]  // 🆕 多圖片 URLs
    sub_items?: SubItem[]
    memo?: string
}

export interface DailyLocation {
    lat: number
    lng: number
    name: string
}

export interface DayWeather {
    time: string
    temp: number
    code: number
    humidity?: number               // 🆕 濕度 (%)
    precipitation_probability?: number  // 🆕 降雨機率 (%)
    apparent_temperature?: number   // 🆕 體感溫度
    uvIndex?: number                // 🆕 Phase 6: UV 指數
    windSpeed?: number              // 🆕 Phase 6: 風速
    visibility?: number             // 🆕 Phase 10: 能見度 (m)
    airQuality?: number             // 🆕 Phase 9: AQI (US AQI)
    precipTrend?: 'wet' | 'unstable' | 'dry'  // 🆕 Phase 11: Seasonal 降雨趨勢
    isSeasonalEstimate?: boolean    // 🆕 Phase 11: 標記為季節性推估（非精確預報）
}

export interface SubItem {
    name: string
    desc?: string
    link?: string
}

export interface Activity {
    id: string
    itinerary_id?: string
    day_number?: number
    time_slot: string // Backwards compat with backend 'time_slot' vs frontend 'time'
    time?: string // Some parts use 'time'
    place_name?: string // Backwards compat
    place?: string
    category?: string
    notes?: string // Backwards compat
    desc?: string
    lat?: number
    lng?: number
    image_url?: string
    image_urls?: string[]  // 🆕 多圖片 URLs
    tags?: string[]
    memo?: string // User's private memo
    sub_items?: SubItem[]
    link_url?: string // External link for the place itself
    is_highlight?: boolean
}

export interface TripDay {
    day: number
    activities: Activity[]
    // location?
}

export interface NoteItem {
    icon?: string
    title: string
    content: string
}

export interface CostItem {
    item: string
    amount: string
    note?: string
}

export interface TicketItem {
    name: string
    price: string
    note?: string
}

export interface Trip {
    id: string
    title: string
    start_date?: string
    end_date?: string
    days: TripDay[]
    cover_image?: string
    share_code?: string
    creator_name?: string
    created_by?: string
    daily_locations?: Record<number, DailyLocation>
    day_notes?: Record<number, NoteItem[]>
    day_costs?: Record<number, CostItem[]>
    day_tickets?: Record<number, TicketItem[]>
    day_checklists?: Record<number, { id: string; text: string; checked: boolean }[]>
    ai_review?: string
    day_ai_reviews?: Record<number, string>  // 🆕 每日 AI 審核
}

export interface GeocodeResult {
    name: string
    address?: string
    lat: number
    lng: number
    type?: string
    source?: string
    results?: GeocodeResult[]
}
