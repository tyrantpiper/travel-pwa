import { Trip, Activity } from './itinerary-types'

/**
 * 🎨 DAY_PALETTE: 頂級彩虹光譜天數分色票 (High-Contrast Harmonic Palette)
 * Day 1 翠綠, Day 2 鈷藍, Day 3 琥珀, Day 4 紫羅蘭, Day 5 玫瑰紅, Day 6 青空藍, Day 7 銘黃
 */
export const DAY_PALETTE: string[] = [
    '#10B981', // D1: Emerald Green
    '#3B82F6', // D2: Cobalt Blue
    '#F59E0B', // D3: Amber Orange
    '#8B5CF6', // D4: Violet Purple
    '#F43F5E', // D5: Rose Red
    '#06B6D4', // D6: Cyan Azure
    '#EAB308', // D7: Gold Sun
    '#6366F1', // D8: Indigo Blue
    '#EC4899', // D9: Pink Coral
    '#14B8A6', // D10: Teal Jade
]

/**
 * 獲取指定天數之代表色
 */
export function getDayColor(day: number): string {
    if (day <= 0) return '#64748B' // D0 or unknown: Slate
    const index = (day - 1) % DAY_PALETTE.length
    return DAY_PALETTE[index]
}

export interface RoutePoint {
    lat: number
    lng: number
    day: number
    sequence: number
    place: string
    category?: string
    id?: string
}

/**
 * 🛡️ 零外部依賴的原生球面大圓弧線演算法 (Zero-Dependency Great Circle Spherical Math)
 * 適用於跨海、離島或長距離 (>300km) 位移插值
 */
export function generateGreatCircle(
    start: [number, number], // [lng, lat]
    end: [number, number],   // [lng, lat]
    pointsCount = 25
): [number, number][] {
    const toRad = (d: number) => (d * Math.PI) / 180
    const toDeg = (r: number) => (r * 180) / Math.PI

    const [lon1, lat1] = [toRad(start[0]), toRad(start[1])]
    const [lon2, lat2] = [toRad(end[0]), toRad(end[1])]

    const d = 2 * Math.asin(Math.sqrt(
        Math.pow(Math.sin((lat1 - lat2) / 2), 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin((lon1 - lon2) / 2), 2)
    ))

    if (d === 0 || isNaN(d)) return [start, end]

    const coordinates: [number, number][] = []
    for (let i = 0; i <= pointsCount; i++) {
        const f = i / pointsCount
        const A = Math.sin((1 - f) * d) / Math.sin(d)
        const B = Math.sin(f * d) / Math.sin(d)
        const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2)
        const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2)
        const z = A * Math.sin(lat1) + B * Math.sin(lat2)
        const lat = Math.atan2(z, Math.sqrt(x * x + y * y))
        const lon = Math.atan2(y, x)
        coordinates.push([toDeg(lon), toDeg(lat)])
    }
    return coordinates
}

/**
 * 計算兩經緯度點間的大圓距離 (公里)
 */
export function calculateHaversineKm(
    coord1: [number, number], // [lng, lat]
    coord2: [number, number]
): number {
    const toRad = (d: number) => (d * Math.PI) / 180
    const [lon1, lat1] = [toRad(coord1[0]), toRad(coord1[1])]
    const [lon2, lat2] = [toRad(coord2[0]), toRad(coord2[1])]

    const dLat = lat2 - lat1
    const dLon = lon2 - lon1
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return 6371 * c
}

export interface MultiDayFeatureCollection {
    type: 'FeatureCollection'
    features: GeoJSON.Feature[]
}

/**
 * 🌐 全行程多天軌跡 FeatureCollection 構建引擎
 * 輸出標準 GeoJSON，包含：
 * 1. type: 'daily-route' - 當日連線實線彩帶
 * 2. type: 'inter-day-route' - 跨天位移虛線
 * 3. type: 'point-marker' - 景點點位
 */
