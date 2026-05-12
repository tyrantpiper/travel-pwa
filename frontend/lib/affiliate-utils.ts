// 📍 frontend/lib/affiliate-utils.ts
// Trip Context Builder — extracts booking-relevant data from existing trip state
// Data sources:
//   - activeTrip (trip-context.tsx) → title, start_date, end_date, members
//   - activeTripData (useTripDetail hook) → flight_info, hotel_info

import type { TripContext } from './affiliate-config'

/**
 * Destination → ISO 3166-1 alpha-2 country code mapping.
 * Used by Airalo to deep link to the correct country eSIM page.
 * Keys are lowercase for case-insensitive matching.
 */
const DESTINATION_COUNTRY_MAP: Record<string, string> = {
  // Japan
  '東京': 'JP', 'tokyo': 'JP', '大阪': 'JP', 'osaka': 'JP',
  '京都': 'JP', 'kyoto': 'JP', '北海道': 'JP', 'hokkaido': 'JP',
  '沖繩': 'JP', 'okinawa': 'JP', '福岡': 'JP', 'fukuoka': 'JP',
  '名古屋': 'JP', 'nagoya': 'JP', '奈良': 'JP', 'nara': 'JP',
  '廣島': 'JP', 'hiroshima': 'JP', 'japan': 'JP', '日本': 'JP',
  // South Korea
  '首爾': 'KR', 'seoul': 'KR', '釜山': 'KR', 'busan': 'KR',
  '濟州': 'KR', 'jeju': 'KR', '仁川': 'KR', 'incheon': 'KR',
  'korea': 'KR', '韓國': 'KR',
  // Thailand
  '曼谷': 'TH', 'bangkok': 'TH', '清邁': 'TH', '普吉': 'TH',
  'phuket': 'TH', 'thailand': 'TH', '泰國': 'TH',
  // Vietnam
  '河內': 'VN', 'hanoi': 'VN', '胡志明': 'VN', '峴港': 'VN',
  'danang': 'VN', 'vietnam': 'VN', '越南': 'VN',
  // Hong Kong
  '香港': 'HK', 'hong kong': 'HK',
  // Singapore
  '新加坡': 'SG', 'singapore': 'SG',
  // Taiwan
  '台北': 'TW', 'taipei': 'TW', '高雄': 'TW', '台中': 'TW',
  '台南': 'TW', '花蓮': 'TW', 'taiwan': 'TW', '台灣': 'TW',
  // USA
  '紐約': 'US', 'new york': 'US', '洛杉磯': 'US', 'los angeles': 'US',
  '舊金山': 'US', 'san francisco': 'US', '拉斯維加斯': 'US',
  'las vegas': 'US', 'usa': 'US', '美國': 'US',
  // UK
  '倫敦': 'GB', 'london': 'GB', '愛丁堡': 'GB', 'edinburgh': 'GB',
  'uk': 'GB', '英國': 'GB',
  // France
  '巴黎': 'FR', 'paris': 'FR', '尼斯': 'FR', 'nice': 'FR',
  'france': 'FR', '法國': 'FR',
  // Italy
  '羅馬': 'IT', 'rome': 'IT', '米蘭': 'IT', 'milan': 'IT',
  '威尼斯': 'IT', 'venice': 'IT', '佛羅倫斯': 'IT', 'florence': 'IT',
  'italy': 'IT', '義大利': 'IT',
  // Australia
  '雪梨': 'AU', 'sydney': 'AU', '墨爾本': 'AU', 'melbourne': 'AU',
  'australia': 'AU', '澳洲': 'AU',
  // Malaysia
  '吉隆坡': 'MY', 'kuala lumpur': 'MY', 'malaysia': 'MY', '馬來西亞': 'MY',
  // Philippines
  '馬尼拉': 'PH', 'manila': 'PH', '長灘島': 'PH', 'boracay': 'PH',
  'philippines': 'PH', '菲律賓': 'PH',
  // Indonesia
  '峇里島': 'ID', 'bali': 'ID', '雅加達': 'ID', 'jakarta': 'ID',
  'indonesia': 'ID', '印尼': 'ID',
}

