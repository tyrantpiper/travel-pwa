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
    GeocodeResponseSchema,
    AiParseResponseSchema,
    AiGenerateResponseSchema,
    ReceiptDiagnostics // Added
} from './schemas';
import { SubItem, PreviewMetadata } from './itinerary-types';
import { z } from "zod";
import { getSecureApiKey } from "@/lib/security";

// === API Endpoints ===
export const API = {
    TRIPS: `${API_HOST}/api/trips`,
    TRIP_CREATE_MANUAL: `${API_HOST}/api/trips/create-manual`,
    TRIP_JOIN: `${API_HOST}/api/trips/join-trip`,
    SAVE_ITINERARY: `${API_HOST}/api/trips/save-itinerary`,
    LATEST_ITINERARY: `${API_HOST}/api/trips/itinerary/latest`,
    PARSE_MD: `${API_HOST}/api/ai/parse-md`,
    GENERATE_TRIP: `${API_HOST}/api/ai/generate-trip`,
    EXPENSES: `${API_HOST}/api/expenses`,
    ITEMS: `${API_HOST}/api/trips/items`,
    GEOCODE: `${API_HOST}/api/geocode/search`,
    POI: `${API_HOST}/api/poi`,
    CHAT: `${API_HOST}/api/chat`,
    ROUTE: `${API_HOST}/api/route`,
    USERS: `${API_HOST}/api/users`,
    APP: `${API_HOST}/api/app`,
    RESOLVE_LINK: `${API_HOST}/api/geocode/resolve-link`,
    RECEIPT_PARSE: `${API_HOST}/api/ai/parse-receipt`,
    ACTUARY: `${API_HOST}/api/ai/actuary`,
    SMART_SEARCH: `${API_HOST}/api/ai/smart-search`,
    RESOLVE_ADDRESS: `${API_HOST}/api/geocode/resolve-address`,
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
    user_id?: string // 🔒 Added for Auth header propagation
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
    address?: string
    hide_navigation?: boolean
    is_private?: boolean       // 🆕 新增
    is_highlight?: boolean     // 🆕 新增
    preview_metadata?: PreviewMetadata     // 🆕 新增
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
    address?: string
    reservation_code?: string
    cost?: number | null
    sort_order?: number
    hide_navigation?: boolean
    is_private?: boolean       // 🆕 新增
    is_highlight?: boolean     // 🆕 新增
    preview_metadata?: PreviewMetadata     // 🆕 新增
    website_link?: string      // 🆕 新增
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
export interface AiParseParams {
    markdown_text: string
    user_id?: string
}

export interface AiGenerateParams {
    prompt: string
    user_id?: string
}

export interface SmartSearchParams {
    query: string
    lat: number
    lng: number
    region?: string
    trip_title?: string
    api_key: string
    max_results?: number
}

export interface SaveItineraryParams {
    title: string
    start_date: string
    end_date: string
    items: Record<string, unknown>[]
    user_id: string
    creator_name: string
    daily_locations?: Record<string, Record<string, unknown>>
    day_notes?: Record<string, Record<string, unknown>>
    day_costs?: Record<string, Record<string, unknown>>
    day_tickets?: Record<string, Record<string, unknown>>
    day_checklists?: Record<string, Record<string, unknown>>
    ai_review?: string
}

export interface ImportToTripParams {
    trip_id: string
    items: Record<string, unknown>[]
    daily_locations?: Record<string, Record<string, unknown>>
    day_notes?: Record<string, Record<string, unknown>>
    day_costs?: Record<string, Record<string, unknown>>
    day_tickets?: Record<string, Record<string, unknown>>
    day_checklists?: Record<string, Record<string, unknown>>
    ai_review?: string
    user_id?: string
}

export interface UserPreference {
    id: string
    user_id: string
    category: string // 'diet', 'pace', 'interest', 'accommodation', 'other'
    preference: string
    confidence?: number
    reasoning?: string
    updated_at: string
}

// === Internal Helpers ===

/**
 * Robustly extracts error messages from various response formats
 * Priority: detail -> error -> message -> text -> fallback
 */
async function extractError(res: Response, fallback: string): Promise<string> {
    try {
        const text = await res.text();
        if (!text) return fallback;

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            // Not JSON - return the raw text if it looks like a message (not HTML)
            if (text.trim().startsWith("<")) return fallback;
            return text.slice(0, 200);
        }

        // 1. Check "detail" (FastAPI standard)
        if (data.detail) {
            if (typeof data.detail === "string") return data.detail;
            if (Array.isArray(data.detail)) {
                return data.detail.map((d: unknown) => typeof d === "string" ? d : JSON.stringify(d)).join(", ");
            }
            if (typeof data.detail === "object") {
                return data.detail.message || JSON.stringify(data.detail);
            }
        }

        // 2. Check "error" (Legacy/Proxy)
        if (data.error) return typeof data.error === "string" ? data.error : JSON.stringify(data.error);

        // 3. Check "message" (General standard)
        if (data.message) return data.message;

        return fallback;
    } catch {
        return fallback;
    }
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
            headers: {
                "Content-Type": "application/json",
                "X-User-ID": params.user_id
            },
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

    /** 🚗 Leave a trip */
    leave: async (tripId: string, userId: string) => {
        const res = await fetch(`${API_HOST}/api/trips/${tripId}/leave`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-User-ID": userId
            }
        })
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: "Failed to leave trip" }))
            throw new Error(err.detail || "Failed to leave trip")
        }
        return res.json()
    },

    /** Join an existing trip via share code */
    join: async (params: JoinTripParams) => {
        const res = await fetch(API.TRIP_JOIN, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-User-ID": params.user_id
            },
            body: JSON.stringify(params)
        })
        if (!res.ok) throw new Error("Invalid code")
        return res.json()
    },

    /** Delete a trip */
    delete: async (tripId: string, userId?: string) => {
        const headers: Record<string, string> = {}
        if (userId) headers["X-User-ID"] = userId

        const res = await fetch(`${API.TRIPS}/${tripId}`, {
            method: "DELETE",
            headers
        })
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
    updateLocation: async (tripId: string, location: { day: number; name: string; lat: number; lng: number }, userId?: string) => {
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        if (userId) headers["X-User-ID"] = userId

        const res = await fetch(`${API.TRIPS}/${tripId}/location`, {
            method: "PATCH",
            headers,
            body: JSON.stringify(location)
        })
        if (!res.ok) throw new Error("Failed to update location")
        return res.json()
    },

    /** Add a new day to trip */
    addDay: async (tripId: string, position: "before" | "end" | "before:1", userId?: string, cloneContent: boolean = false) => {
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        if (userId) headers["X-User-ID"] = userId

        const res = await fetch(`${API.TRIPS}/${tripId}/days`, {
            method: "POST",
            headers,
            body: JSON.stringify({ position, clone_content: cloneContent })
        })
        if (!res.ok) throw new Error("Failed to add day")
        return res.json()
    },

    /** Delete a day from trip */
    deleteDay: async (tripId: string, dayNum: number, userId?: string) => {
        const headers: Record<string, string> = {}
        if (userId) headers["X-User-ID"] = userId

        const res = await fetch(`${API.TRIPS}/${tripId}/days/${dayNum}`, {
            method: "DELETE",
            headers
        })
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
            method: "PATCH",
            headers,
            body: JSON.stringify({ day, ...data })
        })
        if (!res.ok) throw new Error("Failed to update day data")
        return res.json()
    },

    /** 🕵️ Generate AI day review */
    generateAIReview: async (tripId: string, day: number, userId?: string): Promise<{ status: string; day: number; review: string }> => {
        const apiKey = getSecureApiKey()

        if (!apiKey) {
            throw new Error("請到下方導覽列的「個人檔案」頁面設定 Gemini API Key")
        }

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "X-Gemini-API-Key": apiKey
        }
        if (userId) headers["X-User-ID"] = userId

        const res = await fetch(`${API_HOST}/api/ai/trips/${tripId}/days/${day}/ai-review`, {
            method: "POST",
            headers
        })
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: "AI 審核失敗" }))
            throw new Error(error.detail || "AI 審核失敗")
        }
        return res.json()
    },

    /** 🗑️ Clear AI day review */
    clearAIReview: async (tripId: string, day: number, userId?: string) => {
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        if (userId) headers["X-User-ID"] = userId

        const res = await fetch(`${API_HOST}/api/ai/trips/${tripId}/days/${day}/ai-review`, {
            method: "DELETE",
            headers
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

    /** 💾 Save a new itinerary from AI result */
    saveItinerary: async (params: SaveItineraryParams) => {
        const { user_id, ...data } = params
        const res = await fetch(API.SAVE_ITINERARY, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-User-ID": user_id
            },
            body: JSON.stringify({ ...data, user_id })
        })
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: "儲存行程失敗" }))
            throw new Error(error.detail || "儲存行程失敗")
        }
        return res.json()
    },

    /** 📥 Import AI items into an existing trip */
    importToTrip: async (tripId: string, params: Omit<ImportToTripParams, 'trip_id'>) => {
        const { user_id, ...data } = params
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        if (user_id) headers["X-User-ID"] = user_id

        const res = await fetch(`${API.TRIPS}/import-to-trip`, {
            method: "POST",
            headers,
            body: JSON.stringify({ trip_id: tripId, ...data })
        })
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: "匯入行程失敗" }))
            throw new Error(error.detail || "匯入行程失敗")
        }
        return res.json()
    }
}