export function buildMultiDayFeatureCollection(
    trip?: Trip,
    roadPolylinesByDay: Record<number, [number, number][]> = {}
): {
    featureCollection: MultiDayFeatureCollection
    validPoints: RoutePoint[]
} {
    if (!trip || !trip.days || trip.days.length === 0) {
        return {
            featureCollection: { type: 'FeatureCollection', features: [] },
            validPoints: []
        }
    }

    const features: GeoJSON.Feature[] = []
    const allValidPoints: RoutePoint[] = []
    const dayNodeMap: Record<number, RoutePoint[]> = {}

    // 1. 整理各天有效點位
    trip.days.forEach(dayPlan => {
        const dayNum = dayPlan.day
        dayNodeMap[dayNum] = []

        const acts: Activity[] = dayPlan.activities || (dayPlan as { items?: Activity[] }).items || []
        let seq = 1
        acts.forEach((act: Activity) => {
            const isHeader = act.category === 'header' || (act.time || act.time_slot || '') === '00:00'
            const lat = Number(act.lat)
            const lng = Number(act.lng)
            if (!isHeader && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                const pt: RoutePoint = {
                    lat,
                    lng,
                    day: dayNum,
                    sequence: seq++,
                    place: act.place || act.place_name || `Spot ${seq}`,
                    category: act.category,
                    id: act.id
                }
                dayNodeMap[dayNum].push(pt)
                allValidPoints.push(pt)

                // 注入 Point Feature
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    },
                    properties: {
                        type: 'point-marker',
                        day: dayNum,
                        color: getDayColor(dayNum),
                        place: pt.place,
                        sequence: pt.sequence,
                        id: pt.id
                    }
                })
            }
        })
    })

    // 2. 構建當日路線 (daily-route)
    const sortedDays = Object.keys(dayNodeMap)
        .map(Number)
        .sort((a, b) => a - b)

    sortedDays.forEach(dayNum => {
        const points = dayNodeMap[dayNum]
        if (points.length >= 2) {
            let lineCoords: [number, number][]

            // 若已有背景擬合的真實道路 Polyline，優先使用；否則使用兩點直連
            if (roadPolylinesByDay[dayNum] && roadPolylinesByDay[dayNum].length >= 2) {
                lineCoords = roadPolylinesByDay[dayNum]
            } else {
                lineCoords = points.map(p => [p.lng, p.lat])
            }

            features.push({
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: lineCoords
                },
                properties: {
                    type: 'daily-route',
                    day: dayNum,
                    color: getDayColor(dayNum),
                    isInterDay: false
                }
            })
        }
    })

    // 3. 構建跨日過渡線 (inter-day-route)
    for (let i = 0; i < sortedDays.length - 1; i++) {
        const currDay = sortedDays[i]
        const nextDay = sortedDays[i + 1]
        const currPoints = dayNodeMap[currDay]
        const nextPoints = dayNodeMap[nextDay]

        if (currPoints.length > 0 && nextPoints.length > 0) {
            const startPt = currPoints[currPoints.length - 1]
            const endPt = nextPoints[0]
            const startCoord: [number, number] = [startPt.lng, startPt.lat]
            const endCoord: [number, number] = [endPt.lng, endPt.lat]

            const distKm = calculateHaversineKm(startCoord, endCoord)
            let interCoords: [number, number][]

            // 若跨海或長距離 (> 300km)，以大圓弧線平滑過渡
            if (distKm > 300) {
                interCoords = generateGreatCircle(startCoord, endCoord, 25)
            } else {
                interCoords = [startCoord, endCoord]
            }

            features.push({
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: interCoords
                },
                properties: {
                    type: 'inter-day-route',
                    day: currDay,
                    nextDay,
                    color: '#94A3B8', // Slate-400 低對比中性色
                    isInterDay: true,
                    isGreatCircle: distKm > 300
                }
            })
        }
    }

    return {
        featureCollection: {
            type: 'FeatureCollection',
            features
        },
        validPoints: allValidPoints
    }
}

/**
 * 🛡️ 計算安全的外接矩形邊界 (Safe Bounding Box)
 * 具備空座標與單點兜底，防止傳給 map.fitBounds 拋錯
 */
export function computeSafeMultiDayBounds(
    points: RoutePoint[],
    fallbackCenter: [number, number] = [121.56, 25.03] // 預設台北中心
): [[number, number], [number, number]] {
    if (!points || points.length === 0) {
        return [
            [fallbackCenter[0] - 0.08, fallbackCenter[1] - 0.08],
            [fallbackCenter[0] + 0.08, fallbackCenter[1] + 0.08]
        ]
    }

    if (points.length === 1) {
        return [
            [points[0].lng - 0.03, points[0].lat - 0.03],
            [points[0].lng + 0.03, points[0].lat + 0.03]
        ]
    }

    let minLng = Infinity
    let maxLng = -Infinity
    let minLat = Infinity
    let maxLat = -Infinity

    for (const p of points) {
        if (!isNaN(p.lng) && !isNaN(p.lat)) {
            minLng = Math.min(minLng, p.lng)
            maxLng = Math.max(maxLng, p.lng)
            minLat = Math.min(minLat, p.lat)
            maxLat = Math.max(maxLat, p.lat)
        }
    }

    // 防禦退化成單點
    if (minLng === maxLng) {
        minLng -= 0.02
        maxLng += 0.02
    }
    if (minLat === maxLat) {
        minLat -= 0.02
        maxLat += 0.02
    }

    return [
        [minLng, minLat],
        [maxLng, maxLat]
    ]
}
