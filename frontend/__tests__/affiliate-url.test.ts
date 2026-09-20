import { describe, it, expect } from 'vitest'
import { AFFILIATE_PLATFORMS, type TripContext, sanitizeActivityQuery } from '@/lib/affiliate-config'
import { resolveRecommendedActivities } from '@/lib/activity-mapping'
import { buildTripContext } from '@/lib/affiliate-utils'

describe('Aviasales buildUrl and tracking resilience', () => {
  const aviasales = AFFILIATE_PLATFORMS.find(p => p.id === 'aviasales')!

  it('aviasales platform must be defined and configured', () => {
    expect(aviasales).toBeDefined()
    expect(aviasales.id).toBe('aviasales')
  })

  it('cleans up invalid checkoutDate when checkoutDate is earlier than checkinDate (prevents search launch crash)', () => {
    const invalidContext: TripContext = {
      departureAirport: 'TPE',
      arrivalAirport: 'FCO',
      checkinDate: '2027-01-02',
      checkoutDate: '2026-09-25', // Inverted date!
      travelers: 1,
    }

    const url = aviasales.buildUrl(invalidContext)
    const decodedUrl = decodeURIComponent(url)
    expect(decodedUrl).toContain('TPE0201FCO1')
    expect(decodedUrl).not.toContain('FCO2509')
  })

  it('generates one-way route when checkoutDate is omitted', () => {
    const oneWayContext: TripContext = {
      departureAirport: 'TPE',
      arrivalAirport: 'NRT',
      checkinDate: '2026-11-17',
      travelers: 1,
    }

    const url = aviasales.buildUrl(oneWayContext)
    const decodedUrl = decodeURIComponent(url)
    expect(decodedUrl).toContain('TPE1711NRT1')
    expect(decodedUrl).toContain('locale=en')
    expect(decodedUrl).toContain('currency=TWD')
  })

  it('generates valid round-trip route when checkoutDate is strictly after checkinDate', () => {
    const roundTripContext: TripContext = {
      departureAirport: 'TPE',
      arrivalAirport: 'FCO',
      checkinDate: '2026-10-01',
      checkoutDate: '2026-10-10',
      travelers: 1,
    }

    const url = aviasales.buildUrl(roundTripContext)
    const decodedUrl = decodeURIComponent(url)
    expect(decodedUrl).toContain('TPE0110FCO10101')
  })

  it('wraps destination with official Travelpayouts tp.media redirect tracking when marker is present', () => {
    const context: TripContext = {
      departureAirport: 'TPE',
      arrivalAirport: 'FCO',
      checkinDate: '2026-10-01',
    }

    const url = aviasales.buildUrl(context)
    if (process.env.NEXT_PUBLIC_TP_MARKER) {
      expect(url).toContain('https://tp.media/r?')
      expect(url).toContain('p=4114')
      expect(url).toContain(`marker=${process.env.NEXT_PUBLIC_TP_MARKER}`)
      expect(url).toContain('u=https%3A%2F%2Fwww.aviasales.com')
    } else {
      expect(url).toContain('https://www.aviasales.com')
    }
  })
})

describe('Activity platforms (Klook & KKday) tracking and query sanitization', () => {
  const klook = AFFILIATE_PLATFORMS.find(p => p.id === 'klook')!
  const kkday = AFFILIATE_PLATFORMS.find(p => p.id === 'kkday')!

  it('klook and kkday platforms must be defined', () => {
    expect(klook).toBeDefined()
    expect(kkday).toBeDefined()
  })

  it('sanitizeActivityQuery formats combined search terms cleanly', () => {
    expect(sanitizeActivityQuery('義大利', '羅馬競技場')).toBe('義大利 羅馬競技場')
    expect(sanitizeActivityQuery('義大利 羅馬', '羅馬競技場')).toBe('義大利 羅馬 羅馬競技場')
    expect(sanitizeActivityQuery('東京', '東京迪士尼')).toBe('東京迪士尼') // Substring deduplication!
    expect(sanitizeActivityQuery('巴黎', '')).toBe('巴黎')
    expect(sanitizeActivityQuery(undefined, '貢多拉')).toBe('貢多拉')
  })

  it('klook.buildUrl routes to official tp.media (Campaign 4110) with localized URL', () => {
    const context: TripContext = {
      destination: '義大利',
      customActivityQuery: '羅馬競技場',
      lang: 'zh',
    }
    const url = klook.buildUrl(context)
    if (process.env.NEXT_PUBLIC_TP_MARKER) {
      expect(url).toContain('https://tp.media/r?')
      expect(url).toContain('p=4110')
      expect(url).toContain(`marker=${process.env.NEXT_PUBLIC_TP_MARKER}`)
      expect(url).toContain('klook.com%2Fzh-TW%2Fsearch%2Fresult%2F%3Fquery%3D')
    } else {
      expect(url).toContain('klook.com/zh-TW/search/result/')
      expect(url).toContain('query=')
    }
  })

  it('kkday.buildUrl routes to official tp.media (Campaign 9074) with localized URL', () => {
    const context: TripContext = {
      destination: '日本',
      customActivityQuery: '環球影城',
      lang: 'en',
    }
    const url = kkday.buildUrl(context)
    if (process.env.NEXT_PUBLIC_TP_MARKER) {
      expect(url).toContain('https://tp.media/r?')
      expect(url).toContain('p=9074')
      expect(url).toContain(`marker=${process.env.NEXT_PUBLIC_TP_MARKER}`)
      expect(url).toContain('kkday.com%2Fen%2Fproduct%2Fproductlist%3Fkeyword%3D')
    } else {
      expect(url).toContain('kkday.com/en/product/productlist')
      expect(url).toContain('keyword=')
    }
  })
})

