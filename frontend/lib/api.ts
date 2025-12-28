/**
 * Unified API Layer for Ryan Travel App
 * Provides typed API functions for all backend endpoints
 */

const API_HOST = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// === API Endpoints ===
export const API = {
    TRIPS: `${API_HOST}/api/trips`,
    TRIP_CREATE_MANUAL: `${API_HOST}/api/trip/create-manual`,
    TRIP_JOIN: `${API_HOST}/api/join-trip`,
    SAVE_ITINERARY: `${API_HOST}/api/save-itinerary`,
    LATEST_ITINERARY: `${API_HOST}/api/itinerary/latest`,
    PARSE_MD: `${API_HOST}/api/parse-md`,
    GENERATE_TRIP: `${API_HOST}/api/generate-trip`,
    EXPENSES: `${API_HOST}/api/expenses`,
    ITEMS: `${API_HOST}/api/items`,
    GEOCODE: `${API_HOST}/api/geocode/search`,
    POI: `${API_HOST}/api/poi`,
    CHAT: `${API_HOST}/api/chat`,
    ROUTE: `${API_HOST}/api/route`,
}

export { API_HOST }

// === Type Definitions ===
export interface CreateTripParams {
    title: string
    start_date: string
    end_date: string
    creator_name?: string
    user_id: string
    cover_image?: string
}

export interface JoinTripParams {
    share_code: string
    user_id: string
    user_name?: string
}

export interface CreateItemParams {
    trip_id: string
    day: number
    time: string
    place: string
    desc?: string
    category?: string
    lat?: number | string | null
    lng?: number | string | null
    tags?: string[]
    image_url?: string
}

export interface UpdateItemParams {
    time?: string
    place?: string
    desc?: string
    category?: string
    lat?: number | string | null
    lng?: number | string | null
    tags?: string[]
    image_url?: string
    memo?: string
    sub_items?: { name: string; checked: boolean }[]
}

export interface GeocodeSearchParams {
    query: string
    limit?: number
    tripTitle?: string  // 行程標題（用於智能國家判斷）
    lat?: number        // 🆕 地圖中心緯度
    lng?: number        // 🆕 地圖中心經度
    country?: string    // 🆕 國家過濾 (如 "Japan", "Taiwan")
    region?: string     // 🆕 區域過濾 (如 "Tokyo 東京")
}

// === API Functions ===

/**
 * Trip API Functions
 */
export const tripsApi = {
    /** Create a new trip manually */
    create: async (params: CreateTripParams) => {
        const res = await fetch(API.TRIP_CREATE_MANUAL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params)
        })
        if (!res.ok) throw new Error("Failed to create trip")
        return res.json()
    },

    /** Join an existing trip via share code */
    join: async (params: JoinTripParams) => {
        const res = await fetch(API.TRIP_JOIN, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params)
        })
        if (!res.ok) throw new Error("Invalid code")
        return res.json()
    },

    /** Delete a trip */
    delete: async (tripId: string) => {
        const res = await fetch(`${API.TRIPS}/${tripId}`, { method: "DELETE" })
        if (!res.ok) throw new Error("Failed to delete trip")
        return res.json()
    },

    /** Get a single trip by ID */
    get: async (tripId: string) => {
        const res = await fetch(`${API.TRIPS}/${tripId}`)
        if (!res.ok) throw new Error("Failed to fetch trip")
        return res.json()
    },

    /** Update trip title */
    updateTitle: async (tripId: string, title: string) => {
        const res = await fetch(`${API.TRIPS}/${tripId}/title`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title })
        })
        if (!res.ok) throw new Error("Failed to update title")
        return res.json()
    },

    /** Update trip info (flight, accommodation, etc.) */
    updateInfo: async (tripId: string, info: Record<string, unknown>) => {
        const res = await fetch(`${API.TRIPS}/${tripId}/info`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(info)
        })
        if (!res.ok) throw new Error("Failed to update info")
        return res.json()
    },

    /** Update daily location */
    updateLocation: async (tripId: string, location: { day: number; name: string; lat: number; lng: number }) => {
        const res = await fetch(`${API.TRIPS}/${tripId}/location`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(location)
        })
        if (!res.ok) throw new Error("Failed to update location")
        return res.json()
    },

    /** Add a new day to trip */
    addDay: async (tripId: string, position: "before" | "end") => {
        const res = await fetch(`${API.TRIPS}/${tripId}/days`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ position })
        })
        if (!res.ok) throw new Error("Failed to add day")
        return res.json()
    },

    /** Delete a day from trip */
    deleteDay: async (tripId: string, dayNum: number) => {
        const res = await fetch(`${API.TRIPS}/${tripId}/days/${dayNum}`, { method: "DELETE" })
        if (!res.ok) throw new Error("Failed to delete day")
        return res.json()
    },

    /** Update day data (notes, costs, tickets, checklists) */
    updateDayData: async (tripId: string, day: number, data: {
        day_notes?: Record<number, { icon?: string; title: string; content: string }[]>
        day_costs?: Record<number, { item: string; amount: string; note?: string }[]>
        day_tickets?: Record<number, { name: string; price: string; note?: string }[]>
        day_checklists?: Record<number, { id: string; text: string; checked: boolean }[]>
    }) => {
        const res = await fetch(`${API.TRIPS}/${tripId}/day-data`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ day, ...data })
        })
        if (!res.ok) throw new Error("Failed to update day data")
        return res.json()
    },
}

