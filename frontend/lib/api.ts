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
}

/**
 * Item (Activity) API Functions
 */
export const itemsApi = {
    /** Create a new item */
    create: async (params: CreateItemParams) => {
        const res = await fetch(API.ITEMS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params)
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
    /** Search for locations */
    search: async (params: GeocodeSearchParams) => {
        const res = await fetch(API.GEOCODE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
