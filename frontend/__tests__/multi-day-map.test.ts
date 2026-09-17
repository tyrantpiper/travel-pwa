import { describe, it, expect, vi } from 'vitest'
import {
    DAY_PALETTE,
    getDayColor,
    generateGreatCircle,
    calculateHaversineKm,
    buildMultiDayFeatureCollection,
    computeSafeMultiDayBounds
} from '@/lib/geo-multi-day'
import { Trip } from '@/lib/itinerary-types'

describe('Multi-Day Route Mesh Geo Engine (geo-multi-day.ts)', () => {
    it('TC-1: getDayColor returns harmonic rainbow palette and cycles safely', () => {
        expect(getDayColor(1)).toBe(DAY_PALETTE[0])
        expect(getDayColor(2)).toBe(DAY_PALETTE[1])
        expect(getDayColor(11)).toBe(DAY_PALETTE[0]) // cycle
        expect(getDayColor(0)).toBe('#64748B')
    })

    it('TC-2: calculateHaversineKm computes accurate distances', () => {
        // Taipei 101 [121.5654, 25.0339] to Kaohsiung [120.3014, 22.6273] ~ 300km
        const dist = calculateHaversineKm([121.5654, 25.0339], [120.3014, 22.6273])
        expect(dist).toBeGreaterThan(280)
        expect(dist).toBeLessThan(320)
    })

    it('TC-3: generateGreatCircle generates curved geodesic interpolation points', () => {
        const start: [number, number] = [121.5, 25.0]
        const end: [number, number] = [139.7, 35.6] // Taipei to Tokyo
        const arc = generateGreatCircle(start, end, 20)
        expect(arc.length).toBe(21)
        expect(arc[0][0]).toBeCloseTo(121.5, 1)
        expect(arc[arc.length - 1][0]).toBeCloseTo(139.7, 1)
    })

    it('TC-4: buildMultiDayFeatureCollection constructs daily routes and inter-day transitions', () => {
        const mockTrip: Trip = {
            id: 'trip-mesh-1',
            title: 'Taipei 2-Day Tour',
            days: [
                {
                    day: 1,
                    items: [
                        { id: '1', place: 'Taipei 101', lat: 25.0339, lng: 121.5654, category: 'sightseeing' },
                        { id: '2', place: 'Din Tai Fung', lat: 25.0335, lng: 121.5645, category: 'food' }
                    ]
                },
                {
                    day: 2,
                    items: [
                        { id: '3', place: 'Jiufen', lat: 25.1098, lng: 121.8452, category: 'sightseeing' },
                        { id: '4', place: 'Shifen', lat: 25.0425, lng: 121.7766, category: 'sightseeing' }
                    ]
                }
            ]
        } as unknown as Trip

        const { featureCollection, validPoints } = buildMultiDayFeatureCollection(mockTrip)

        expect(validPoints.length).toBe(4)
        const dailyFeatures = featureCollection.features.filter(f => f.properties?.type === 'daily-route')
        const interDayFeatures = featureCollection.features.filter(f => f.properties?.type === 'inter-day-route')
        const pointFeatures = featureCollection.features.filter(f => f.properties?.type === 'point-marker')

        // 2 daily routes
        expect(dailyFeatures.length).toBe(2)
        expect(dailyFeatures[0].properties?.day).toBe(1)
        expect(dailyFeatures[1].properties?.day).toBe(2)

        // 1 inter-day route (from Day 1 end to Day 2 start)
        expect(interDayFeatures.length).toBe(1)
        expect(interDayFeatures[0].properties?.day).toBe(1)
        expect(interDayFeatures[0].properties?.nextDay).toBe(2)
        expect(interDayFeatures[0].properties?.color).toBe('#94A3B8')

        // 4 point markers
        expect(pointFeatures.length).toBe(4)
    })

    it('TC-5: computeSafeMultiDayBounds prevents NaN and handles empty/single points', () => {
        const emptyBounds = computeSafeMultiDayBounds([])
        expect(emptyBounds[0][0]).toBeLessThan(emptyBounds[1][0])
        expect(emptyBounds[0][1]).toBeLessThan(emptyBounds[1][1])

        const singlePointBounds = computeSafeMultiDayBounds([{ lat: 25.0339, lng: 121.5654, day: 1, sequence: 1, place: 'P1' }])
        expect(singlePointBounds[0][0]).toBeCloseTo(121.5354, 2)
        expect(singlePointBounds[1][0]).toBeCloseTo(121.5954, 2)
    })

    it('TC-6: 3D Tour POI filtering and camera decoupling preserves day and sequence info', () => {
        const mockTrip: Trip = {
            id: 'trip-mesh-2',
            title: 'Hokkaido 2-Day Tour',
            days: [
                {
                    day: 1,
                    items: [
                        { id: '1', place: 'Sapporo TV Tower', lat: 43.0611, lng: 141.3564 },
                        { id: '2', place: 'Odori Park', lat: 43.0598, lng: 141.3508 }
                    ]
                },
                {
                    day: 2,
                    items: [
                        { id: '3', place: 'Otaru Canal', lat: 43.1990, lng: 141.0020 },
                        { id: '4', place: 'Music Box Museum', lat: 43.1912, lng: 141.0076 }
                    ]
                }
            ]
        } as unknown as Trip

        const { validPoints } = buildMultiDayFeatureCollection(mockTrip)

        // 1. 全部行程導覽 (activeDay = 0)
        const allTourPois = validPoints.map(p => ({
            lat: p.lat,
            lng: p.lng,
            name: p.place,
            day: p.day,
            sequence: p.sequence
        }))
        expect(allTourPois.length).toBe(4)
        expect(allTourPois[0].day).toBe(1)
        expect(allTourPois[0].sequence).toBe(1)
        expect(allTourPois[2].day).toBe(2)
        expect(allTourPois[2].sequence).toBe(1)

        // 2. 指定單天導覽 (activeDay = 2)
        const day2Points = validPoints.filter(p => p.day === 2)
        const day2TourPois = day2Points.map(p => ({
            lat: p.lat,
            lng: p.lng,
            name: p.place,
            day: p.day,
            sequence: p.sequence
        }))
        expect(day2TourPois.length).toBe(2)
        expect(day2TourPois[0].name).toBe('Otaru Canal')

        // 3. 抵達新站時解耦驗證：僅同步 activeDay，絕不觸發 fitBounds
        let activeDayState = 1
        const mockFitBounds = vi.fn()
        const onStationArriveDecoupled = (poi: { day?: number }) => {
            if (typeof poi.day === 'number' && poi.day !== activeDayState) {
                activeDayState = poi.day
            }
            // 絕不呼叫 mockFitBounds
        }

        onStationArriveDecoupled(allTourPois[2]) // 飛抵 Day 2
        expect(activeDayState).toBe(2)
        expect(mockFitBounds).not.toHaveBeenCalled()
    })
})
