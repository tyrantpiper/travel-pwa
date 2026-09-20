// 📍 frontend/lib/affiliate-config.ts
// Affiliate Marketing Platform Configuration + Deep Link Factory
// Based on APPROVED Travelpayouts programs (28 active as of 2026-05-03)

export type AffiliateCategory = 'all' | 'hotel' | 'flight' | 'activity' | 'transport' | 'esim' | 'insurance' | 'utility'

export interface AffiliatePlatform {
  id: string
  name: string
  emoji: string           // Replaces logo images — zero external dependency
  color: string           // Brand accent color (Tailwind text class)
  bgColor: string         // Brand background color (Tailwind bg class)
  borderColor: string     // Brand left-border color (Tailwind border class)
  category: AffiliateCategory
  description: { en: string; zh: string }
  badge?: { en: string; zh: string }  // Promotional badge
  buildUrl: (ctx: TripContext) => string
  enabled: boolean        // Auto-hidden when Affiliate ID is empty
}

export interface TripActivityItem {
  name: string
  category?: 'ticket' | 'tour' | 'pass' | 'spot'
  source: 'itinerary' | 'preset'
  city?: string
}

export interface TripContext {
  tripId?: string
  destination?: string
  country?: string
  countryCode?: string
  checkinDate?: string    // YYYY-MM-DD
  checkoutDate?: string   // YYYY-MM-DD
  departureCity?: string
  departureAirport?: string
  arrivalCity?: string
  arrivalAirport?: string
  travelers?: number
  tripTitle?: string
  lang?: 'zh' | 'en'
  customActivityQuery?: string
  serviceType?: 'hotel' | 'train' | 'transfer' | 'activity'
  transferRoute?: { origin: string; destination: string }
  itineraryActivities?: TripActivityItem[]
}

/**
 * 🛡️ 智慧複合查詢消毒器 (防止「羅馬 羅馬競技場」重複疊詞)
 */
export function sanitizeActivityQuery(destination?: string, activityName?: string): string {
  if (!activityName || !activityName.trim()) return destination?.trim() || ''
  if (!destination || !destination.trim()) return activityName.trim()

  const cleanDest = destination.trim()
  const cleanAct = activityName.trim()

  // 若活動名稱本身已包含目的地字串或相反，直接回傳活動名，避免重複疊詞
  if (cleanAct.toLowerCase().includes(cleanDest.toLowerCase()) || cleanDest.toLowerCase().includes(cleanAct.toLowerCase())) {
    return cleanAct
  }
  return `${cleanDest} ${cleanAct}`
}

// --- Affiliate IDs (Public tracking codes — safe for NEXT_PUBLIC_) ---
const AFFILIATE_IDS = {
  travelpayouts:  process.env.NEXT_PUBLIC_TP_MARKER || '',
  klook:          process.env.NEXT_PUBLIC_KLOOK_AID || '',
  kkday:          process.env.NEXT_PUBLIC_KKDAY_AID || '',
  airalo:         process.env.NEXT_PUBLIC_AIRALO_REF || '',
  // --- Direct OTA Partners ---
  tripAllianceId: process.env.NEXT_PUBLIC_TRIP_ALLIANCEID || '',
  tripSid:        process.env.NEXT_PUBLIC_TRIP_SID || '',
  agoda:          process.env.NEXT_PUBLIC_AGODA_CID || '',
  booking:        process.env.NEXT_PUBLIC_BOOKING_AID || '',
  cjPid:          process.env.NEXT_PUBLIC_CJ_PID || '',
} as const

// --- Helper: Format date for URL params ---
function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  // Ensure YYYY-MM-DD format
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().split('T')[0]
}

// --- Helper: Build URLs for proxy servers ---

/**
 * Builds standard tp.media redirect URL
 * Program IDs extracted from Travelpayouts Link Generator redirect analysis
 */
