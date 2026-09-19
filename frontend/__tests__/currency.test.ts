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

describe('getCountryCode & getFlagEmoji', () => {
    it('should return correct country code and flag for valid fiat currencies', async () => {
        const { getCountryCode, getFlagEmoji } = await import('@/lib/currency')
        expect(getCountryCode('USD')).toBe('us')
        expect(getCountryCode('usd')).toBe('us')
        expect(getCountryCode('JPY')).toBe('jp')
        expect(getCountryCode('TWD')).toBe('tw')
        expect(getCountryCode('EUR')).toBe('eu')
        expect(getFlagEmoji('JPY')).toBe('🇯🇵')
        expect(getFlagEmoji('USD')).toBe('🇺🇸')
        expect(getFlagEmoji('EUR')).toBe('🇪🇺')
    })

    it('should return cw for ANG (Curaçao) instead of deprecated an', async () => {
        const { getCountryCode, getFlagEmoji } = await import('@/lib/currency')
        expect(getCountryCode('ANG')).toBe('cw')
        expect(getFlagEmoji('ANG')).toBe('🇨🇼')
    })

    it('should return undefined and coin emoji for cryptos and unknown tokens', async () => {
        const { getCountryCode, getFlagEmoji } = await import('@/lib/currency')
        expect(getCountryCode('1INCH')).toBeUndefined()
        expect(getFlagEmoji('1INCH')).toBe('🪙')
        expect(getCountryCode('AAVE')).toBeUndefined()
        expect(getFlagEmoji('AAVE')).toBe('🪙')
        expect(getCountryCode('BTC')).toBeUndefined()
        expect(getFlagEmoji('BTC')).toBe('🪙')
        expect(getCountryCode('UNKNOWN_COIN')).toBeUndefined()
        expect(getFlagEmoji('UNKNOWN_COIN')).toBe('🪙')
        // Defensive null & undefined check
        expect(getCountryCode(undefined)).toBeUndefined()
        expect(getCountryCode(null)).toBeUndefined()
        expect(getCountryCode('')).toBeUndefined()
        expect(getFlagEmoji(undefined)).toBe('🪙')
        expect(getFlagEmoji(null)).toBe('🪙')
        expect(getFlagEmoji('')).toBe('🪙')
    })

    it('getAllSupportedCurrencies should strictly filter out cryptos', async () => {
        const { getAllSupportedCurrencies } = await import('@/lib/currency')
        global.fetch = vi.fn().mockResolvedValue({
            json: async () => ({
                '1inch': '1inch Crypto',
                'aave': 'Aave Token',
                'btc': 'Bitcoin',
                'usd': 'United States Dollar',
                'jpy': 'Japanese Yen',
                'twd': 'New Taiwan Dollar'
            })
        })
        const list = await getAllSupportedCurrencies()
        const codes = list.map(c => c.code)
        expect(codes).toContain('USD')
        expect(codes).toContain('JPY')
        expect(codes).toContain('TWD')
        expect(codes).not.toContain('1INCH')
        expect(codes).not.toContain('AAVE')
        expect(codes).not.toContain('BTC')
    })
})
