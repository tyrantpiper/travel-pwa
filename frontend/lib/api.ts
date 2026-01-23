/**
 * Unified API Layer for Ryan Travel App
 * Provides typed API functions for all backend endpoints
 */

const API_HOST = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
console.log("🚀 [API] Connected to:", API_HOST)

import { SyncQueue } from './sync-engine';
import {
    TripSchema,
    ItineraryItemSchema,
    ExpenseSchema,
    UserProfileSchema,
    GeocodeResponseSchema
} from './schemas';
import { SubItem } from './itinerary-types';
import { z } from "zod";

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
    USERS: `${API_HOST}/api/users`,
    APP: `${API_HOST}/api/app`,
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
    image_urls?: string[]
    memo?: string
    link_url?: string
    reservation_code?: string
    cost?: number | null
    sub_items?: SubItem[]
    hide_navigation?: boolean
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
    image_urls?: string[]
    memo?: string
    sub_items?: SubItem[]
    link_url?: string
    reservation_code?: string
    cost?: number | null
    sort_order?: number
    hide_navigation?: boolean
}

export interface GeocodeSearchParams {
    query: string
    limit?: number
    tripTitle?: string  // 行程標題（用於智能國家判斷）
    lat?: number        // 🆕 地圖中心緯度
    lng?: number        // 🆕 地圖中心經度
    country?: string    // 🆕 國家過濾 (如 "Japan", "Taiwan")
    region?: string     // 🆕 區域過濾 (如 "Tokyo 東京")
    zoom?: number       // 🆕 P1: 地圖縮放層級 (用於動態 bias)
}

// 🆕 Export Sync Engine Params

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
        if (!res.ok) {
            // 🆕 Phase 2: 處理行程數量上限錯誤
            const error = await res.json().catch(() => ({ detail: "建立行程失敗" }))
            throw new Error(error.detail || "建立行程失敗")
        }
        const data = await res.json()
        const parsed = TripSchema.safeParse(data)
        if (!parsed.success) {
            console.warn("⚠️ [API] Trip creation validation warning:", parsed.error)
            return data
        }
        return parsed.data
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
    get: async (tripId: string, userId?: string) => {
        const headers: Record<string, string> = {}
        if (userId) {
            headers["X-User-ID"] = userId
        }
        const res = await fetch(`${API.TRIPS}/${tripId}`, { headers })
        if (!res.ok) throw new Error("Failed to fetch trip")
        const data = await res.json()
        const parsed = TripSchema.safeParse(data)
        if (!parsed.success) {
            console.warn("⚠️ [API] Trip fetch validation warning:", parsed.error)
            return data
        }
        return parsed.data
    },

    /** Update trip title */
    updateTitle: async (tripId: string, title: string, userId?: string) => {
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        if (userId) headers["X-User-ID"] = userId

        const res = await fetch(`${API.TRIPS}/${tripId}/title`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ title })
        })
        if (!res.ok) throw new Error("Failed to update title")
        return res.json()
    },

    /** Update trip info (flight, accommodation, etc.) */
    updateInfo: async (tripId: string, info: Record<string, unknown>, userId?: string) => {
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        if (userId) headers["X-User-ID"] = userId

        const res = await fetch(`${API.TRIPS}/${tripId}/info`, {
            method: "PATCH", // 🔧 Standardized to PATCH
            headers,
            body: JSON.stringify(info)
        })
        if (!res.ok) throw new Error("Failed to update info")
        return res.json()
    },

    /** Update daily location */
    updateLocation: async (tripId: string, location: { day: number; name: string; lat: number; lng: number }) => {
        const res = await fetch(`${API.TRIPS}/${tripId}/location`, {
            method: "PATCH",
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
    }, userId?: string) => {
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        if (userId) headers["X-User-ID"] = userId

        const res = await fetch(`${API.TRIPS}/${tripId}/day-data`, {
            method: "PUT",
            headers,
            body: JSON.stringify({ day, ...data })
        })
        if (!res.ok) throw new Error("Failed to update day data")
        return res.json()
    },

    /** 🕵️ Generate AI day review */
    generateAIReview: async (tripId: string, day: number): Promise<{ status: string; day: number; review: string }> => {
        const apiKey = typeof window !== 'undefined'
            ? (localStorage.getItem("user_gemini_key") || process.env.NEXT_PUBLIC_DEV_GEMINI_KEY || "")
            : ""

        if (!apiKey) {
            throw new Error("請先在設定中輸入您的 Gemini API Key (點擊右上角齒輪圖示)")
        }

        const res = await fetch(`${API.TRIPS}/${tripId}/days/${day}/ai-review`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Gemini-API-Key": apiKey
            }
        })
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: "AI 審核失敗" }))
            throw new Error(error.detail || "AI 審核失敗")
        }
        return res.json()
    },

    /** 🗑️ Clear AI day review */
    clearAIReview: async (tripId: string, day: number) => {
        const res = await fetch(`${API.TRIPS}/${tripId}/day-data`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ day, day_ai_reviews: { [day]: "" } })
        })
        if (!res.ok) throw new Error("Failed to clear AI review")
        return res.json()
    },

    /** 🚫 Kick a member from trip (only creator can do this) */
    kickMember: async (tripId: string, memberUserId: string, currentUserId: string) => {
        const res = await fetch(`${API.TRIPS}/${tripId}/members/${memberUserId}`, {
            method: "DELETE",
            headers: { "X-User-ID": currentUserId }
        })
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: "無法踢出成員" }))
            throw new Error(error.detail || "無法踢出成員")
        }
        return res.json()
    },
}

