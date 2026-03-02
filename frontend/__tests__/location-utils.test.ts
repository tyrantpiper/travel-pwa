import { describe, it, expect } from 'vitest'
import { extractCoordsFromUrl, isGoogleMapsUrl, isGoogleMapsShortlink } from '@/lib/location-utils'

describe('extractCoordsFromUrl', () => {
    it('should extract coords from Pattern A (@lat,lng)', () => {
        const url = 'https://www.google.com/maps/@35.6812,139.7671,17z'
        const result = extractCoordsFromUrl(url)
        expect(result.lat).toBeCloseTo(35.6812, 4)
        expect(result.lng).toBeCloseTo(139.7671, 4)
        expect(result.method).toBe('client_regex_a')
    })

    it('should extract coords from Pattern B (!3d/!4d)', () => {
        const url = 'https://www.google.com/maps/place/Tokyo+Tower/!3d35.6585805!4d139.7454329'
        const result = extractCoordsFromUrl(url)
        expect(result.lat).toBeCloseTo(35.6585805, 4)
        expect(result.lng).toBeCloseTo(139.7454329, 4)
        expect(result.method).toBe('client_regex_b')
    })

    it('should handle URL-encoded !3d via %21', () => {
        const url = 'https://www.google.com/maps/place/Test/%213d35.68%214d139.76'
        const result = extractCoordsFromUrl(url)
        expect(result.lat).toBeCloseTo(35.68, 2)
        expect(result.lng).toBeCloseTo(139.76, 2)
        expect(result.method).toBe('client_regex_b')
    })

    it('should prioritize Pattern B over Pattern A', () => {
        // URL with both patterns — B should win (more precise)
        const url = 'https://www.google.com/maps/@35.00,139.00,17z/data=!3d35.6585!4d139.7454'
        const result = extractCoordsFromUrl(url)
        expect(result.method).toBe('client_regex_b')
        expect(result.lat).toBeCloseTo(35.6585, 4)
    })

    it('should return none for URLs without coordinates', () => {
        const result = extractCoordsFromUrl('https://example.com')
        expect(result.lat).toBeNull()
        expect(result.lng).toBeNull()
        expect(result.method).toBe('none')
    })

    it('should return none for empty string', () => {
        const result = extractCoordsFromUrl('')
        expect(result.method).toBe('none')
    })
})

describe('isGoogleMapsUrl', () => {
    it('should match google.com/maps', () => {
        expect(isGoogleMapsUrl('https://www.google.com/maps/place/Tokyo')).toBe(true)
    })

    it('should match google.co.jp/maps', () => {
        expect(isGoogleMapsUrl('https://www.google.co.jp/maps/@35,139')).toBe(true)
    })

    it('should match maps.app.goo.gl shortlinks', () => {
        expect(isGoogleMapsUrl('https://maps.app.goo.gl/abc123')).toBe(true)
    })

    it('should return false for non-maps URLs', () => {
        expect(isGoogleMapsUrl('https://www.google.com/search?q=hello')).toBe(false)
    })

    it('should return false for null/undefined', () => {
        expect(isGoogleMapsUrl(null)).toBe(false)
        expect(isGoogleMapsUrl(undefined)).toBe(false)
    })
})

describe('isGoogleMapsShortlink', () => {
    it('should match goo.gl shortlinks', () => {
        expect(isGoogleMapsShortlink('https://goo.gl/maps/abc')).toBe(true)
    })

    it('should match maps.app.goo.gl', () => {
        expect(isGoogleMapsShortlink('https://maps.app.goo.gl/xyz')).toBe(true)
    })

    it('should not match standard google.com/maps', () => {
        expect(isGoogleMapsShortlink('https://www.google.com/maps/place/Tokyo')).toBe(false)
    })
})
