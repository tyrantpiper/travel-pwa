import { Activity, DailyLocation } from "@/lib/itinerary-types"

export interface ResolvedLocation {
    name: string
    lat: number
    lng: number
    timezone: string
}

// 常見城市座標對照表（含時區）
export const CITY_COORDS: Record<string, { lat: number; lng: number; name: string; timezone: string }> = {
    // 日本主要都道府縣與觀光大區
    "東京": { lat: 35.6895, lng: 139.6917, name: "東京", timezone: "Asia/Tokyo" },
    "Tokyo": { lat: 35.6895, lng: 139.6917, name: "Tokyo", timezone: "Asia/Tokyo" },
    "大阪": { lat: 34.6937, lng: 135.5023, name: "大阪", timezone: "Asia/Tokyo" },
    "Osaka": { lat: 34.6937, lng: 135.5023, name: "Osaka", timezone: "Asia/Tokyo" },
    "京都": { lat: 35.0116, lng: 135.7681, name: "京都", timezone: "Asia/Tokyo" },
    "Kyoto": { lat: 35.0116, lng: 135.7681, name: "Kyoto", timezone: "Asia/Tokyo" },
    "北海道": { lat: 43.0618, lng: 141.3545, name: "北海道", timezone: "Asia/Tokyo" },
    "Hokkaido": { lat: 43.0618, lng: 141.3545, name: "Hokkaido", timezone: "Asia/Tokyo" },
    "札幌": { lat: 43.0618, lng: 141.3545, name: "札幌", timezone: "Asia/Tokyo" },
    "Sapporo": { lat: 43.0618, lng: 141.3545, name: "Sapporo", timezone: "Asia/Tokyo" },
    "函館": { lat: 41.7687, lng: 140.7288, name: "函館", timezone: "Asia/Tokyo" },
    "Hakodate": { lat: 41.7687, lng: 140.7288, name: "Hakodate", timezone: "Asia/Tokyo" },
    "小樽": { lat: 43.1907, lng: 140.9947, name: "小樽", timezone: "Asia/Tokyo" },
    "Otaru": { lat: 43.1907, lng: 140.9947, name: "Otaru", timezone: "Asia/Tokyo" },
    "旭川": { lat: 43.7706, lng: 142.3650, name: "旭川", timezone: "Asia/Tokyo" },
    "Asahikawa": { lat: 43.7706, lng: 142.3650, name: "Asahikawa", timezone: "Asia/Tokyo" },
    "富良野": { lat: 43.3421, lng: 142.3832, name: "富良野", timezone: "Asia/Tokyo" },
    "Furano": { lat: 43.3421, lng: 142.3832, name: "Furano", timezone: "Asia/Tokyo" },
    "二世谷": { lat: 42.8622, lng: 140.7042, name: "二世谷", timezone: "Asia/Tokyo" },
    "新雪谷": { lat: 42.8622, lng: 140.7042, name: "新雪谷", timezone: "Asia/Tokyo" },
    "Niseko": { lat: 42.8622, lng: 140.7042, name: "Niseko", timezone: "Asia/Tokyo" },
    "福岡": { lat: 33.5904, lng: 130.4017, name: "福岡", timezone: "Asia/Tokyo" },
    "Fukuoka": { lat: 33.5904, lng: 130.4017, name: "Fukuoka", timezone: "Asia/Tokyo" },
    "名古屋": { lat: 35.1815, lng: 136.9066, name: "名古屋", timezone: "Asia/Tokyo" },
    "Nagoya": { lat: 35.1815, lng: 136.9066, name: "Nagoya", timezone: "Asia/Tokyo" },
    "沖繩": { lat: 26.2124, lng: 127.6809, name: "沖繩", timezone: "Asia/Tokyo" },
    "那霸": { lat: 26.2124, lng: 127.6809, name: "那霸", timezone: "Asia/Tokyo" },
    "Okinawa": { lat: 26.2124, lng: 127.6809, name: "Okinawa", timezone: "Asia/Tokyo" },
    "石垣島": { lat: 24.3448, lng: 124.1572, name: "石垣島", timezone: "Asia/Tokyo" },
    "宮古島": { lat: 24.8055, lng: 125.2811, name: "宮古島", timezone: "Asia/Tokyo" },
    "仙台": { lat: 38.2682, lng: 140.8694, name: "仙台", timezone: "Asia/Tokyo" },
    "Sendai": { lat: 38.2682, lng: 140.8694, name: "Sendai", timezone: "Asia/Tokyo" },
    "青森": { lat: 40.8222, lng: 140.7474, name: "青森", timezone: "Asia/Tokyo" },
    "Aomori": { lat: 40.8222, lng: 140.7474, name: "Aomori", timezone: "Asia/Tokyo" },
    "金澤": { lat: 36.5613, lng: 136.6562, name: "金澤", timezone: "Asia/Tokyo" },
    "Kanazawa": { lat: 36.5613, lng: 136.6562, name: "Kanazawa", timezone: "Asia/Tokyo" },
    "輕井澤": { lat: 36.3488, lng: 138.6358, name: "輕井澤", timezone: "Asia/Tokyo" },
    "Karuizawa": { lat: 36.3488, lng: 138.6358, name: "Karuizawa", timezone: "Asia/Tokyo" },
    "日光": { lat: 36.7554, lng: 139.5986, name: "日光", timezone: "Asia/Tokyo" },
    "Nikko": { lat: 36.7554, lng: 139.5986, name: "Nikko", timezone: "Asia/Tokyo" },
    "橫濱": { lat: 35.4437, lng: 139.6380, name: "橫濱", timezone: "Asia/Tokyo" },
    "Yokohama": { lat: 35.4437, lng: 139.6380, name: "Yokohama", timezone: "Asia/Tokyo" },
    "神戶": { lat: 34.6901, lng: 135.1955, name: "神戶", timezone: "Asia/Tokyo" },
    "Kobe": { lat: 34.6901, lng: 135.1955, name: "Kobe", timezone: "Asia/Tokyo" },
    "奈良": { lat: 34.6851, lng: 135.8048, name: "奈良", timezone: "Asia/Tokyo" },
    "Nara": { lat: 34.6851, lng: 135.8048, name: "Nara", timezone: "Asia/Tokyo" },
    "廣島": { lat: 34.3853, lng: 132.4553, name: "廣島", timezone: "Asia/Tokyo" },
    "Hiroshima": { lat: 34.3853, lng: 132.4553, name: "Hiroshima", timezone: "Asia/Tokyo" },

    // 台灣全區
    "台北": { lat: 25.0330, lng: 121.5654, name: "台北", timezone: "Asia/Taipei" },
    "Taipei": { lat: 25.0330, lng: 121.5654, name: "Taipei", timezone: "Asia/Taipei" },
    "新北": { lat: 25.0169, lng: 121.4628, name: "新北", timezone: "Asia/Taipei" },
    "New Taipei": { lat: 25.0169, lng: 121.4628, name: "New Taipei", timezone: "Asia/Taipei" },
    "台中": { lat: 24.1477, lng: 120.6736, name: "台中", timezone: "Asia/Taipei" },
    "Taichung": { lat: 24.1477, lng: 120.6736, name: "Taichung", timezone: "Asia/Taipei" },
    "台南": { lat: 22.9999, lng: 120.2269, name: "台南", timezone: "Asia/Taipei" },
    "Tainan": { lat: 22.9999, lng: 120.2269, name: "Tainan", timezone: "Asia/Taipei" },
    "高雄": { lat: 22.6273, lng: 120.3014, name: "高雄", timezone: "Asia/Taipei" },
    "Kaohsiung": { lat: 22.6273, lng: 120.3014, name: "Kaohsiung", timezone: "Asia/Taipei" },
    "花蓮": { lat: 23.9872, lng: 121.6016, name: "花蓮", timezone: "Asia/Taipei" },
    "Hualien": { lat: 23.9872, lng: 121.6016, name: "Hualien", timezone: "Asia/Taipei" },
    "台東": { lat: 22.7583, lng: 121.1444, name: "台東", timezone: "Asia/Taipei" },
    "Taitung": { lat: 22.7583, lng: 121.1444, name: "Taitung", timezone: "Asia/Taipei" },
    "宜蘭": { lat: 24.7570, lng: 121.7530, name: "宜蘭", timezone: "Asia/Taipei" },
    "Yilan": { lat: 24.7570, lng: 121.7530, name: "Yilan", timezone: "Asia/Taipei" },
    "新竹": { lat: 24.8138, lng: 120.9675, name: "新竹", timezone: "Asia/Taipei" },
    "澎湖": { lat: 23.5711, lng: 119.5793, name: "澎湖", timezone: "Asia/Taipei" },
    "金門": { lat: 24.4493, lng: 118.3766, name: "金門", timezone: "Asia/Taipei" },

    // 國際熱門旅遊目的地
    "首爾": { lat: 37.5665, lng: 126.9780, name: "首爾", timezone: "Asia/Seoul" },
    "Seoul": { lat: 37.5665, lng: 126.9780, name: "Seoul", timezone: "Asia/Seoul" },
    "釜山": { lat: 35.1796, lng: 129.0756, name: "釜山", timezone: "Asia/Seoul" },
    "Busan": { lat: 35.1796, lng: 129.0756, name: "Busan", timezone: "Asia/Seoul" },
    "香港": { lat: 22.3193, lng: 114.1694, name: "香港", timezone: "Asia/Hong_Kong" },
    "Hong Kong": { lat: 22.3193, lng: 114.1694, name: "Hong Kong", timezone: "Asia/Hong_Kong" },
    "新加坡": { lat: 1.3521, lng: 103.8198, name: "新加坡", timezone: "Asia/Singapore" },
    "Singapore": { lat: 1.3521, lng: 103.8198, name: "Singapore", timezone: "Asia/Singapore" },
    "曼谷": { lat: 13.7563, lng: 100.5018, name: "曼谷", timezone: "Asia/Bangkok" },
    "Bangkok": { lat: 13.7563, lng: 100.5018, name: "Bangkok", timezone: "Asia/Bangkok" },
    "清邁": { lat: 18.7883, lng: 98.9853, name: "清邁", timezone: "Asia/Bangkok" },
    "Chiang Mai": { lat: 18.7883, lng: 98.9853, name: "Chiang Mai", timezone: "Asia/Bangkok" },
    "峴港": { lat: 16.0544, lng: 108.2022, name: "峴港", timezone: "Asia/Ho_Chi_Minh" },
    "Da Nang": { lat: 16.0544, lng: 108.2022, name: "Da Nang", timezone: "Asia/Ho_Chi_Minh" },
    "峇里島": { lat: -8.4095, lng: 115.1889, name: "峇里島", timezone: "Asia/Makassar" },
    "Bali": { lat: -8.4095, lng: 115.1889, name: "Bali", timezone: "Asia/Makassar" },
    "巴黎": { lat: 48.8566, lng: 2.3522, name: "巴黎", timezone: "Europe/Paris" },
    "Paris": { lat: 48.8566, lng: 2.3522, name: "Paris", timezone: "Europe/Paris" },
    "倫敦": { lat: 51.5074, lng: -0.1278, name: "倫敦", timezone: "Europe/London" },
    "London": { lat: 51.5074, lng: -0.1278, name: "London", timezone: "Europe/London" },
    "紐約": { lat: 40.7128, lng: -74.0060, name: "紐約", timezone: "America/New_York" },
    "New York": { lat: 40.7128, lng: -74.0060, name: "New York", timezone: "America/New_York" },
}

