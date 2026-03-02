import { describe, it, expect } from 'vitest'
import { formatNumberSafe } from '@/lib/format'

describe('formatNumberSafe', () => {
    it('should format a normal number', () => {
        const result = formatNumberSafe(1234)
        expect(result).toBe('1,234')
    })

    it('should return fallback for null', () => {
        expect(formatNumberSafe(null)).toBe('0')
    })

    it('should return fallback for undefined', () => {
        expect(formatNumberSafe(undefined)).toBe('0')
    })

    it('should return fallback for empty string', () => {
        expect(formatNumberSafe('')).toBe('0')
    })

    it('should return custom fallback', () => {
        expect(formatNumberSafe(null, 'N/A')).toBe('N/A')
    })

    it('should handle NaN input', () => {
        expect(formatNumberSafe('not-a-number')).toBe('0')
    })

    it('should parse string numbers', () => {
        const result = formatNumberSafe('42')
        expect(result).toBe('42')
    })

    it('should handle decimal numbers', () => {
        const result = formatNumberSafe(3.14, '0', { maximumFractionDigits: 2 })
        expect(result).toContain('3')
        expect(result).toContain('14')
    })
})
