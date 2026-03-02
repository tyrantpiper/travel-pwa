import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getExchangeRate } from '@/lib/currency'

describe('getExchangeRate', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('should return 1 for TWD to TWD', async () => {
        const rate = await getExchangeRate('TWD')
        expect(rate).toBe(1)
    })

    it('should return 1 for twd (case insensitive)', async () => {
        const rate = await getExchangeRate('twd')
        expect(rate).toBe(1)
    })

    it('should return fallback 0.22 for JPY when API fails', async () => {
        // Mock both APIs to fail
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
        const rate = await getExchangeRate('JPY')
        expect(rate).toBe(0.22)
    })

    it('should return fallback 32.5 for USD when API fails', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
        const rate = await getExchangeRate('USD')
        expect(rate).toBe(32.5)
    })

    it('should return 0 for unknown currency when API fails', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
        const rate = await getExchangeRate('XYZ')
        expect(rate).toBe(0)
    })
})
