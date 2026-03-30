export interface Coordinate {
    lat: number
    lng: number
}

export interface LocationInfo extends Coordinate {
    name: string
    display_name?: string
    address?: string
    type?: string
    country?: string
    admin1?: string
    admin2?: string
    source?: string
    osm_id?: number | string
}

export interface PreviewMetadata {
    og_image?: string
    og_title?: string
    og_description?: string
    map_image?: string
    custom_order?: string[]
    hidden_images?: string[]
}

export interface ItineraryItemState {
    id?: string
    itinerary_id?: string
    day_number?: number
    time: string
    place: string
    category?: string
    desc: string
    address?: string
    tags?: string[]
    lat?: number | string | null
    lng?: number | string | null
    image_url?: string
    image_urls?: string[]  // 🆕 多圖片 URLs
    sub_items?: SubItem[]
    memo?: string
    link_url?: string
    website_link?: string
    preview_metadata?: PreviewMetadata
    reservation_code?: string
    cost?: number | null
    cost_amount?: number | null // 🆕 For backend parity
    hide_navigation?: boolean
    is_private?: boolean
    is_highlight?: boolean
    isManualCoords?: boolean
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
    address?: string
    lat?: number
    lng?: number
    image_url?: string
    image_urls?: string[]  // 🆕 多圖片 URLs
    tags?: string[]
    memo?: string // User's private memo
    sub_items?: SubItem[]
    link_url?: string // External link for the place itself
    website_link?: string
    preview_metadata?: PreviewMetadata
    reservation_code?: string
    cost?: number | null
    cost_amount?: number | null
    hide_navigation?: boolean
    is_private?: boolean
    is_highlight?: boolean
    sort_order?: number  // 🆕 拖曳排序
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

export interface ChecklistItem {
    id: string
    text: string
    checked: boolean
    is_private?: boolean
    private_owner_id?: string
}

export interface Trip {
    id: string
    title: string
    start_date?: string
    end_date?: string
    days: TripDay[]
    cover_image?: string
    share_code?: string
    public_id?: string // 🆕 隨機公開 ID (URL 使用)
    creator_name?: string
    created_by?: string
    members?: { user_id: string; user_name: string }[]  // 🆕 成員列表
    daily_locations?: Record<number, DailyLocation>
    day_notes?: Record<number, NoteItem[]>
    day_costs?: Record<number, CostItem[]>
    day_tickets?: Record<number, TicketItem[]>
    day_checklists?: Record<number, ChecklistItem[]>
    ai_review?: string
    day_ai_reviews?: Record<number, string>  // 🆕 每日 AI 審核
    is_sample?: boolean  // 🎓 Sample/demo trip flag
}

export interface GeocodeResult {
    name: string
    display_name?: string
    address?: string
    lat: number
    lng: number
    type?: string
    country?: string
    admin1?: string
    admin2?: string
    source?: string
    results?: GeocodeResult[]
    osm_id?: number | string
}

// 🆕 Shared Search Result Type
export interface SearchResult {
    lat: number
    lng: number
    name: string
    address?: string
    type?: string
    source?: string
    osm_id?: number | string
    city?: string
    country?: string
    wikipedia?: string
    cross_country?: boolean
    _distKm?: number | null
}
// 🆕 v22.1: Unified type for AI-generated/imported itineraries
export interface ParsedItineraryItem {
    day_number: number
    time_slot: string
    place_name: string
    category?: string
    desc?: string
    lat?: number
    lng?: number
    [key: string]: unknown // For future extra fields
}

export interface ParsedItinerary {
    title?: string
    start_date?: string
    end_date?: string
    items: ParsedItineraryItem[]
}