function buildTpMediaUrl(marker: string, programId: number, targetUrl: string): string {
  if (!marker) return targetUrl
  const encodedUrl = encodeURIComponent(targetUrl)
  return `https://tp.media/r?marker=${encodeURIComponent(marker)}&p=${programId}&u=${encodedUrl}`
}

/**
 * Builds legacy cXXX redirect URL for platforms that don't support tp.media standard
 */
function buildLegacyTpUrl(marker: string, serverId: string, promoId: number, targetUrl?: string): string {
  const base = `https://${serverId}.travelpayouts.com/click?shmarker=${marker}&promo_id=${promoId}&source_type=customlink&type=click`
  if (targetUrl) {
    return `${base}&custom_url=${encodeURIComponent(targetUrl)}`
  }
  return base
}

// --- Platform Registry (Only APPROVED programs) ---
export const AFFILIATE_PLATFORMS: AffiliatePlatform[] = [

  // ============================================================
  // ===== HOTELS =====
  // ============================================================
  {
    id: 'tripcom',
    name: 'Trip.com',
    emoji: '🌏',
    color: 'text-sky-700 dark:text-sky-400',
    bgColor: 'bg-sky-50 dark:bg-sky-950/30',
    borderColor: 'border-sky-600',
    category: 'hotel',
    description: {
      en: 'Hotels, flights & trains with best price guarantee',
      zh: '飯店、機票、火車票，最低價保證',
    },
    badge: { en: 'Best Price', zh: '最低價保證' },
    buildUrl: (ctx) => {
      let target = 'https://www.trip.com'
      if (ctx.serviceType === 'train') {
        // 歐美鐵路 vs 亞洲鐵路路由分流
        const isEurope = /義大利|法國|英國|德國|瑞士|西班牙|歐洲|奧地利|荷蘭|比利時|捷克|Italy|France|UK|Germany|Switzerland|Spain|Europe/i.test(ctx.destination || '')
        target = isEurope ? 'https://www.trip.com/trains/eu/' : 'https://www.trip.com/trains/'
      } else {
        const base = 'https://www.trip.com/hotels/list'
        const params = new URLSearchParams()
        if (ctx.destination) params.set('city', ctx.destination)
        if (ctx.checkinDate) params.set('checkin', formatDate(ctx.checkinDate))
        if (ctx.checkoutDate) params.set('checkout', formatDate(ctx.checkoutDate))
        target = params.toString() ? `${base}?${params}` : base
      }

      // Direct Track: Trip.com Alliance ID + Site ID
      if (AFFILIATE_IDS.tripAllianceId && AFFILIATE_IDS.tripSid) {
        const url = new URL(target)
        url.searchParams.set('Allianceid', AFFILIATE_IDS.tripAllianceId)
        url.searchParams.set('SID', AFFILIATE_IDS.tripSid)
        return url.toString()
      }
      // Fallback: Travelpayouts proxy (program 121)
      return buildLegacyTpUrl(AFFILIATE_IDS.travelpayouts, 'c121', 3778, target)
    },
    enabled: !!(AFFILIATE_IDS.tripAllianceId && AFFILIATE_IDS.tripSid) || !!AFFILIATE_IDS.travelpayouts,
  },
  {
    id: 'agoda',
    name: 'Agoda',
    emoji: '🏨',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-600',
    category: 'hotel',
    description: {
      en: 'Great deals on hotels, homes & apartments worldwide',
      zh: '全球飯店、公寓、民宿超值優惠',
    },
    badge: { en: 'Great Deals', zh: '超值優惠' },
    buildUrl: (ctx) => {
      const base = 'https://www.agoda.com/search'
      const params = new URLSearchParams()
      if (ctx.destination) params.set('city', ctx.destination)
      if (ctx.checkinDate) params.set('checkIn', formatDate(ctx.checkinDate))
      if (ctx.checkoutDate) params.set('checkOut', formatDate(ctx.checkoutDate))
      if (ctx.travelers) params.set('adults', String(ctx.travelers))
      const target = params.toString() ? `${base}?${params}` : base

      // Direct Track: Agoda Partner Center CID
      if (AFFILIATE_IDS.agoda) {
        const url = new URL(target)
        url.searchParams.set('cid', AFFILIATE_IDS.agoda)
        url.searchParams.set('pcs', '1')
        return url.toString()
      }
      // Fallback: Travelpayouts proxy (program 104)
      return buildLegacyTpUrl(AFFILIATE_IDS.travelpayouts, 'c104', 2854, target)
    },
    // Hidden until direct Agoda CID is obtained
    enabled: !!AFFILIATE_IDS.agoda,
  },
  {
    id: 'booking',
    name: 'Booking.com',
    emoji: '🛏️',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-700',
    category: 'hotel',
    description: {
      en: '28M+ listings — world\'s largest accommodation platform',
      zh: '全球最大住宿平台，超過 2800 萬筆房源',
    },
    badge: { en: '28M+ Listings', zh: '2800萬+房源' },
    buildUrl: (ctx) => {
      const base = 'https://www.booking.com/searchresults.html'
      const params = new URLSearchParams()
      if (ctx.destination) params.set('ss', ctx.destination)
      if (ctx.checkinDate) params.set('checkin', formatDate(ctx.checkinDate))
      if (ctx.checkoutDate) params.set('checkout', formatDate(ctx.checkoutDate))
      if (ctx.travelers) params.set('group_adults', String(ctx.travelers))
      const target = params.toString() ? `${base}?${params}` : base

      // Direct Track: Booking.com AID + label for sub-tracking
      if (AFFILIATE_IDS.booking) {
        const url = new URL(target)
        url.searchParams.set('aid', AFFILIATE_IDS.booking)
        url.searchParams.set('label', `tabidachi_${ctx.destination || 'general'}`)
        return url.toString()
      }
      // Fallback: Travelpayouts proxy (program 84)
      return buildLegacyTpUrl(AFFILIATE_IDS.travelpayouts, 'c84', 3650, target)
    },
    // Hidden until direct Booking.com AID is obtained
    enabled: !!AFFILIATE_IDS.booking,
  },
  {
    id: 'tripadvisor',
    name: 'TripAdvisor',
    emoji: '🦉',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-600',
    category: 'hotel',
    description: {
      en: 'Read reviews & compare prices from 10B+ traveler opinions',
      zh: '超過 100 億則旅客評論，比價找最划算住宿',
    },
    badge: { en: '10B+ Reviews', zh: '百億評論' },
    buildUrl: (ctx) => {
      const targetUrl = ctx.destination
        ? `https://www.tripadvisor.com/Search?q=${encodeURIComponent(ctx.destination)}`
        : 'https://www.tripadvisor.com/'

      // CJ Deep Link: PID/type/dlg/targetURL (DO NOT encodeURIComponent the target!)
      if (AFFILIATE_IDS.cjPid) {
        return `https://www.anrdoezrs.net/links/${AFFILIATE_IDS.cjPid}/type/dlg/${targetUrl}`
      }
      // Fallback: plain URL without tracking
      return targetUrl
    },
    enabled: !!AFFILIATE_IDS.cjPid,
  },

  // ============================================================
  // ===== FLIGHTS =====
  // ============================================================
  {
    id: 'aviasales',
    name: 'Aviasales',
    emoji: '✈️',
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-50 dark:bg-sky-950/30',
    borderColor: 'border-sky-500',
    category: 'flight',
    description: {
      en: 'Compare flight prices across 700+ airlines instantly',
      zh: '即時比較 700+ 家航空公司機票價格',
    },
    badge: { en: 'Recommended', zh: '推薦' },
    buildUrl: (ctx) => {
      const marker = AFFILIATE_IDS.travelpayouts
      const dep = ctx.departureAirport?.toUpperCase()
      const arr = ctx.arrivalAirport?.toUpperCase()
      const travelers = ctx.travelers || 1

      // 安全格式化出發日期與回程日期 (DDMM)
      let depDateDDMM = ''
      let retDateDDMM = ''

      if (ctx.checkinDate) {
        const cleanDep = ctx.checkinDate.split('T')[0]
        const depParts = cleanDep.split('-')
        if (depParts.length === 3) {
          const [, mm, dd] = depParts
          depDateDDMM = `${dd.padStart(2, '0')}${mm.padStart(2, '0')}`
        }

        // 🛡️ 日期衝突防禦：僅當回程日期嚴格晚於出發日期時才加入回程，杜絕 Aviasales search launch crash
        if (ctx.checkoutDate) {
          const cleanRet = ctx.checkoutDate.split('T')[0]
          if (cleanRet > cleanDep) {
            const retParts = cleanRet.split('-')
            if (retParts.length === 3) {
              const [, rmm, rdd] = retParts
              retDateDDMM = `${rdd.padStart(2, '0')}${rmm.padStart(2, '0')}`
            }
          }
        }
      }

      // 🛡️ 官方英文國際版 Deep Link 規範 (解決俄羅斯語系與跳轉失效問題)
      if (dep && arr) {
        const route = `${dep}${depDateDDMM}${arr}${retDateDDMM}${travelers}`
        const targetUrl = `https://www.aviasales.com/search/${route}?locale=en&currency=TWD${marker ? `&marker=${marker}` : ''}`

        // 💰 官方 Travelpayouts 安全跳轉鏈 (Campaign ID: 4114)
        // 確保 100% 伺服器端記下 Affiliate Click 與 30 天追蹤 Cookie，免疫廣告阻擋
        if (marker) {
          return `https://tp.media/r?marker=${encodeURIComponent(marker)}&p=4114&u=${encodeURIComponent(targetUrl)}`
        }
        return targetUrl
      }

      // 若無航點代碼，退回英文搜尋首頁
      const fallbackTarget = `https://www.aviasales.com/?locale=en&currency=TWD${marker ? `&marker=${marker}` : ''}`
      if (marker) {
        return `https://tp.media/r?marker=${encodeURIComponent(marker)}&p=4114&u=${encodeURIComponent(fallbackTarget)}`
      }
      return fallbackTarget
    },
    enabled: !!AFFILIATE_IDS.travelpayouts,
  },
  {
    id: 'kiwi',
    name: 'Kiwi.com',
    emoji: '🥝',
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-50 dark:bg-teal-950/30',
    borderColor: 'border-teal-500',
    category: 'flight',
    description: {
      en: 'Flexible flight search with virtual interlining',
      zh: '彈性機票搜尋，支援虛擬轉機組合',
    },
    buildUrl: (ctx) => {
      const base = 'https://www.kiwi.com/deep'
      const params = new URLSearchParams()
      if (ctx.destination) params.set('destination', ctx.destination)
      if (ctx.checkinDate) params.set('departure', formatDate(ctx.checkinDate))
      const target = params.toString() ? `${base}?${params.toString()}` : base
      return buildLegacyTpUrl(AFFILIATE_IDS.travelpayouts, 'c111', 3791, target)
    },
    enabled: !!AFFILIATE_IDS.travelpayouts,
  },
  {
    id: 'airhelp',
    name: 'AirHelp',
    emoji: '🛫',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-500',
    category: 'flight',
    description: {
      en: 'Claim up to €600 for delayed or cancelled flights',
      zh: '航班延誤或取消？最高可索賠 €600',
    },
    badge: { en: 'Hot', zh: '熱門' },
    buildUrl: () => {
      return buildLegacyTpUrl(AFFILIATE_IDS.travelpayouts, 'c120', 3665, 'https://www.airhelp.com/')
    },
    enabled: !!AFFILIATE_IDS.travelpayouts,
  },

  // ============================================================
  // ===== ACTIVITIES (Klook + KKday + Tiqets + WeGoTrip) =====
  // ============================================================
  {
    id: 'klook',
    name: 'Klook',
    emoji: '🎫',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-500',
    category: 'activity',
    description: {
      en: 'Book tours, attractions & experiences worldwide',
      zh: '全球景點門票、一日遊、體驗活動預訂',
    },
    badge: { en: 'Asia #1', zh: '亞太第一' },
    buildUrl: (ctx) => {
      const query = sanitizeActivityQuery(ctx.destination, ctx.customActivityQuery)
      const langPath = ctx.lang === 'en' ? 'en-US' : 'zh-TW'
      const queryStr = query ? `?query=${encodeURIComponent(query)}` : ''
      const target = `https://www.klook.com/${langPath}/search/result/${queryStr}`
      // Klook tracking is managed by Travelpayouts (Program ID: 4110)
      return buildTpMediaUrl(AFFILIATE_IDS.travelpayouts, 4110, target)
    },
    enabled: !!AFFILIATE_IDS.travelpayouts,
  },
  {
    id: 'kkday',
    name: 'KKday',
    emoji: '🎪',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-500',
    category: 'activity',
    description: {
      en: 'Local tours & unique experiences curated by locals',
      zh: '在地人精選行程與獨特旅遊體驗',
    },
    badge: { en: 'Local Tours', zh: '精選行程' },
    buildUrl: (ctx) => {
      const keyword = sanitizeActivityQuery(ctx.destination, ctx.customActivityQuery)
      const langPath = ctx.lang === 'en' ? 'en' : 'zh-tw'
      const queryStr = keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''
      const target = `https://www.kkday.com/${langPath}/product/productlist${queryStr}`
      // KKday tracking is managed by Travelpayouts (Program ID: 9074)
      return buildTpMediaUrl(AFFILIATE_IDS.travelpayouts, 9074, target)
    },
    enabled: !!AFFILIATE_IDS.travelpayouts,
  },
  {
    id: 'tiqets',
    name: 'Tiqets',
    emoji: '🎭',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-600',
    category: 'activity',
    description: {
      en: 'Skip-the-line tickets to museums & attractions',
      zh: '博物館與景點免排隊快速入場券',
    },
    buildUrl: (ctx) => {
      const query = sanitizeActivityQuery(ctx.destination, ctx.customActivityQuery)
      const base = 'https://www.tiqets.com/en/search'
      const target = query ? `${base}?q=${encodeURIComponent(query)}` : base
      return buildLegacyTpUrl(AFFILIATE_IDS.travelpayouts, 'c89', 2074, target)
    },
    enabled: !!AFFILIATE_IDS.travelpayouts,
  },
  {
    id: 'wegotrip',
    name: 'WeGoTrip',
    emoji: '🎧',
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-950/30',
    borderColor: 'border-rose-500',
    category: 'activity',
    description: {
      en: 'Audio guides & self-guided tours with tickets included',
      zh: '含門票的語音導覽與自助深度行程',
    },
    buildUrl: (ctx) => {
      const query = sanitizeActivityQuery(ctx.destination, ctx.customActivityQuery)
      const base = 'https://wegotrip.com'
      const target = query ? `${base}/search/?q=${encodeURIComponent(query)}` : base
      return buildTpMediaUrl(AFFILIATE_IDS.travelpayouts, 4487, target)
    },
    enabled: !!AFFILIATE_IDS.travelpayouts,
  },

  // ============================================================
  // ===== TRANSPORT (Kiwitaxi + Welcome Pickups + 12Go) =====
  // ============================================================
  {
    id: 'kiwitaxi',
    name: 'Kiwitaxi',
    emoji: '🚕',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    borderColor: 'border-yellow-500',
    category: 'transport',
    description: {
      en: 'Pre-book airport & city transfers worldwide',
      zh: '全球機場接送與城市包車預約',
    },
    buildUrl: (ctx) => {
      const base = 'https://kiwitaxi.com'
      let target = base
      if (ctx.transferRoute?.origin && ctx.transferRoute?.destination) {
        target = `${base}/search?from=${encodeURIComponent(ctx.transferRoute.origin)}&to=${encodeURIComponent(ctx.transferRoute.destination)}`
      } else if (ctx.arrivalAirport) {
        target = `${base}/search?text=${encodeURIComponent(ctx.arrivalAirport)}`
      } else if (ctx.destination) {
        target = `${base}/search?text=${encodeURIComponent(ctx.destination)}`
      }
      return buildLegacyTpUrl(AFFILIATE_IDS.travelpayouts, 'c1', 647, target)
    },
    enabled: !!AFFILIATE_IDS.travelpayouts,
  },
  {
    id: 'welcome-pickups',
    name: 'Welcome Pickups',
    emoji: '🤝',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-500',
    category: 'transport',
    description: {
      en: 'Local driver meets you at the airport with a sign',
      zh: '當地專車到機場舉牌迎接，安心接駁',
    },
    buildUrl: (ctx) => {
      const base = 'https://www.welcomepickups.com/'
      let target = base
      if (ctx.destination) {
        const dest = ctx.destination.toLowerCase().replace(/\s+/g, '-')
        const cityMatch = dest.match(/rome|milan|venice|florence|tokyo|osaka|kyoto|paris|london|barcelona|madrid|berlin|vienna|prague|athens|bangkok|singapore|taipei/i)
        if (cityMatch) {
          target = `${base}${cityMatch[0].toLowerCase()}/`
        }
      }
      return buildTpMediaUrl(AFFILIATE_IDS.travelpayouts, 8919, target)
    },
    enabled: !!AFFILIATE_IDS.travelpayouts,
  },
  {
    id: '12go',
    name: '12Go Asia',
    emoji: '🚆',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-500',
    category: 'transport',
    description: {
      en: 'Trains, buses, ferries & transfers across Asia',
      zh: '亞洲火車、巴士、渡輪、接駁車票券',
    },
    buildUrl: (ctx) => {
      let target = 'https://12go.asia'
      if (ctx.transferRoute?.origin && ctx.transferRoute?.destination) {
        target = `${target}/en/travel/${encodeURIComponent(ctx.transferRoute.origin.toLowerCase().replace(/\s+/g, '-'))}/${encodeURIComponent(ctx.transferRoute.destination.toLowerCase().replace(/\s+/g, '-'))}`
      } else if (ctx.destination) {
        target = `${target}/en/travel/${encodeURIComponent(ctx.destination.toLowerCase().replace(/\s+/g, '-'))}`
      }
      const marker = AFFILIATE_IDS.travelpayouts
      if (marker) {
        const separator = target.includes('?') ? '&' : '?'
        return `${target}${separator}marker=${encodeURIComponent(marker)}`
      }
      return target
    },
    enabled: !!AFFILIATE_IDS.travelpayouts,
  },

  // ============================================================
  // ===== eSIM =====
  // ============================================================
  {
    id: 'airalo',
    name: 'Airalo',
    emoji: '📶',
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50 dark:bg-violet-950/30',
    borderColor: 'border-violet-500',
    category: 'esim',
    description: {
      en: 'eSIM for 200+ countries — instant mobile data',
      zh: 'eSIM 網卡，覆蓋 200+ 國家，即買即用',
    },
    badge: { en: 'Must Have', zh: '旅行必備' },
    buildUrl: (ctx) => {
      const base = 'https://www.airalo.com'
      const target = ctx.countryCode ? `${base}/${ctx.countryCode.toLowerCase()}` : base
      
      if (AFFILIATE_IDS.airalo) {
        return `${target}?ref=${AFFILIATE_IDS.airalo}`
      }
      return buildTpMediaUrl(AFFILIATE_IDS.travelpayouts, 8310, target)
    },
    enabled: !!AFFILIATE_IDS.airalo || !!AFFILIATE_IDS.travelpayouts,
  },
  {
    id: 'yesim',
    name: 'Yesim',
    emoji: '🌍',
    color: 'text-lime-600 dark:text-lime-400',
    bgColor: 'bg-lime-50 dark:bg-lime-950/30',
    borderColor: 'border-lime-500',
    category: 'esim',
    description: {
      en: 'Global eSIM with built-in VPN — 150+ countries',
      zh: '全球 eSIM 內建 VPN，覆蓋 150+ 國家',
    },
    badge: { en: 'Built-in VPN', zh: '內建 VPN' },
    buildUrl: () => {
      return buildTpMediaUrl(AFFILIATE_IDS.travelpayouts, 5998, 'https://yesim.app/')
    },
    enabled: !!AFFILIATE_IDS.travelpayouts,
  },
  {
    id: 'saily',
    name: 'Saily',
    emoji: '🛰️',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
    borderColor: 'border-indigo-500',
    category: 'esim',
    description: {
      en: 'eSIM by NordVPN — fast, private & secure data abroad',
      zh: 'NordVPN 推出的 eSIM — 出國上網又快又安全',
    },
    buildUrl: () => {
      return buildTpMediaUrl(AFFILIATE_IDS.travelpayouts, 8979, 'https://saily.com/')
    },
    enabled: !!AFFILIATE_IDS.travelpayouts,
  },

  // ============================================================
  // ===== INSURANCE =====
  // ============================================================
  {
    id: 'ekta',
    name: 'EKTA',
    emoji: '🛡️',
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
    borderColor: 'border-cyan-500',
    category: 'insurance',
    description: {
      en: 'Travel insurance with instant digital policy — worldwide coverage',
      zh: '即時數位保單的旅遊保險，全球理賠',
    },
    badge: { en: 'Global', zh: '全球理賠' },
    buildUrl: () => {
      return buildTpMediaUrl(AFFILIATE_IDS.travelpayouts, 4552, 'https://www.visitorscoverage.com/')
    },
    // ⚠️ Temporarily disabled — EKTA website under maintenance (TP announcement June 2026)
    enabled: false,
  },

  // ============================================================
  // ===== UTILITY (Radical Storage + NordVPN) =====
  // ============================================================
  {
    id: 'radical-storage',
    name: 'Radical Storage',
    emoji: '🧳',
    color: 'text-pink-600 dark:text-pink-400',
    bgColor: 'bg-pink-50 dark:bg-pink-950/30',
    borderColor: 'border-pink-500',
    category: 'utility',
    description: {
      en: 'Luggage storage near stations & attractions — €5/day',
      zh: '車站或景點旁的行李寄放，每件每天 €5',
    },
    buildUrl: (ctx) => {
      const base = 'https://radicalstorage.com'
      const target = ctx.destination ? `${base}/search?q=${encodeURIComponent(ctx.destination)}` : base
      return buildTpMediaUrl(AFFILIATE_IDS.travelpayouts, 5867, target)
    },
    enabled: !!AFFILIATE_IDS.travelpayouts,
  },
  {
    id: 'nordvpn',
    name: 'NordVPN',
    emoji: '🔒',
    color: 'text-blue-800 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-700',
    category: 'utility',
    description: {
      en: 'Protect your data on public Wi-Fi while traveling',
      zh: '出國時保護你在公共 Wi-Fi 上的資料安全',
    },
    buildUrl: () => {
      return `https://nordvpn.com/?marker=${AFFILIATE_IDS.travelpayouts}`
    },
    enabled: !!AFFILIATE_IDS.travelpayouts,
  },
]

// --- Utility Functions ---

/** Get all platforms with a valid (non-empty) Affiliate ID */
export function getEnabledPlatforms(): AffiliatePlatform[] {
  return AFFILIATE_PLATFORMS.filter(p => p.enabled)
}

/** Get enabled platforms filtered by category */
export function getPlatformsByCategory(cat: AffiliateCategory): AffiliatePlatform[] {
  if (cat === 'all') return getEnabledPlatforms()
  return getEnabledPlatforms().filter(p => p.category === cat)
}

/** Get all unique categories that have at least one enabled platform */
export function getAvailableCategories(): AffiliateCategory[] {
  const cats = new Set(getEnabledPlatforms().map(p => p.category))
  return ['all', ...Array.from(cats)] as AffiliateCategory[]
}
