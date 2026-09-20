import { describe, it, expect } from 'vitest'
import {
  resolveAirportFromDestination,
  getDestinationHubs,
  getAirlineName,
  DEFAULT_ORIGIN_HUBS
} from '@/lib/airport-mapping'
import { buildTripContext } from '@/lib/affiliate-utils'

describe('airport-mapping', () => {
  describe('resolveAirportFromDestination', () => {
    it('resolves exact match cities and countries including Italy', () => {
      expect(resolveAirportFromDestination('東京')).toBe('NRT')
      expect(resolveAirportFromDestination('tokyo')).toBe('NRT')
      expect(resolveAirportFromDestination('大阪')).toBe('KIX')
      expect(resolveAirportFromDestination('首爾')).toBe('ICN')
      expect(resolveAirportFromDestination('曼谷')).toBe('BKK')
      expect(resolveAirportFromDestination('巴黎')).toBe('CDG')
      // Global & European coverage
      expect(resolveAirportFromDestination('義大利')).toBe('FCO')
      expect(resolveAirportFromDestination('italy')).toBe('FCO')
      expect(resolveAirportFromDestination('米蘭')).toBe('MXP')
      expect(resolveAirportFromDestination('威尼斯')).toBe('VCE')
      expect(resolveAirportFromDestination('瑞士')).toBe('ZRH')
      expect(resolveAirportFromDestination('西班牙')).toBe('MAD')
    })

    it('resolves substring and composite names', () => {
      expect(resolveAirportFromDestination('東京都')).toBe('NRT')
      expect(resolveAirportFromDestination('大阪府難波')).toBe('KIX')
      expect(resolveAirportFromDestination('沖繩那霸市')).toBe('OKA')
      expect(resolveAirportFromDestination('南韓首爾特別市')).toBe('ICN')
      expect(resolveAirportFromDestination('義大利羅馬假期')).toBe('FCO')
      expect(resolveAirportFromDestination('義大利蜜月 10 日遊')).toBe('FCO')
      expect(resolveAirportFromDestination('米蘭時尚之旅')).toBe('MXP')
    })

    it('returns undefined for unknown destinations or empty inputs', () => {
      expect(resolveAirportFromDestination(undefined)).toBeUndefined()
      expect(resolveAirportFromDestination('')).toBeUndefined()
      expect(resolveAirportFromDestination('未知星系')).toBeUndefined()
    })
  })

  describe('getDestinationHubs', () => {
    it('returns multiple hubs for countries like Italy', () => {
      const italyHubs = getDestinationHubs('義大利')
      expect(italyHubs.length).toBeGreaterThanOrEqual(3)
      const codes = italyHubs.map(h => h.code)
      expect(codes).toContain('FCO')
      expect(codes).toContain('MXP')
      expect(codes).toContain('VCE')
    })

    it('returns single hub fallback for specific cities', () => {
      const hubs = getDestinationHubs('曼谷')
      expect(hubs.length).toBeGreaterThanOrEqual(1)
      expect(hubs.map(h => h.code)).toContain('BKK')
    })
  })

  describe('getAirlineName', () => {
    it('returns Traditional Chinese names for known airlines', () => {
      expect(getAirlineName('JX')).toBe('星宇航空')
      expect(getAirlineName('BR')).toBe('長榮航空')
      expect(getAirlineName('CI')).toBe('中華航空')
      expect(getAirlineName('IT')).toBe('台灣虎航')
      expect(getAirlineName('MM')).toBe('樂桃航空')
      expect(getAirlineName('JL')).toBe('日本航空')
      expect(getAirlineName('NH')).toBe('全日空')
      expect(getAirlineName('AZ')).toBe('ITA 義大利航空')
      expect(getAirlineName('LH')).toBe('漢莎航空')
      expect(getAirlineName('BA')).toBe('英國航空')
    })

    it('handles lowercase airline codes', () => {
      expect(getAirlineName('jx')).toBe('星宇航空')
      expect(getAirlineName('br')).toBe('長榮航空')
      expect(getAirlineName('az')).toBe('ITA 義大利航空')
    })

    it('falls back to raw code for unknown airlines', () => {
      expect(getAirlineName('XYZ')).toBe('XYZ')
    })

    it('returns default fallback when undefined', () => {
      expect(getAirlineName(undefined)).toBe('航空公司')
    })
  })

  describe('DEFAULT_ORIGIN_HUBS', () => {
    it('contains major hubs for Taiwan and surrounding regions', () => {
      expect(DEFAULT_ORIGIN_HUBS).toContain('TPE')
      expect(DEFAULT_ORIGIN_HUBS).toContain('TSA')
      expect(DEFAULT_ORIGIN_HUBS).toContain('KHH')
      expect(DEFAULT_ORIGIN_HUBS).toContain('HKG')
    })
  })

  describe('buildTripContext integration with airport inference', () => {
    it('automatically infers arrival airport and sets TPE departure for Italy', () => {
      const mockTrip = {
        title: '義大利 10 日遊',
        start_date: '2026-10-01',
        end_date: '2026-10-10',
        members: [{ id: 'u1' }],
      }

      const context = buildTripContext(mockTrip, null)
      expect(context.destination).toBe('義大利')
      expect(context.arrivalAirport).toBe('FCO')
      expect(context.departureAirport).toBe('TPE')
    })

    it('preserves manual flight info when explicitly provided in trip data', () => {
      const mockTrip = {
        title: '義大利 10 日遊',
      }
      const mockTripData = {
        flight_info: {
          outbound: [
            {
              dep_airport: 'KHH',
              arr_airport: 'MXP',
            }
          ]
        }
      }

      const context = buildTripContext(mockTrip, mockTripData)
      expect(context.departureAirport).toBe('KHH')
      expect(context.arrivalAirport).toBe('MXP')
    })
  })
})
