import { describe, it, expect } from 'vitest'
import {
    LatLngSchema,
    UserProfileSchema,
    ItineraryItemSchema,
    TripSchema,
    ExpenseSchema,
    GeocodeResultSchema,
    SubItemSchema,
} from '@/lib/schemas'

describe('LatLngSchema', () => {
    it('should parse valid coordinates', () => {
        const result = LatLngSchema.parse({ lat: 35.68, lng: 139.76 })
        expect(result.lat).toBe(35.68)
        expect(result.lng).toBe(139.76)
    })

    it('should coerce string coordinates to numbers', () => {
        const result = LatLngSchema.parse({ lat: '35.68', lng: '139.76' })
        expect(result.lat).toBe(35.68)
        expect(result.lng).toBe(139.76)
    })

    it('should fail on missing fields', () => {
        expect(() => LatLngSchema.parse({})).toThrow()
    })
})

describe('UserProfileSchema', () => {
    it('should parse valid profile', () => {
        const result = UserProfileSchema.parse({ id: 'user-1', name: 'Ryan' })
        expect(result.name).toBe('Ryan')
    })

    it('should apply default name "Traveler"', () => {
        const result = UserProfileSchema.parse({ id: 'user-1' })
        expect(result.name).toBe('Traveler')
    })
})

describe('SubItemSchema', () => {
    it('should parse with defaults', () => {
        const result = SubItemSchema.parse({ name: 'Pack sunscreen' })
        expect(result.checked).toBe(false)
        expect(result.desc).toBeUndefined()
    })
})

describe('ItineraryItemSchema', () => {
    it('should parse a complete item', () => {
        const result = ItineraryItemSchema.parse({
            id: 'item-1',
            itinerary_id: 'trip-1',
            day_number: 1,
            place_name: 'Tokyo Tower',
        })
        expect(result.place_name).toBe('Tokyo Tower')
        expect(result.category).toBe('activity') // default
        expect(result.tags).toEqual([])           // default
        expect(result.sub_items).toEqual([])      // default
        expect(result.is_highlight).toBe(false)   // default
    })

    it('should transform null cost_amount to 0', () => {
        const result = ItineraryItemSchema.parse({
            id: 'item-1',
            itinerary_id: 'trip-1',
            day_number: 1,
            place_name: 'Test',
            cost_amount: null,
        })
        expect(result.cost_amount).toBe(0)
    })

    it('should handle null values from PostgreSQL for sub_items, is_highlight, and boolean/array fields', () => {
        const result = ItineraryItemSchema.parse({
            id: 'item-1',
            itinerary_id: 'trip-1',
            day_number: 1,
            place_name: 'Test Spot',
            sub_items: null,
            is_highlight: null,
            is_private: null,
            hide_navigation: null,
            tags: null,
            image_urls: null,
            sort_order: null,
            time_slot: null,
            category: null,
        })
        expect(result.sub_items).toEqual([])
        expect(result.is_highlight).toBe(false)
        expect(result.is_private).toBe(false)
        expect(result.hide_navigation).toBe(false)
        expect(result.tags).toEqual([])
        expect(result.image_urls).toEqual([])
        expect(result.sort_order).toBe(0)
        expect(result.time_slot).toBe("00:00")
        expect(result.category).toBe("activity")
    })

    it('should fail without required fields', () => {
        expect(() => ItineraryItemSchema.parse({ id: 'item-1' })).toThrow()
    })
})

describe('TripSchema', () => {
    it('should parse minimal trip with defaults', () => {
        const result = TripSchema.parse({
            id: 'trip-1',
            title: '2026 Tokyo Trip',
        })
        expect(result.title).toBe('2026 Tokyo Trip')
        expect(result.total_days).toBe(1)       // default
        expect(result.days).toEqual([])          // default
        expect(result.credit_cards).toEqual([])  // default
        expect(result.creator_name).toBe('Creator') // default
    })

    it('should parse trip with nested days and items', () => {
        const result = TripSchema.parse({
            id: 'trip-1',
            title: 'Test',
            days: [{
                day_number: 1,
                items: [{
                    id: 'item-1',
                    itinerary_id: 'trip-1',
                    day_number: 1,
                    place_name: 'Place A',
                }]
            }]
        })
        expect(result.days).toHaveLength(1)
        expect(result.days[0].items).toHaveLength(1)
        expect(result.days[0].items[0].place_name).toBe('Place A')
    })
})

describe('ExpenseSchema', () => {
    it('should parse with defaults', () => {
        const result = ExpenseSchema.parse({
            id: 'exp-1',
            itinerary_id: 'trip-1',
        })
        expect(result.title).toBe('Expense')   // default
        expect(result.amount_jpy).toBe(0)       // default
        expect(result.currency).toBe('JPY')     // default
        expect(result.category).toBe('other')   // default
        expect(result.is_public).toBe(false)    // default
    })
})

describe('GeocodeResultSchema', () => {
    it('should coerce string coordinates', () => {
        const result = GeocodeResultSchema.parse({
            lat: '35.68',
            lng: '139.76',
            name: 'Tokyo',
        })
        expect(typeof result.lat).toBe('number')
        expect(typeof result.lng).toBe('number')
    })

    it('should apply default name', () => {
        const result = GeocodeResultSchema.parse({ lat: 0, lng: 0 })
        expect(result.name).toBe('Unknown Place')
    })
})
