import { describe, it, expect } from 'vitest'
import { translations } from '@/lib/i18n'

describe('i18n-parity and interpolation', () => {
    it('should have identical key sets in both languages', () => {
        const enKeys = Object.keys(translations.en).sort()
        const zhKeys = Object.keys(translations.zh).sort()

        const missingInZh = enKeys.filter(key => !(key in translations.zh))
        const missingInEn = zhKeys.filter(key => !(key in translations.en))

        expect(missingInZh, 'Keys missing in Chinese translation').toEqual([])
        expect(missingInEn, 'Keys missing in English translation').toEqual([])
    })

    it('should not have empty values', () => {
        const checkEmpty = (dict: Record<string, string>) => {
            return Object.entries(dict)
                .filter(([, value]) => typeof value === 'string' && value.trim() === '')
                .map(([key]) => key)
        }

        expect(checkEmpty(translations.en as Record<string, string>), 'Empty English keys').toEqual([])
        expect(checkEmpty(translations.zh as Record<string, string>), 'Empty Chinese keys').toEqual([])
    })

    it('should simulate parameter interpolation successfully', () => {
        const interpolate = (template: string, params?: Record<string, string | number>) => {
            let result = template
            if (params) {
                Object.entries(params).forEach(([k, v]) => {
                    result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
                })
            }
            return result
        }

        const template = "Trip '{name}' created for {days} days"
        const result = interpolate(template, { name: "Tokyo", days: 5 })
        expect(result).toBe("Trip 'Tokyo' created for 5 days")

        const missing = interpolate("Hello {name}")
        expect(missing).toBe("Hello {name}")
    })
})
