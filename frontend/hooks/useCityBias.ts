"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { debugLog } from '@/lib/debug'

/**
 * 城市資料結構
 */
interface City {
    name: string
    aliases: string[]
    country: string
    region: string
    lat: number
    lng: number
}

interface CitiesData {
    __meta: {
        version: string
        lastUpdated: string
    }
    cities: City[]
}

/**
 * 計算兩點之間的距離 (Haversine formula)
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371 // 地球半徑 (km)
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

/**
 * 🏙️ 城市偏移 Hook
 * 
 * 功能：
 * - 載入城市資料庫
 * - 根據座標找最近城市
 * - 提供 location bias 給搜尋 API
 * 
 * 使用：
 * const { findNearestCity, isLoaded } = useCityBias()
 * const city = findNearestCity(35.6762, 139.6503) // → 東京
 */
export function useCityBias() {
    const [cities, setCities] = useState<City[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isLoaded, setIsLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // 載入城市資料
    useEffect(() => {
        const loadCities = async () => {
            try {
                setIsLoading(true)
                const res = await fetch('/data/geo/cities.json')
                if (!res.ok) throw new Error('Failed to load cities data')

                const data: CitiesData = await res.json()
                setCities(data.cities)
                setIsLoaded(true)
                debugLog(`🏙️ City bias loaded: ${data.cities.length} cities`)
            } catch (err) {
                debugLog(`🏙️ City bias load error: ${err}`, 'error')
                setError(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                setIsLoading(false)
            }
        }

        loadCities()
    }, [])

    /**
     * 根據座標找最近的城市
     */
    const findNearestCity = useCallback((lat: number, lng: number, maxDistance = 100): City | null => {
        if (!isLoaded || cities.length === 0) return null

        let nearest: City | null = null
        let minDistance = Infinity

        for (const city of cities) {
            const distance = haversineDistance(lat, lng, city.lat, city.lng)
            if (distance < minDistance && distance <= maxDistance) {
                minDistance = distance
                nearest = city
            }
        }

        if (nearest) {
            debugLog(`🏙️ Nearest city: ${nearest.name} (${minDistance.toFixed(1)} km)`)
        }

        return nearest
    }, [cities, isLoaded])

    /**
     * 根據城市名稱搜尋
     */
    const findCityByName = useCallback((query: string): City | null => {
        if (!isLoaded || cities.length === 0 || !query) return null

        const q = query.toLowerCase().trim()

        for (const city of cities) {
            // 完全匹配名稱
            if (city.name.toLowerCase() === q) return city

            // 別名匹配
            if (city.aliases.some(alias => alias.toLowerCase() === q)) return city
        }

        // 模糊匹配
        for (const city of cities) {
            if (city.name.toLowerCase().includes(q)) return city
            if (city.aliases.some(alias => alias.toLowerCase().includes(q))) return city
        }

        return null
    }, [cities, isLoaded])

    /**
     * 取得特定國家的所有城市
     */
    const getCitiesByCountry = useCallback((countryCode: string): City[] => {
        if (!isLoaded) return []
        return cities.filter(city => city.country === countryCode)
    }, [cities, isLoaded])

    /**
     * 取得所有支援的國家列表
     */
    const supportedCountries = useMemo(() => {
        if (!isLoaded) return []
        return [...new Set(cities.map(city => city.country))]
    }, [cities, isLoaded])

    return {
        cities,
        isLoading,
        isLoaded,
        error,
        findNearestCity,
        findCityByName,
        getCitiesByCountry,
        supportedCountries,
        cityCount: cities.length
    }
}

/**
 * 取得 Location Bias 參數
 * 用於傳遞給 geocodeApi.search
 */
export function getLocationBias(city: City | null): { lat?: number; lng?: number; country?: string; region?: string } {
    if (!city) return {}
    return {
        lat: city.lat,
        lng: city.lng,
        country: city.country,
        region: city.region
    }
}