/**
 * 4 層備援單日座標解析器
 * 優先序: 手動每日地點 -> 當日首個有座標景點 -> 行程標題匹配城市 -> 預設東京
 */
export function resolveDayLocation(
    day: number,
    dailyLocs: Record<number, DailyLocation> | undefined,
    activities: Activity[],
    tripTitle: string = ""
): ResolvedLocation {
    // Priority 1: 手動設定的地點
    if (dailyLocs && dailyLocs[day]?.lat && dailyLocs[day]?.lng) {
        const loc = dailyLocs[day]
        let timezone = "Asia/Tokyo"
        for (const [cityName, coords] of Object.entries(CITY_COORDS)) {
            if (loc.name?.includes(cityName)) {
                timezone = coords.timezone
                break
            }
        }
        return {
            name: loc.name || "Custom Location",
            lat: loc.lat,
            lng: loc.lng,
            timezone
        }
    }

    // Priority 2: 當日首個帶座標的景點
    for (const act of activities) {
        if (act.lat && act.lng) {
            const lat = typeof act.lat === "string" ? parseFloat(act.lat) : act.lat
            const lng = typeof act.lng === "string" ? parseFloat(act.lng) : act.lng
            if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                return {
                    name: act.place || "Spot Location",
                    lat,
                    lng,
                    timezone: "Asia/Tokyo"
                }
            }
        }
    }

    // Priority 3: 行程標題模糊匹配熱門城市
    if (tripTitle) {
        for (const [cityName, coords] of Object.entries(CITY_COORDS)) {
            if (tripTitle.includes(cityName)) {
                return {
                    name: coords.name,
                    lat: coords.lat,
                    lng: coords.lng,
                    timezone: coords.timezone
                }
            }
        }
    }

    // Priority 4: 終極兜底 (東京)
    return {
        name: "東京",
        lat: 35.6895,
        lng: 139.6917,
        timezone: "Asia/Tokyo"
    }
}
