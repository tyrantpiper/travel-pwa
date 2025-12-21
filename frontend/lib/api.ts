// API 路徑設定 - 使用環境變數
const API_HOST = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

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
}

// 也導出 API_HOST，方便動態拼接 URL
export { API_HOST }
