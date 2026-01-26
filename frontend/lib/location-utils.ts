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
