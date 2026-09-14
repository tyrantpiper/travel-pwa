/**
 * Location Utilities (2026 Heuristic Engine)
 * Handles coordinate extraction and URL processing
 */

// Pattern A: @lat,lng
const RE_COORD_A = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
// 🆕 2026 Pattern B+: Non-consecutive !3d/!4d (handles intermediate params like !8m2)
const RE_LAT = /!3d(-?\d+\.\d+)/;
const RE_LNG = /!4d(-?\d+\.\d+)/;

export interface ExtractedLocation {
    lat: number | null;
    lng: number | null;
    method: 'client_regex_a' | 'client_regex_b' | 'none';
}

/**
 * ⚡ Tier 1: Client-side Regex Extraction
 * Zero-latency extraction for long URLs
 */
export function extractCoordsFromUrl(url: string): ExtractedLocation {
    if (!url) return { lat: null, lng: null, method: 'none' };

    // 🛡️ Pre-processing: Decode %21 to ! for robust matching
    const decodedUrl = decodeURIComponent(url.replace(/%21/g, '!'));

    // 🆕 Priority 1: Try Pattern B+ (!3d / !4d - Precise Pinpoint, allows gaps)
    const latMatch = decodedUrl.match(RE_LAT);
    const lngMatch = decodedUrl.match(RE_LNG);

    if (latMatch && lngMatch) {
        return {
            lat: parseFloat(latMatch[1]),
            lng: parseFloat(lngMatch[1]),
            method: 'client_regex_b'
        };
    }

    // 🆕 Priority 2: Try Pattern A (@lat,lng - Map Center Fallback)
    const matchA = decodedUrl.match(RE_COORD_A);
    if (matchA) {
        return {
            lat: parseFloat(matchA[1]),
            lng: parseFloat(matchA[2]),
            method: 'client_regex_a'
        };
    }

    return { lat: null, lng: null, method: 'none' };
}

/**
 * Check if a URL is any type of Google Maps link (shortlink or standard search)
 */
export function isGoogleMapsUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    return /goo\.gl|maps\.app\.goo\.gl|google\.(?:com|co\.jp|com\.tw)\/maps/.test(url);
}

export function isGoogleMapsShortlink(url: string): boolean {
    return /goo\.gl|maps\.app\.goo\.gl/.test(url);
}

/**
 * 📏 簡易 Haversine 距離計算 (km)
 */
export function getDistanceKm(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface SmartZoomConfig {
    zoom: number
    duration: number
}

/**
 * 依據 Photon 1.3.0 admin_level 與 osm_value/type 計算最佳相機縮放層級與飛行時長
 */
export function getSmartZoomConfig(result: {
    name?: string
    type?: string | null
    admin_level?: number | null
    osm_key?: string | null
}): SmartZoomConfig {
    const level = result.admin_level
    const type = (result.type || "").toLowerCase()

    // 1. 國家層級 (Level 2) -> 3D Globe 地球儀視野
    if (level === 2 || type === "country") {
        return { zoom: 3.5, duration: 2000 }
    }
    // 2. 州 / 省層級 (Level 3-4)
    if (level === 3 || level === 4 || type === "state" || type === "province") {
        return { zoom: 6.5, duration: 1800 }
    }
    // 3. 縣市 / 都會區層級 (Level 5-6)
    if (level === 5 || level === 6 || type === "city" || type === "county") {
        return { zoom: 10.5, duration: 1600 }
    }
    // 4. 市鎮 / 區層級 (Level 7-8)
    if (level === 7 || level === 8 || type === "district" || type === "town" || type === "suburb") {
        return { zoom: 13.5, duration: 1400 }
    }
    // 5. 一般景點、餐廳、飯店或具體門牌 (預設 POI)
    return { zoom: 16.5, duration: 1200 }
}