/**
 * Resolve a destination string to an ISO country code.
 * Tries exact match first, then prefix match.
 */
export function extractCountryCode(destination?: string): string | undefined {
  if (!destination) return undefined
  const key = destination.toLowerCase().trim()

  // Exact match
  if (DESTINATION_COUNTRY_MAP[key]) return DESTINATION_COUNTRY_MAP[key]

  // Prefix match (e.g. "東京都" → "東京" → JP)
  for (const [pattern, code] of Object.entries(DESTINATION_COUNTRY_MAP)) {
    if (key.startsWith(pattern) || pattern.startsWith(key)) return code
  }

  return undefined
}

/**
 * Extract destination from trip title using common patterns.
 * Examples:
 *   "東京 5 日遊" → "東京"
 *   "Japan Trip 2026" → "Japan"
 *   "Seoul & Busan Adventure" → "Seoul"
 *   "大阪 京都 自由行" → "大阪"
 */
export function extractDestination(tripTitle?: string): string | undefined {
  if (!tripTitle) return undefined

  // Remove common suffixes/patterns
  const cleaned = tripTitle
    .replace(/\d+\s*(日|天|days?|nights?)/gi, '')   // "5日遊", "7 days"
    .replace(/(遊|旅行|自由行|行程|trip|adventure|vacation|tour)/gi, '')
    .replace(/\d{4}/g, '')                           // Year like "2026"
    .replace(/[&＆、]/g, ' ')                         // Split conjunctions
    .trim()

  if (!cleaned) return undefined

  // Take the first meaningful word/phrase
  const parts = cleaned.split(/\s+/).filter(p => p.length > 0)
  return parts[0] || undefined
}

/**
 * Extract flight context from flight_info structure.
 * Matches info-view.tsx L149-152 data shape:
 *   activeTripData.flight_info?.outbound[0]?.dep_airport / arr_airport
 */
export function extractFlightContext(flightInfo: unknown): {
  departureAirport?: string
  arrivalAirport?: string
} {
  if (!flightInfo || typeof flightInfo !== 'object') return {}

  const info = flightInfo as Record<string, unknown>
  const outbound = info.outbound

  if (!Array.isArray(outbound) || outbound.length === 0) return {}

  const firstLeg = outbound[0] as Record<string, unknown> | undefined
  if (!firstLeg) return {}

  return {
    departureAirport: typeof firstLeg.dep_airport === 'string' ? firstLeg.dep_airport : undefined,
    arrivalAirport: typeof firstLeg.arr_airport === 'string' ? firstLeg.arr_airport : undefined,
  }
}

/**
 * Build a complete TripContext from existing app state.
 * This is the bridge between existing data and the affiliate system.
 *
 * Usage in info-view.tsx:
 *   const tripContext = buildTripContext(activeTrip, activeTripData)
 */
export function buildTripContext(
  activeTrip: {
    title?: string
    start_date?: string
    end_date?: string
    members?: unknown[]
  } | null | undefined,
  activeTripData: {
    flight_info?: unknown
    hotel_info?: unknown
  } | null | undefined
): TripContext {
  const destination = extractDestination(activeTrip?.title)
  const flightCtx = extractFlightContext(activeTripData?.flight_info)

  return {
    destination,
    tripTitle: activeTrip?.title,
    checkinDate: activeTrip?.start_date || undefined,
    checkoutDate: activeTrip?.end_date || undefined,
    travelers: Array.isArray(activeTrip?.members) ? activeTrip.members.length : undefined,
    departureAirport: flightCtx.departureAirport,
    arrivalAirport: flightCtx.arrivalAirport,
    countryCode: extractCountryCode(destination),
  }
}
