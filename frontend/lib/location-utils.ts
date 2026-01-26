/**
 * Location Utilities (2026 Heuristic Engine)
 * Handles coordinate extraction and URL processing
 */

// Pattern A: @lat,lng
const RE_COORD_A = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
// Pattern B: !3dlat!4dlng (Protobuf style)
const RE_COORD_B = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/;

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
    // Try Pattern A (@lat,lng)
    const matchA = url.match(RE_COORD_A);
    if (matchA) {
        return {
            lat: parseFloat(matchA[1]),
            lng: parseFloat(matchA[2]),
            method: 'client_regex_a'
        };
    }

    // Try Pattern B (!3d/!4d)
    const matchB = url.match(RE_COORD_B);
    if (matchB) {
        return {
            lat: parseFloat(matchB[1]),
            lng: parseFloat(matchB[2]),
            method: 'client_regex_b'
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
