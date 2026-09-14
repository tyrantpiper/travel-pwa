import { describe, it, expect } from 'vitest'
import { extractCoordsFromUrl, isGoogleMapsUrl, isGoogleMapsShortlink, getSmartZoomConfig } from '@/lib/location-utils'

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

describe('getSmartZoomConfig (Photon 1.3.0 & MapLibre Globe 3D Adapter)', () => {
    it('should map country (admin_level 2 or type country) to 3D Globe zoom (3.5)', () => {
        expect(getSmartZoomConfig({ admin_level: 2 })).toEqual({ zoom: 3.5, duration: 2000 })
        expect(getSmartZoomConfig({ type: 'country' })).toEqual({ zoom: 3.5, duration: 2000 })
        expect(getSmartZoomConfig({ name: 'Japan', admin_level: 2, type: 'country' })).toEqual({ zoom: 3.5, duration: 2000 })
    })

    it('should map state / province (admin_level 3-4) to regional zoom (6.5)', () => {
        expect(getSmartZoomConfig({ admin_level: 4 })).toEqual({ zoom: 6.5, duration: 1800 })
        expect(getSmartZoomConfig({ type: 'province' })).toEqual({ zoom: 6.5, duration: 1800 })
        expect(getSmartZoomConfig({ type: 'state' })).toEqual({ zoom: 6.5, duration: 1800 })
    })

    it('should map city / county (admin_level 5-6) to metro zoom (10.5)', () => {
        expect(getSmartZoomConfig({ admin_level: 6 })).toEqual({ zoom: 10.5, duration: 1600 })
        expect(getSmartZoomConfig({ type: 'city' })).toEqual({ zoom: 10.5, duration: 1600 })
    })

    it('should map district / town (admin_level 7-8) to locality zoom (13.5)', () => {
        expect(getSmartZoomConfig({ admin_level: 8 })).toEqual({ zoom: 13.5, duration: 1400 })
        expect(getSmartZoomConfig({ type: 'town' })).toEqual({ zoom: 13.5, duration: 1400 })
    })

    it('should fallback to street-level POI zoom (16.5) when admin_level is null or generic POI', () => {
        expect(getSmartZoomConfig({})).toEqual({ zoom: 16.5, duration: 1200 })
        expect(getSmartZoomConfig({ name: 'Tokyo Tower', type: 'apartments', admin_level: null })).toEqual({ zoom: 16.5, duration: 1200 })
        expect(getSmartZoomConfig({ name: 'Sensoji', type: 'tourism', admin_level: undefined })).toEqual({ zoom: 16.5, duration: 1200 })
    })
})
