import { describe, it, expect, beforeEach } from 'vitest'
import { resolveDayLocation, CITY_COORDS } from '@/lib/location-resolver'
import { fetchFiveDayForecast } from '@/lib/weather-api'
import { useWeatherStore, DailyForecastItem } from '@/lib/stores/weatherStore'
import { Activity, DailyLocation } from '@/lib/itinerary-types'

describe('location-resolver: resolveDayLocation 4-tier fallback', () => {
    it('Tier 1: should prioritize manually defined daily location', () => {
        const dailyLocs: Record<number, DailyLocation> = {
            1: { name: '京都車站', lat: 34.9858, lng: 135.7588 }
        }
        const activities: Activity[] = [
            { id: '1', place: '東京鐵塔', lat: 35.6586, lng: 139.7454, time_slot: '09:00' }
        ]
        const loc = resolveDayLocation(1, dailyLocs, activities, '東京六日遊')
        expect(loc.name).toBe('京都車站')
        expect(loc.lat).toBe(34.9858)
        expect(loc.lng).toBe(135.7588)
        expect(loc.timezone).toBe('Asia/Tokyo')
    })

    it('Tier 2: should fallback to first activity with valid coordinates when dailyLocs is missing', () => {
        const activities: Activity[] = [
            { id: '1', place: '無座標景點', time_slot: '09:00' },
            { id: '2', place: '道頓堀', lat: 34.6687, lng: 135.5013, time_slot: '14:00' }
        ]
        const loc = resolveDayLocation(2, {}, activities, '日本漫遊')
        expect(loc.name).toBe('道頓堀')
        expect(loc.lat).toBe(34.6687)
        expect(loc.lng).toBe(135.5013)
    })

    it('Tier 3: should match city coordinates from trip title if no day locations or activities', () => {
        const loc = resolveDayLocation(1, {}, [], '2026 札幌雪季之旅')
        expect(loc.name).toBe('札幌')
        expect(loc.lat).toBe(CITY_COORDS['札幌'].lat)
        expect(loc.lng).toBe(CITY_COORDS['札幌'].lng)
    })

    it('Tier 4: should fallback to Tokyo default when completely unresolved', () => {
        const loc = resolveDayLocation(1, undefined, [], '隨意走走放空')
        expect(loc.name).toBe('東京')
        expect(loc.lat).toBe(35.6895)
        expect(loc.lng).toBe(139.6917)
    })
})

describe('weather-api: fetchFiveDayForecast validation defenses', () => {
    it('should return null for invalid or missing coordinates', async () => {
        expect(await fetchFiveDayForecast(NaN, 139.6917)).toBeNull()
        expect(await fetchFiveDayForecast(35.6895, NaN)).toBeNull()
        expect(await fetchFiveDayForecast(0, 0)).toBeNull()
    })
})

describe('weatherStore: 5-Day forecast cache integration', () => {
    beforeEach(() => {
        useWeatherStore.setState({ cache: {}, fiveDayCache: {} })
    })

    it('should store and retrieve 5-day daily forecast correctly', () => {
        const sampleItems: DailyForecastItem[] = [
            {
                date: '2026-09-13',
                dayLabel: '今日',
                weatherCode: 1,
                tempMax: 26,
                tempMin: 18,
                precipProb: 10
            },
            {
                date: '2026-09-14',
                dayLabel: '明日',
                weatherCode: 61,
                tempMax: 22,
                tempMin: 17,
                precipProb: 75
            }
        ]

        const store = useWeatherStore.getState()
        store.setFiveDayData(35.6895, 139.6917, '2026-09-13', sampleItems)

        const retrieved = useWeatherStore.getState().getFiveDayData(35.6895, 139.6917, '2026-09-13')
        expect(retrieved).not.toBeNull()
        expect(retrieved).toHaveLength(2)
        expect(retrieved?.[0].dayLabel).toBe('今日')
        expect(retrieved?.[1].precipProb).toBe(75)
    })

    it('should return null when cache key does not match date or coordinates', () => {
        const store = useWeatherStore.getState()
        const result = store.getFiveDayData(35.6895, 139.6917, '2026-09-99')
        expect(result).toBeNull()
    })
})