/**
 * Item (Activity) API Functions
 */
export const itemsApi = {
    /** Create a new item */
    create: async (params: CreateItemParams) => {
        // 欄位轉換：前端 → 後端格式
        const backendPayload = {
            itinerary_id: params.trip_id,
            day_number: params.day,
            time_slot: params.time,
            place_name: params.place,
            category: params.category || "activity",
            notes: params.desc,
            lat: typeof params.lat === "string" ? parseFloat(params.lat) : params.lat,
            lng: typeof params.lng === "string" ? parseFloat(params.lng) : params.lng,
            image_url: params.image_url,  // 🆕 修復：圖片 URL
            tags: params.tags             // 🆕 修復：標籤陣列
        }
        const res = await fetch(API.ITEMS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(backendPayload)
        })
        if (!res.ok) throw new Error("Failed to create item")
        return res.json()
    },

    /** Update an existing item */
    update: async (itemId: string, params: UpdateItemParams) => {
        const res = await fetch(`${API.ITEMS}/${itemId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params)
        })
        if (!res.ok) throw new Error("Failed to update item")
        return res.json()
    },

    /** Delete an item */
    delete: async (itemId: string) => {
        const res = await fetch(`${API.ITEMS}/${itemId}`, { method: "DELETE" })
        if (!res.ok) throw new Error("Failed to delete item")
        return res.json()
    },
}

/**
 * Geocode API Functions
 */
export const geocodeApi = {
    /** Search for locations with smart translation */
    search: async (params: GeocodeSearchParams) => {
        const geminiKey = typeof window !== 'undefined'
            ? localStorage.getItem("user_gemini_key")
            : null

        const headers: Record<string, string> = {
            "Content-Type": "application/json"
        }
        if (geminiKey) {
            headers["X-Gemini-Key"] = geminiKey
        }

        console.log("🌍 Geocode Search Payload:", { query: params.query, tripTitle: params.tripTitle, hasKey: !!geminiKey })

        const res = await fetch(API.GEOCODE, {
            method: "POST",
            headers,
            body: JSON.stringify(params)
        })
        if (!res.ok) throw new Error("Search failed")
        return res.json()
    },
}

/**
 * Expense API Functions
 */
export const expensesApi = {
    /** Get expenses for a trip */
    getByTrip: async (tripId: string) => {
        const res = await fetch(`${API.TRIPS}/${tripId}/expenses`)
        if (!res.ok) throw new Error("Failed to fetch expenses")
        return res.json()
    },

    /** Create a new expense */
    create: async (data: Record<string, unknown>) => {
        const res = await fetch(API.EXPENSES, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        })
        if (!res.ok) throw new Error("Failed to create expense")
        return res.json()
    },

    /** Update an expense */
    update: async (expenseId: string, data: Record<string, unknown>) => {
        const res = await fetch(`${API.EXPENSES}/${expenseId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        })
        if (!res.ok) throw new Error("Failed to update expense")
        return res.json()
    },

    /** Delete an expense */
    delete: async (expenseId: string) => {
        const res = await fetch(`${API.EXPENSES}/${expenseId}`, { method: "DELETE" })
        if (!res.ok) throw new Error("Failed to delete expense")
        return res.json()
    },
}
