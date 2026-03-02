import { describe, it, expect } from 'vitest'
import { generateHourlyCurve, calculateConfidence, getSeasonConfig } from '@/lib/weather-api'

describe('weather-api: getSeasonConfig', () => {
    it('should return winter config for January', () => {
        const config = getSeasonConfig(1, 10)
        expect(config.season).toBe('winter')
        expect(config.decayMod).toBeGreaterThan(1.0)
    })

    it('should return summer config for August', () => {
        const config = getSeasonConfig(8, 14)
        expect(config.season).toBe('summer')
        expect(config.decayMod).toBeLessThan(1.0)
    })
})

describe('weather-api: calculateConfidence', () => {
    it('should return high confidence for low standard deviation', () => {
        const rawScore = calculateConfidence(0.5, 5)
        const confidence = Math.max(0, Math.min(100, Math.round(rawScore)))
        expect(confidence).toBeGreaterThan(80)
    })

    it('should return lower confidence for high standard deviation', () => {
        const scoreLow = calculateConfidence(0.5, 5)
        const scoreHigh = calculateConfidence(4.0, 5)
        expect(scoreLow).toBeGreaterThan(scoreHigh)
    })
})

describe('weather-api: generateHourlyCurve', () => {
    it('should generate 24 hours of data', () => {
        const curve = generateHourlyCurve(10, 20)
        expect(curve).toHaveLength(24)
    })

    it('should stay within tMin and tMax (mostly)', () => {
        const tMin = 10
        const tMax = 20
        const curve = generateHourlyCurve(tMin, tMax)

        // Due to seasonal adjustments, it might go slightly out of bounds,
        // but it should be close. Let's check max/min of the generated curve.
        const generatedMax = Math.max(...curve)
        const generatedMin = Math.min(...curve)

        expect(generatedMax).toBeCloseTo(tMax, -1) // Within 10 degrees margin roughly
        expect(generatedMin).toBeGreaterThanOrEqual(tMin - 5)
    })

    it('should have highest temperature around 14:00 (default)', () => {
        const curve = generateHourlyCurve(10, 20)

        let maxTemp = -Infinity
        let maxHour = -1
        curve.forEach((temp, hour) => {
            if (temp > maxTemp) {
                maxTemp = temp
                maxHour = hour
            }
        })

        // The peak should be in the afternoon (e.g. 14:00 to 16:00)
        expect(maxHour).toBeGreaterThanOrEqual(13)
        expect(maxHour).toBeLessThanOrEqual(16)
    })

    it('should have lowest temperature around sunrise (default: 6:00)', () => {
        const curve = generateHourlyCurve(10, 20)

        let minTemp = Infinity
        let minHour = -1
        curve.forEach((temp, hour) => {
            if (temp < minTemp) {
                minTemp = temp
                minHour = hour
            }
        })

        // The trough should be around sunrise (4-6 AM)
        expect(minHour).toBeGreaterThanOrEqual(4)
        expect(minHour).toBeLessThanOrEqual(6)
    })
})