/**
 * 🛠️ Offline-Aware Fetch Wrapper
 */
async function offlineFetch(url: string, options: RequestInit) {
    if (typeof window !== 'undefined' && !navigator.onLine && options.method && options.method !== 'GET') {
        console.warn(`[API] 🔌 Offline: Queuing ${options.method} ${url}`);

        let body: Record<string, unknown> = {};
        const isFormData = options.body instanceof FormData;

        if (isFormData) {
            // 🆕 v2.6: FormData (images) cannot be serialized to IndexedDB directly
            // We store a placeholder to prevent crash and notify the user
            body = { _offline_type: 'formData', note: 'Image uploads are paused in offline mode' };
        } else {
            try {
                body = options.body ? JSON.parse(options.body as string) : {};
            } catch (e) {
                console.error("[API] Failed to parse offline body:", e);
                body = { _raw_body: options.body }; // Store raw if parse fails
            }
        }

        await SyncQueue.enqueue({
            url,
            method: (options.method as 'POST' | 'PUT' | 'PATCH' | 'DELETE'),
            body,
            headers: options.headers as Record<string, string>
        });

        return {
            ok: true,
            json: async () => ({ status: 'queued', offline: true, type: isFormData ? 'formData' : 'json' })
        };
    }
    return fetch(url, options);
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
            image_url: params.image_url,
            image_urls: params.image_urls,
            tags: params.tags,
            memo: params.memo,
            sub_items: params.sub_items,
            link_url: params.link_url,
            reservation_code: params.reservation_code,
            cost_amount: params.cost,
            hide_navigation: params.hide_navigation
        }
        const res = await offlineFetch(API.ITEMS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(backendPayload)
        })
        if (!res.ok) throw new Error("Failed to create item")
        return res.json()
    },

    /** Update an existing item */
    update: async (itemId: string, params: UpdateItemParams) => {
        // 🔄 Map frontend params to backend expected payload
        const payload: Record<string, unknown> = {}
        if (params.time !== undefined) payload.time_slot = params.time
        if (params.place !== undefined) payload.place_name = params.place
        if (params.desc !== undefined) payload.notes = params.desc
        if (params.category !== undefined) payload.category = params.category
        if (params.lat !== undefined) payload.lat = params.lat ? Number(params.lat) : null
        if (params.lng !== undefined) payload.lng = params.lng ? Number(params.lng) : null
        if (params.image_url !== undefined) payload.image_url = params.image_url
        if (params.image_urls !== undefined) payload.image_urls = params.image_urls
        if (params.tags !== undefined) payload.tags = params.tags
        if (params.memo !== undefined) payload.memo = params.memo
        if (params.sub_items !== undefined) payload.sub_items = params.sub_items
        if (params.link_url !== undefined) payload.link_url = params.link_url
        if (params.reservation_code !== undefined) payload.reservation_code = params.reservation_code
        if (params.cost !== undefined) payload.cost_amount = params.cost
        if (params.sort_order !== undefined) payload.sort_order = params.sort_order
        if (params.hide_navigation !== undefined) payload.hide_navigation = params.hide_navigation

        const res = await offlineFetch(`${API.ITEMS}/${itemId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
        if (!res.ok) throw new Error("Failed to update item")
        const data = await res.json()
        const parsed = ItineraryItemSchema.safeParse(data)
        if (!parsed.success) {
            console.warn("⚠️ [API] Item update validation warning:", parsed.error)
            return data
        }
        return parsed.data
    },

    /** Delete an item */
    delete: async (itemId: string) => {
        const res = await offlineFetch(`${API.ITEMS}/${itemId}`, { method: "DELETE" })
        if (!res.ok) throw new Error("Failed to delete item")
        return res.json()
    },
}

/**
 * Geocode API Functions
 */


// ... geocodeApi remains using fetch ...
export const geocodeApi = {
    // ...

    /** Search for locations with smart translation */
    search: async (params: GeocodeSearchParams & { signal?: AbortSignal }) => {
        const { signal, ...searchParams } = params  // 🆕 P5: 分離 signal

        // ... (rest of search logic) ... 
        // Geocode is read-only, so we keep using fetch directly, or use offlineFetch if we want to cache queries (Phase 8)

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
            body: JSON.stringify(searchParams),
            signal
        })
        if (!res.ok) throw new Error("Search failed")
        const data = await res.json()

        // 🛡️ Data Robustness: Validate with Zod
        const parsed = GeocodeResponseSchema.safeParse(data)
        if (!parsed.success) {
            console.warn("⚠️ [API] Geocode validation failed, using raw data:", parsed.error)
            return data
        }
        return parsed.data
    },
}

/**
 * Expense API Functions
 */
export const expensesApi = {
    /** Get expenses for a trip */
    getByTrip: async (tripId: string, userId?: string) => {
        const headers: Record<string, string> = {}
        if (userId) headers["X-User-ID"] = userId

        const res = await fetch(`${API.TRIPS}/${tripId}/expenses`, { headers })
        if (!res.ok) throw new Error("Failed to fetch expenses")
        const data = await res.json()
        const parsed = z.array(ExpenseSchema).safeParse(data)
        if (!parsed.success) {
            console.warn("⚠️ [API] Expense list validation warning:", parsed.error)
            return data
        }
        return parsed.data
    },

    /** Create a new expense */
    create: async (data: Record<string, unknown>, userId?: string) => {
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        if (userId) headers["X-User-ID"] = userId

        const res = await offlineFetch(API.EXPENSES, {
            method: "POST",
            headers,
            body: JSON.stringify(data)
        })
        if (!res.ok) throw new Error("Failed to create expense")
        return res.json()
    },

    /** Update an expense */
    update: async (expenseId: string, data: Record<string, unknown>, userId?: string) => {
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        if (userId) headers["X-User-ID"] = userId

        const res = await offlineFetch(`${API.EXPENSES}/${expenseId}`, {
            method: "PATCH", // Backend specifies PATCH/PUT in different places, but it's typically PATCH for updates
            headers,
            body: JSON.stringify(data)
        })
        if (!res.ok) throw new Error("Failed to update expense")
        return res.json()
    },

    /** Delete an expense */
    delete: async (expenseId: string, userId?: string) => {
        const headers: Record<string, string> = {}
        if (userId) headers["X-User-ID"] = userId

        const res = await offlineFetch(`${API.EXPENSES}/${expenseId}`, {
            method: "DELETE",
            headers
        })
        if (!res.ok) throw new Error("Failed to delete expense")
        return res.json()
    },
}

/**
 * User API Functions
 */
export const usersApi = {
    /** Get user profile */
    getProfile: async (userId: string) => {
        const res = await fetch(`${API.USERS}/${userId}/profile`)
        if (!res.ok) throw new Error("Failed to fetch profile")
        const data = await res.json()
        const parsed = UserProfileSchema.safeParse(data)
        if (!parsed.success) {
            console.warn("⚠️ [API] Profile fetch validation warning:", parsed.error)
            return data
        }
        return parsed.data
    },

    /** Update user profile */
    updateProfile: async (userId: string, data: { name?: string; avatar_url?: string }) => {
        const res = await fetch(`${API.USERS}/me`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "X-User-ID": userId
            },
            body: JSON.stringify(data)
        })
        if (!res.ok) throw new Error("Failed to update profile")
        return res.json()
    },
}

/**
 * App Settings API Functions
 */
export const appApi = {
    /** Get donation progress from backend */
    getDonationProgress: async () => {
        const res = await fetch(`${API.APP}/donation-progress`)
        if (!res.ok) throw new Error("Failed to fetch donation progress")
        return res.json()
    },
}
