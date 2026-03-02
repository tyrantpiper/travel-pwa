/**
 * API Layer Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tripsApi, itemsApi, geocodeApi, API, API_HOST } from '@/lib/api'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('API Constants', () => {
    it('should have correct API_HOST', () => {
        expect(API_HOST).toBeDefined()
        expect(typeof API_HOST).toBe('string')
    })

    it('should have all required API endpoints', () => {
        expect(API.TRIPS).toContain('/api/trips')
        expect(API.ITEMS).toContain('/api/items')
        expect(API.GEOCODE).toContain('/api/geocode')
        expect(API.EXPENSES).toContain('/api/expenses')
    })
})

describe('tripsApi', () => {
    beforeEach(() => {
        mockFetch.mockReset()
    })

    describe('create', () => {
        it('should call fetch with correct parameters', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'trip-123', title: 'Test Trip' })
            })

            const result = await tripsApi.create({
                title: 'Test Trip',
                start_date: '2026-01-01',
                end_date: '2026-01-07',
                user_id: 'user-123'
            })

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/trip/create-manual'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'X-User-ID': 'user-123'
                    }),
                })
            )
            expect(result).toMatchObject({ id: 'trip-123', title: 'Test Trip' })
        })

        it('should throw error when request fails', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({ detail: "建立行程失敗" })
            })

            await expect(tripsApi.create({
                title: 'Test',
                start_date: '2026-01-01',
                end_date: '2026-01-07',
                user_id: 'user-123'
            })).rejects.toThrow('建立行程失敗')
        })
    })

    describe('join', () => {
        it('should join trip with share code', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            })

            const result = await tripsApi.join({
                share_code: '1234',
                user_id: 'user-123'
            })

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/join-trip'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'X-User-ID': 'user-123'
                    })
                })
            )
            expect(result).toMatchObject({ success: true })
        })
    })

    describe('delete', () => {
        it('should delete trip by ID', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ deleted: true })
            })

            await tripsApi.delete('trip-123', 'user-123')

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/trips/trip-123'),
                expect.objectContaining({
                    method: 'DELETE',
                    headers: expect.objectContaining({
                        'X-User-ID': 'user-123'
                    })
                })
            )
        })
    })
})

describe('itemsApi', () => {
    beforeEach(() => {
        mockFetch.mockReset()
        // Mock onLine status
        Object.defineProperty(navigator, 'onLine', {
            configurable: true,
            value: true,
        });
    })

    describe('create', () => {
        it('should create item with all fields', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'item-123' })
            })

            await itemsApi.create({
                trip_id: 'trip-123',
                user_id: 'user-123',
                day: 1,
                time: '10:00',
                place: 'Tokyo Tower',
                category: 'sightseeing'
            })

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/items'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'X-User-ID': 'user-123'
                    })
                })
            )
        })
    })

    describe('update', () => {
        it('should update item by ID', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: 'item-123',
                    itinerary_id: 'trip-123',
                    day_number: 1,
                    place_name: 'Updated Place'
                })
            })

            const result = await itemsApi.update('item-123', { place: 'Updated Place' }, 'user-123')

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/items/item-123'),
                expect.objectContaining({
                    method: 'PATCH',
                    headers: expect.objectContaining({
                        'X-User-ID': 'user-123'
                    })
                })
            )
            expect(result.place_name).toBe('Updated Place')
        })
    })

    describe('delete', () => {
        it('should delete item by ID', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ deleted: true })
            })

            await itemsApi.delete('item-123', 'user-123')

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/items/item-123'),
                expect.objectContaining({
                    method: 'DELETE',
                    headers: expect.objectContaining({
                        'X-User-ID': 'user-123'
                    })
                })
            )
        })
    })
})

describe('geocodeApi', () => {
    beforeEach(() => {
        mockFetch.mockReset()
    })

    describe('search', () => {
        it('should search with query', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ results: [{ name: 'Tokyo', lat: 35.68, lng: 139.76 }] })
            })

            const result = await geocodeApi.search({ query: 'Tokyo', limit: 5 })

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/geocode/search'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    })
                })
            )
            expect(result.results).toHaveLength(1)
        })
    })
})
