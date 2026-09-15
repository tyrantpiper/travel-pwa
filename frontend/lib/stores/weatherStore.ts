"use client"

import { create } from 'zustand'
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware'
import { get, set, del } from 'idb-keyval'
import { WeatherResult, fetchFiveDayForecast } from '../weather-api'

/**
 * 💡 2026 Neural Connection: Global Weather Store
 * High-precision weather data promoted to global context for AI Chat & Offline support.
 */

// Custom storage adapter for IndexedDB using idb-keyval
const idbStorage: StateStorage = {
    getItem: async (name: string): Promise<string | null> => {
        if (typeof indexedDB === 'undefined') return null
        try {
            return (await get(name)) || null
        } catch {
            return null
        }
    },
    setItem: async (name: string, value: string): Promise<void> => {
        if (typeof indexedDB === 'undefined') return
        try {
            await set(name, value)
        } catch {
            // safely ignore in unsupported environments
        }
    },
    removeItem: async (name: string): Promise<void> => {
        if (typeof indexedDB === 'undefined') return
        try {
            await del(name)
        } catch {
            // safely ignore in unsupported environments
        }
    },
}

export interface DailyForecastItem {
    date: string               // YYYY-MM-DD
    dayLabel: string           // "今日" | "明日" | "週X"
    weatherCode: number
    tempMax: number
    tempMin: number
    apparentMax?: number
    apparentMin?: number
    precipProb: number         // 0 - 100
    uvIndex?: number
    windSpeed?: number
}

export interface Daily5DayCacheEntry {
    data: DailyForecastItem[]
    timestamp: number
}

interface WeatherCacheEntry extends WeatherResult {
    timestamp: number
}

interface WeatherState {
    // Key: "lat_lng_date" (coords to 3 decimal places for privacy obfuscation)
    cache: Record<string, WeatherCacheEntry>
    // Key: "lat_lng_5d_todayStr" (coords to 2 decimal places ~1.1km clustering)
    fiveDayCache: Record<string, Daily5DayCacheEntry>

    // Actions
    setWeatherData: (lat: number, lng: number, date: string, data: WeatherResult) => void
    getWeatherData: (lat: number, lng: number, date: string) => WeatherCacheEntry | null
    setFiveDayData: (lat: number, lng: number, todayStr: string, data: DailyForecastItem[]) => void
    getFiveDayData: (lat: number, lng: number, todayStr: string) => DailyForecastItem[] | null
    clearOldData: () => void
}

export const useWeatherStore = create<WeatherState>()(
    persist(
        (set, get) => ({
            cache: {},
            fiveDayCache: {},

            setWeatherData: (lat, lng, date, data) => {
                // 🛡️ Privacy Optimization: Round to 3 decimals (~110m accuracy)
                const key = `${lat.toFixed(3)}_${lng.toFixed(3)}_${date}`
                const entry: WeatherCacheEntry = {
                    ...data,
                    timestamp: Date.now()
                }
                set((state) => ({
                    cache: { ...state.cache, [key]: entry }
                }))
            },

            getWeatherData: (lat, lng, date) => {
                const key = `${lat.toFixed(3)}_${lng.toFixed(3)}_${date}`
                return get().cache[key] || null
            },

            setFiveDayData: (lat, lng, todayStr, data) => {
                const key = `${lat.toFixed(2)}_${lng.toFixed(2)}_5d_${todayStr}`
                set((state) => ({
                    fiveDayCache: {
                        ...(state.fiveDayCache || {}),
                        [key]: { data, timestamp: Date.now() }
                    }
                }))
            },

            getFiveDayData: (lat, lng, todayStr) => {
                const key = `${lat.toFixed(2)}_${lng.toFixed(2)}_5d_${todayStr}`
                return get().fiveDayCache?.[key]?.data || null
            },

            clearOldData: () => {
                // ♻️ GC: Auto-cleanup of data older than 7 days
                const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
                const now = Date.now()
                set((state) => {
                    const newCache = { ...state.cache }
                    const newFiveDayCache = { ...(state.fiveDayCache || {}) }
                    let cleaned = false

                    Object.keys(newCache).forEach(key => {
                        if (now - newCache[key].timestamp > SEVEN_DAYS_MS) {
                            delete newCache[key]
                            cleaned = true
                        }
                    })

                    Object.keys(newFiveDayCache).forEach(key => {
                        if (now - newFiveDayCache[key].timestamp > SEVEN_DAYS_MS) {
                            delete newFiveDayCache[key]
                            cleaned = true
                        }
                    })

                    return cleaned ? { cache: newCache, fiveDayCache: newFiveDayCache } : state
                })
            }
        }),
        {
            name: 'weather-storage',
            storage: createJSONStorage(() => idbStorage),
            version: 1, // 🆕 Fix 1.1: Force cache invalidation due to Timezone Bug fix
            migrate: (persistedState: unknown, version: number) => {
                if (version === 0) {
                    // if the stored value is in version 0, we flush the cache
                    return { cache: {} }
                }
                return persistedState as WeatherState
            },
        }
    )
)

// 🆕 In-Flight Promise Deduping Map
const inFlightFiveDayRequests = new Map<string, Promise<DailyForecastItem[] | null>>()

/**
 * 🌤️ 帶有全域去重與背景寫入的 5 天氣象請求
 * 即使組件短態卸載或生命週期重置，Promise 亦保證寫入全域狀態機，徹底阻絕 isMounted 誤殺
 */
export async function fetchFiveDayForecastWithDedup(
    lat: number,
    lng: number,
    todayStr: string
): Promise<DailyForecastItem[] | null> {
    const key = `${lat.toFixed(2)}_${lng.toFixed(2)}_5d_${todayStr}`

    // 1. 若全域快取已有資料，直接返回
    const cached = useWeatherStore.getState().getFiveDayData(lat, lng, todayStr)
    if (cached) return cached

    // 2. 若已有進行中的同座標請求，直接共享 Promise
    const inFlight = inFlightFiveDayRequests.get(key)
    if (inFlight) return inFlight

    // 3. 發起全新請求並登記至 In-Flight 池
    const promise = (async () => {
        try {
            const items = await fetchFiveDayForecast(lat, lng)
            if (items && items.length > 0) {
                useWeatherStore.getState().setFiveDayData(lat, lng, todayStr, items)
            }
            return items
        } catch (e) {
            console.warn(`[weatherStore] ⚠️ fetchFiveDayForecast failed for (${lat}, ${lng}):`, e)
            return null
        } finally {
            inFlightFiveDayRequests.delete(key)
        }
    })()

    inFlightFiveDayRequests.set(key, promise)
    return promise
}