describe('resolveRecommendedActivities & buildTripContext integration', () => {
  it('resolves curated activities for Italy when no itinerary spots provided', () => {
    const activities = resolveRecommendedActivities('義大利', [], 'zh')
    expect(activities.length).toBeGreaterThanOrEqual(4)
    expect(activities.some(a => a.name.includes('羅馬競技場'))).toBe(true)
    expect(activities[0].source).toBe('preset')
  })

  it('prioritizes user itinerary spots and labels source as itinerary', () => {
    const spots = ['米蘭大教堂', '比薩斜塔']
    const activities = resolveRecommendedActivities('義大利', spots, 'zh')
    expect(activities[0].name).toBe('米蘭大教堂')
    expect(activities[0].source).toBe('itinerary')
    expect(activities[1].name).toBe('比薩斜塔')
    expect(activities[1].source).toBe('itinerary')
    // Preset items backfill remaining slots
    expect(activities.length).toBeGreaterThanOrEqual(4)
  })

  it('buildTripContext integrates destination, airport inference, and itinerary spots', () => {
    const activeTrip = {
      id: 'trip-italy-123',
      title: '義大利10日夢幻之旅',
      start_date: '2026-10-01',
      end_date: '2026-10-10',
      members: [{}, {}],
    }
    const activeTripData = {
      days: [
        { activities: [{ place_name: '梵蒂岡博物館' }] },
      ],
      day_tickets: {
        1: [{ name: '貢多拉搭乘券' }],
      },
    }

    const ctx = buildTripContext(activeTrip, activeTripData, 'zh')
    expect(ctx.tripId).toBe('trip-italy-123')
    expect(ctx.destination).toBe('義大利')
    expect(ctx.arrivalAirport).toBe('FCO') // Auto inferred from Italy!
    expect(ctx.departureAirport).toBe('TPE')
    expect(ctx.itineraryActivities).toBeDefined()
    expect(ctx.itineraryActivities!.some(a => a.name === '梵蒂岡博物館')).toBe(true)
    expect(ctx.itineraryActivities!.some(a => a.name === '貢多拉搭乘券')).toBe(true)
  })
})

describe('Tiqets & WeGoTrip ticketing & audio guide deep linking', () => {
  const tiqets = AFFILIATE_PLATFORMS.find(p => p.id === 'tiqets')!
  const wegotrip = AFFILIATE_PLATFORMS.find(p => p.id === 'wegotrip')!

  it('tiqets.buildUrl passes sanitized activity query', () => {
    const ctx: TripContext = {
      destination: '義大利',
      customActivityQuery: '羅馬競技場',
    }
    const url = tiqets.buildUrl(ctx)
    const decodedUrl = decodeURIComponent(decodeURIComponent(url))
    expect(decodedUrl).toContain('tiqets.com/en/search')
    expect(decodedUrl).toContain('q=義大利 羅馬競技場')
  })

  it('wegotrip.buildUrl passes sanitized activity query through tp.media (Campaign 4487)', () => {
    const ctx: TripContext = {
      destination: '義大利',
      customActivityQuery: '烏菲茲美術館',
    }
    const url = wegotrip.buildUrl(ctx)
    if (process.env.NEXT_PUBLIC_TP_MARKER) {
      expect(url).toContain('https://tp.media/r?')
      expect(url).toContain('p=4487')
    }
    const decodedUrl = decodeURIComponent(decodeURIComponent(url))
    expect(decodedUrl).toContain('search/?q=義大利 烏菲茲美術館')
  })
})

