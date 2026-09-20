// 📍 frontend/__tests__/trip-switch-affiliate.test.ts
// Verifies trip-switch affiliate state synchronization, same-city guard, and direct URL generation

import { describe, it, expect } from 'vitest'
import { buildTripContext } from '@/lib/affiliate-utils'
import { resolveAirportFromDestination, getDestinationHubs } from '@/lib/airport-mapping'
import { AFFILIATE_PLATFORMS, type TripContext } from '@/lib/affiliate-config'

describe('Trip-Switch Affiliate State Synchronization & Guards', () => {
  const aviasales = AFFILIATE_PLATFORMS.find(p => p.id === 'aviasales')!

  it('TC-1: should resolve correct destination airports when switching from Italy to Tokyo', () => {
    // Trip 1: 義大利 10 日遊
    const italyTrip = {
      title: '義大利 10 日遊',
      start_date: '2026-09-21',
      end_date: '2026-09-25',
    }
    const italyCtx = buildTripContext(italyTrip, null)
    expect(italyCtx.destination).toBe('義大利')
    expect(italyCtx.arrivalAirport).toBe('FCO')
    expect(italyCtx.departureAirport).toBe('TPE')

    // Trip 2: 東京 5 日遊
    const tokyoTrip = {
      title: '東京 5 日遊',
      start_date: '2026-11-17',
      end_date: '2026-11-21',
    }
    const tokyoCtx = buildTripContext(tokyoTrip, null)
    expect(tokyoCtx.destination).toBe('東京')
    expect(tokyoCtx.arrivalAirport).toBe('NRT')
    expect(tokyoCtx.departureAirport).toBe('TPE')

    // Hub lists must be completely distinct
    const italyHubs = getDestinationHubs(italyCtx.destination)
    const tokyoHubs = getDestinationHubs(tokyoCtx.destination)
    expect(italyHubs.map(h => h.code)).toContain('FCO')
    expect(tokyoHubs.map(h => h.code)).toContain('NRT')
    expect(tokyoHubs.map(h => h.code)).not.toContain('FCO')
  })

  it('TC-2: should generate Aviasales deep link for Tokyo (TPE -> NRT) without stale Italy (FCO)', () => {
    const tokyoCtx: TripContext = {
      destination: '東京',
      departureAirport: 'TPE',
      arrivalAirport: 'NRT',
      checkinDate: '2026-11-17',
      checkoutDate: '2026-11-21',
    }

    const url = aviasales.buildUrl(tokyoCtx)
    const decodedUrl = decodeURIComponent(url)
    // Must contain TPE1711NRT21111, must NOT contain FCO
    expect(decodedUrl).toContain('TPE1711NRT21111')
    expect(decodedUrl).not.toContain('FCO')
    if (process.env.NEXT_PUBLIC_TP_MARKER) {
      expect(url).toContain('tp.media/r?marker=')
      expect(url).toContain('p=4114')
    } else {
      expect(url).toContain('https://www.aviasales.com/search/')
    }
  })

  it('TC-3: same-city guard: when destination is Taipei (TPE -> TPE), route validity check prevents search', () => {
    const taipeiTrip = {
      title: '3 Day Taipei Explorer ✨',
      start_date: '2026-09-21',
      end_date: '2026-09-23',
    }
    const taipeiCtx = buildTripContext(taipeiTrip, null)
    const selectedOrigin = taipeiCtx.departureAirport || 'TPE'
    const selectedArrival = taipeiCtx.arrivalAirport || resolveAirportFromDestination(taipeiCtx.destination)

    // Route validity check logic in AffiliateCard
    const isValidRoute = !!selectedArrival && !!selectedOrigin && selectedOrigin !== selectedArrival
    expect(isValidRoute).toBe(false)
  })

  it('TC-4: should handle activeTripData custom flight_info override when switching trips', () => {
    const tripWithCustomFlight = {
      title: '日本文化之旅',
      start_date: '2026-10-01',
      end_date: '2026-10-07',
    }
    const tripData = {
      flight_info: {
        outbound: [{ dep_airport: 'KHH', arr_airport: 'KIX' }],
      },
    }
    const ctx = buildTripContext(tripWithCustomFlight, tripData)
    expect(ctx.departureAirport).toBe('KHH')
    expect(ctx.arrivalAirport).toBe('KIX')

    const url = aviasales.buildUrl(ctx)
    const decodedUrl = decodeURIComponent(url)
    expect(decodedUrl).toContain('KHH0110KIX07101')
    expect(decodedUrl).not.toContain('TPE')
    expect(decodedUrl).not.toContain('FCO')
  })
})
