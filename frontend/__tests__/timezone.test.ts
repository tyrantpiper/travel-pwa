import { describe, it, expect } from 'vitest'
import {
    TRAVEL_TIMEZONES,
    getUserTimezone,
    getTimezoneOffset,
    getTimezoneLabel,
    getTimezoneByAirport,
    getTimeDiffLabel,
} from '@/lib/timezone'

describe('TRAVEL_TIMEZONES', () => {
    it('should contain Tokyo with Asia/Tokyo timezone', () => {
        expect(TRAVEL_TIMEZONES['tokyo']).toBeDefined()
        expect(TRAVEL_TIMEZONES['tokyo'].timezone).toBe('Asia/Tokyo')
        expect(TRAVEL_TIMEZONES['tokyo'].flag).toBe('🇯🇵')
    })

    it('should contain Seoul with Asia/Seoul timezone', () => {
        expect(TRAVEL_TIMEZONES['seoul']).toBeDefined()
        expect(TRAVEL_TIMEZONES['seoul'].timezone).toBe('Asia/Seoul')
    })

    it('should contain Taipei', () => {
        expect(TRAVEL_TIMEZONES['taipei']).toBeDefined()
        expect(TRAVEL_TIMEZONES['taipei'].timezone).toBe('Asia/Taipei')
    })
})

describe('getUserTimezone', () => {
    it('should return a string timezone', () => {
        const tz = getUserTimezone()
        expect(typeof tz).toBe('string')
        expect(tz.length).toBeGreaterThan(0)
    })
})

describe('getTimezoneOffset', () => {
    it('should return 0 for same timezone', () => {
        const offset = getTimezoneOffset('Asia/Tokyo', 'Asia/Tokyo')
        expect(offset).toBe(0)
    })

    it('should return 1 for Tokyo vs Taipei (JST+9 vs CST+8)', () => {
        const offset = getTimezoneOffset('Asia/Taipei', 'Asia/Tokyo')
        expect(offset).toBe(1)
    })
})

describe('getTimezoneLabel', () => {
    it('should return label with offset for known timezone', () => {
        const label = getTimezoneLabel('Asia/Tokyo')
        expect(label).toContain('+9')
    })
})

describe('getTimezoneByAirport', () => {
    it('should return Asia/Tokyo for NRT (Narita)', () => {
        expect(getTimezoneByAirport('NRT')).toBe('Asia/Tokyo')
    })

    it('should return Asia/Tokyo for HND (Haneda)', () => {
        expect(getTimezoneByAirport('HND')).toBe('Asia/Tokyo')
    })

    it('should return null for unknown airport code', () => {
        expect(getTimezoneByAirport('ZZZ')).toBeNull()
    })
})

describe('getTimeDiffLabel', () => {
    it('should return friendly diff label', () => {
        const label = getTimeDiffLabel('Asia/Taipei', 'Asia/Tokyo')
        expect(label).toContain('1')
    })
})