describe('Transport platforms (Kiwitaxi, Welcome Pickups, 12Go) deep linking', () => {
  const kiwitaxi = AFFILIATE_PLATFORMS.find(p => p.id === 'kiwitaxi')!
  const welcome = AFFILIATE_PLATFORMS.find(p => p.id === 'welcome-pickups')!
  const twelveGo = AFFILIATE_PLATFORMS.find(p => p.id === '12go')!

  it('kiwitaxi.buildUrl supports direct transfer routes and airport fallbacks', () => {
    const routeCtx: TripContext = {
      destination: '義大利',
      transferRoute: { origin: 'FCO Airport', destination: 'Rome Termini' },
    }
    const url = kiwitaxi.buildUrl(routeCtx)
    const decodedUrl = decodeURIComponent(decodeURIComponent(url))
    expect(decodedUrl).toContain('from=FCO Airport&to=Rome Termini')

    const airportCtx: TripContext = {
      destination: '義大利',
      arrivalAirport: 'FCO',
    }
    const airportUrl = kiwitaxi.buildUrl(airportCtx)
    const decodedAirportUrl = decodeURIComponent(decodeURIComponent(airportUrl))
    expect(decodedAirportUrl).toContain('text=FCO')
  })

  it('welcome-pickups.buildUrl matches city destinations to official landing pages', () => {
    const ctx: TripContext = {
      destination: 'Rome, Italy',
    }
    const url = welcome.buildUrl(ctx)
    if (process.env.NEXT_PUBLIC_TP_MARKER) {
      expect(url).toContain('https://tp.media/r?')
      expect(url).toContain('p=8919')
    }
    const decodedUrl = decodeURIComponent(decodeURIComponent(url))
    expect(decodedUrl).toContain('welcomepickups.com/rome/')
  })

  it('12go.buildUrl formats route and includes direct Travelpayouts marker tracking (prevents tp.media promo not found)', () => {
    const ctx: TripContext = {
      destination: 'Thailand',
      transferRoute: { origin: 'Bangkok', destination: 'Chiang Mai' },
    }
    const url = twelveGo.buildUrl(ctx)
    // 🛡️ 官方防禦：12Go 在 Travelpayouts 為直連標籤型合作商，絕不可經由 tp.media p=1024（會導致 404 promo not found）
    expect(url).not.toContain('tp.media/r?')
    if (process.env.NEXT_PUBLIC_TP_MARKER) {
      expect(url).toContain(`marker=${encodeURIComponent(process.env.NEXT_PUBLIC_TP_MARKER)}`)
    }
    const decodedUrl = decodeURIComponent(url)
    expect(decodedUrl).toContain('12go.asia/en/travel/bangkok/chiang-mai')
  })
})

describe('Trip.com polymorphic buildUrl (Hotels vs Trains)', () => {
  const tripCom = AFFILIATE_PLATFORMS.find(p => p.id === 'tripcom')!

  it('buildUrl generates hotel search by default with dates', () => {
    const ctx: TripContext = {
      destination: 'Rome',
      checkinDate: '2026-10-01',
      checkoutDate: '2026-10-10',
    }
    const url = tripCom.buildUrl(ctx)
    const decodedUrl = decodeURIComponent(decodeURIComponent(url))
    expect(decodedUrl).toContain('trip.com/hotels/list')
    expect(decodedUrl).toContain('city=Rome')
    expect(decodedUrl).toContain('checkin=2026-10-01')
    expect(decodedUrl).toContain('checkout=2026-10-10')
  })

  it('buildUrl generates European train search when serviceType is train and destination is Europe', () => {
    const ctx: TripContext = {
      destination: '義大利 羅馬',
      serviceType: 'train',
    }
    const url = tripCom.buildUrl(ctx)
    const decodedUrl = decodeURIComponent(decodeURIComponent(url))
    expect(decodedUrl).toContain('trip.com/trains/eu/')
  })

  it('buildUrl generates Asian train search when serviceType is train and destination is in Asia', () => {
    const ctx: TripContext = {
      destination: '日本 東京',
      serviceType: 'train',
    }
    const url = tripCom.buildUrl(ctx)
    const decodedUrl = decodeURIComponent(decodeURIComponent(url))
    expect(decodedUrl).toContain('trip.com/trains/')
    expect(decodedUrl).not.toContain('/trains/eu/')
  })

  it('platform ID contract guard: ensures core platforms match AffiliateCard handlers without drift', () => {
    const platformIds = AFFILIATE_PLATFORMS.map(p => p.id)
    expect(platformIds).toContain('tripcom')
    expect(platformIds).toContain('aviasales')
    expect(platformIds).toContain('12go')
    expect(platformIds).toContain('klook')
    expect(platformIds).toContain('kkday')
    expect(platformIds).toContain('tiqets')
    expect(platformIds).toContain('wegotrip')
    expect(platformIds).toContain('kiwitaxi')
    expect(platformIds).toContain('welcome-pickups')
  })
})