/**
 * AI API Functions
 */
export const aiApi = {
    /** 🤖 Parse markdown itinerary into structured data */
    parseMarkdown: async (params: AiParseParams) => {
        const apiKey = getSecureApiKey()

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "X-Gemini-API-Key": apiKey
        }
        if (params.user_id) headers["X-User-ID"] = params.user_id

        const res = await fetch(API.PARSE_MD, {
            method: "POST",
            headers,
            body: JSON.stringify({ markdown_text: params.markdown_text })
        })
        if (!res.ok) {
            const errMsg = await extractError(res, "AI 解析失敗")
            throw new Error(errMsg)
        }
        const data = await res.json()
        const parsed = AiParseResponseSchema.safeParse(data)
        if (!parsed.success) {
            console.warn("⚠️ [API] AI parse validation warning:", parsed.error)
            return data
        }
        return parsed.data
    },

    /** 📸 Parse receipt image into structured expense data (Phase 5) */
    parseReceipt: async (imageUrl: string, image?: string) => {
        const apiKey = getSecureApiKey()

        // We forward the auth header so the Proxy can authenticate with the Backend FastAPI
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "X-Gemini-API-Key": apiKey
        }

        const res = await fetch(API.RECEIPT_PARSE, {
            method: "POST",
            headers,
            body: JSON.stringify({ imageUrl, image })
        })

        if (!res.ok) {
            const errMsg = await extractError(res, "AI Receipt Parse Failed")
            throw new Error(errMsg)
        }
        return await res.json()
    },

    /** 🤖 AI Actuary One-Click Split (Phase 7) */
    actuaryChat: async (
        expenses: unknown[],
        members: unknown[],
        message: string,
        history: { role: string, content: string }[]
    ) => {
        const apiKey = getSecureApiKey()

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "X-Gemini-API-Key": apiKey
        }

        const res = await fetch(API.ACTUARY, {
            method: "POST",
            headers,
            body: JSON.stringify({ expenses, members, message, history })
        })

        if (!res.ok) {
            const data = await res.json().catch(() => ({ reply: "AI 精算師連線失敗，請稍後再試" }))
            throw new Error(data.reply || "AI 精算師連線失敗，請稍後再試")
        }
        return await res.json()
    },


    /** 🚀 Generate itinerary from prompt */
    generateTrip: async (params: AiGenerateParams) => {
        const apiKey = getSecureApiKey()

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "X-Gemini-API-Key": apiKey
        }
        if (params.user_id) headers["X-User-ID"] = params.user_id

        const res = await fetch(API.GENERATE_TRIP, {
            method: "POST",
            headers,
            body: JSON.stringify({ prompt: params.prompt })
        })
        if (!res.ok) {
            const errMsg = await extractError(res, "AI 生成失敗")
            throw new Error(errMsg)
        }
        const data = await res.json()
        const parsed = AiGenerateResponseSchema.safeParse(data)
        if (!parsed.success) {
            console.warn("⚠️ [API] AI generate validation warning:", parsed.error)
            return data
        }
        return parsed.data
    },

    /** 🧠 Smart AI Search using gemma-3-27b (Phase 9) */
    smartSearch: async (params: SmartSearchParams) => {
        const res = await fetch(API.SMART_SEARCH, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params)
        })
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ detail: "智能搜尋連線失敗" }))
            throw new Error(errorData.detail || "智能搜尋連線失敗")
        }
        return res.json()
    }
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
        const backendPayload: Record<string, unknown> & { itinerary_id?: string } = {
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
            hide_navigation: params.hide_navigation,
            is_private: params.is_private,
            is_highlight: params.is_highlight,
            preview_metadata: params.preview_metadata
        }
        if (params.address !== undefined) backendPayload.address = params.address
        
        const headers: Record<string, string> = { "Content-Type": "application/json" }

        // Use a generic userID if provided in params or separate arg? 
        // For itemsApi.create, params has trip_id, but the user_id for auth should come from context
        const userId = (params as CreateItemParams & { user_id?: string }).user_id || "";
        if (userId) {
            headers["X-User-ID"] = userId;
        } else {
            console.warn("⚠️ [API] itemsApi.create called without userId. Standardizing to localStorage fallback if available.");
            const fallbackId = typeof window !== 'undefined' ? localStorage.getItem("user_uuid") : "";
            if (fallbackId) headers["X-User-ID"] = fallbackId;
        }

        const res = await offlineFetch(API.ITEMS, {
            method: "POST",
            headers,
            body: JSON.stringify(backendPayload)
        })
        if (!res.ok) throw new Error("Failed to create item")
        return res.json()
    },

    /** Update an existing item */
    update: async (itemId: string, params: UpdateItemParams, userId?: string) => {
        // 🔄 Map frontend params to backend expected payload
        const payload: Record<string, unknown> = {}
        if (params.time !== undefined) payload.time_slot = params.time
        if (params.place !== undefined) payload.place_name = params.place
        if (params.desc !== undefined) payload.notes = params.desc
        if (params.category !== undefined) payload.category = params.category
        if (params.lat !== undefined) payload.lat = params.lat === null ? null : Number(params.lat)
        if (params.lng !== undefined) payload.lng = params.lng === null ? null : Number(params.lng)
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
        if (params.is_private !== undefined) payload.is_private = params.is_private
        if (params.is_highlight !== undefined) payload.is_highlight = params.is_highlight
        if (params.preview_metadata !== undefined) payload.preview_metadata = params.preview_metadata
        if (params.website_link !== undefined) payload.website_link = params.website_link
        if (params.address !== undefined) payload.address = params.address

        const headers: Record<string, string> = { "Content-Type": "application/json" }
        if (userId) headers["X-User-ID"] = userId

        const res = await offlineFetch(`${API.ITEMS}/${itemId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify(payload)
        })
        if (!res.ok) throw new Error("Failed to update item")
        const json = await res.json()

        // 🛡️ Zero-Regression Unwrap: Handle backend envelope { status, data }
        // Edge Case 1: Backend may return error status
        if (json.status === "error") {
            throw new Error(json.message || "Update failed")
        }
        // Edge Case 2: data is typically an array from Supabase .update()
        // Edge Case 3: data could be empty if item was deleted mid-update
        const itemData = (json.data && Array.isArray(json.data))
            ? json.data[0]
            : (json.data || json)

        if (!itemData) {
            console.warn("⚠️ [API] Item update returned empty data")
            return json
        }

        const parsed = ItineraryItemSchema.safeParse(itemData)
        if (!parsed.success) {
            console.warn("⚠️ [API] Item update validation warning:", parsed.error)
            return itemData  // 🛡️ Return unwrapped data instead of envelope
        }
        return parsed.data
    },

    /** Delete an item */
    delete: async (itemId: string, userId?: string) => {
        const headers: Record<string, string> = {}
        if (userId) headers["X-User-ID"] = userId

        const res = await offlineFetch(`${API.ITEMS}/${itemId}`, {
            method: "DELETE",
            headers
        })
        if (!res.ok) throw new Error("Failed to delete item")
        return res.json()
    },

    /** Reorder items */
    reorder: async (items: { item_id: string; sort_order: number; time_slot?: string | null }[], adjustTimes: boolean, userId?: string) => {
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        if (userId) headers["X-User-ID"] = userId

        const res = await fetch(`${API.ITEMS}/reorder`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ items, adjust_times: adjustTimes })
        })
        if (!res.ok) throw new Error("Failed to reorder items")
        return res.json()
    }
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

    resolveLink: async (url: string, type: "map" | "media" = "map") => {
        const res = await fetch(API.RESOLVE_LINK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, type })
        })
        if (!res.ok) throw new Error("Link resolution failed")
        return res.json()
    },

    /** 📍 Resolve structured address using Nominatim (2026 High-Fidelity) */
    resolveAddress: async (address: string) => {
        const res = await offlineFetch(API.RESOLVE_ADDRESS, { // Use offlineFetch if proxy/cache supports it
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address })
        })
        if (!res.ok) {
            // 解析伺服器拋回的標準錯誤格式
            const errData = await res.json().catch(() => null)
            if (errData && errData.message !== undefined) {
                // throw 包含額外屬性的 error object 讓 UI 可以抓 retryable 判斷
                const error = new Error(errData.message)
                Object.assign(error, { retryable: errData.retryable, code: errData.code })
                throw error
            }
            throw new Error(`Failed to resolve address (HTTP ${'status' in res ? res.status : 'unknown'})`)
        }
        return res.json()
    },
}

export interface ExpensePayload {
    title: string;
    amount_jpy: number; // Total in JPY for quick listing
    currency?: string;
    category?: string;
    payment_method?: string | null;
    expense_date?: string | null;
    card_name?: string | null;
    exchange_rate?: number | null;
    cashback_rate?: number;
    is_public?: boolean;
    image_url?: string | null;
    itinerary_id?: string;
    
    // V23.1 Financial Standard
    items?: { original_name: string, translated_name?: string, amount: number }[];
    subtotal_amount?: number;
    tax_amount?: number;
    tip_amount?: number;
    service_charge_amount?: number;
    discount_amount?: number;
    total_amount?: number;
    diagnostics?: ReceiptDiagnostics;

    // Legacy (Deprecated)
    details?: { name: string, price: number }[];
    custom_icon?: string | null;
    notes?: string | null;
    payer_id?: string | null;
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
    create: async (data: ExpensePayload, userId?: string) => {
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

    /** 🧠 Get AI memory preferences (Adaptive Memory) */
    getPreferences: async (userId: string): Promise<UserPreference[]> => {
        const res = await fetch(`${API.USERS}/me/preferences`, {
            headers: { "X-User-ID": userId }
        })
        if (!res.ok) throw new Error("Failed to fetch preferences")
        return res.json()
    },

    /** 🗑️ Delete a preference */
    deletePreference: async (userId: string, prefId: string) => {
        const res = await fetch(`${API.USERS}/me/preferences/${prefId}`, {
            method: "DELETE",
            headers: { "X-User-ID": userId }
        })
        if (!res.ok) throw new Error("Failed to delete preference")
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

/**
 * POI API Functions
 */
export const poiApi = {
    /** 🌐 Nearby Search with Auth Protection */
    nearby: async (lat: number, lng: number, category: string, userId?: string) => {
        const headers: Record<string, string> = {}
        if (userId) headers["X-User-ID"] = userId
        const res = await fetch(`${API_HOST}/api/poi/nearby?lat=${lat}&lng=${lng}&category=${category}&radius=1000`, { headers })
        if (!res.ok) throw new Error("Nearby POI search failed")
        return res.json()
    },

    /** 🔥 AI Recommend with Auth Protection */
    recommend: async (params: { pois: unknown[], user_query: string, api_key: string, user_preferences?: Record<string, unknown> }, userId?: string) => {
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        if (userId) headers["X-User-ID"] = userId
        const res = await fetch(`${API_HOST}/api/poi/recommend`, {
            method: "POST",
            headers,
            body: JSON.stringify(params)
        })
        if (!res.ok) throw new Error("AI Recommendation failed")
        return res.json()
    },

    /** 🆕 v5: Enriched POI Info with Auth Protection (Upgraded for precision caching) */
    enrich: async (params: { 
        name: string, 
        type: string, 
        lat: number, 
        lng: number, 
        api_key?: string | null,
        poi_id?: string,
        wikidata_id?: string
    }, userId?: string) => {
        if (!params.name) throw new Error("POI name is required for enrichment");
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        if (userId) headers["X-User-ID"] = userId

        const res = await fetch(`${API_HOST}/api/poi/ai-enrich`, {
            method: "POST",
            headers,
            body: JSON.stringify(params)
        })
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ detail: "POI 資訊預載失敗" }))
            throw new Error(errorData.detail || "POI 資訊預載失敗")
        }
        return res.json()
    }
}

/**
 * 🎓 Sample Trip API Functions
 * Handles onboarding sample/demo trip seeding
 */
export const sampleTripApi = {
    /** Seed a sample trip for onboarding (idempotent) */
    seed: async (userId: string): Promise<{ status: string; trip_id?: string; reason?: string }> => {
        const res = await fetch(`${API_HOST}/api/trips/seed-sample`, {
            method: "POST",
            headers: { "X-User-ID": userId },
        })
        return res.json()
    },
}
