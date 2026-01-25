"use client"

import { create } from 'zustand'
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware'
import { get, set, del } from 'idb-keyval'
import { WeatherResult } from '../weather-api'

/**
 * 💡 2026 Neural Connection: Global Weather Store
 * High-precision weather data promoted to global context for AI Chat & Offline support.
 */

// Custom storage adapter for IndexedDB using idb-keyval
const idbStorage: StateStorage = {
    getItem: async (name: string): Promise<string | null> => {
        return (await get(name)) || null
    },
    setItem: async (name: string, value: string): Promise<void> => {
        await set(name, value)
    },
    removeItem: async (name: string): Promise<void> => {
        await del(name)
    },
}

interface WeatherCacheEntry extends WeatherResult {
    timestamp: number
}

interface WeatherState {
    // Key: "lat_lng_date" (coords to 3 decimal places for privacy obfuscation)
    cache: Record<string, WeatherCacheEntry>

    // Actions
    setWeatherData: (lat: number, lng: number, date: string, data: WeatherResult) => void
    getWeatherData: (lat: number, lng: number, date: string) => WeatherCacheEntry | null
    clearOldData: () => void
}

export const useWeatherStore = create<WeatherState>()(
    persist(
        (set, get) => ({
            cache: {},

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

            clearOldData: () => {
                // ♻️ GC: Auto-cleanup of data older than 7 days
                const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
                const now = Date.now()
                set((state) => {
                    const newCache = { ...state.cache }
                    let cleaned = false
                    Object.keys(newCache).forEach(key => {
                        if (now - newCache[key].timestamp > SEVEN_DAYS_MS) {
                            delete newCache[key]
                            cleaned = true
                        }
                    })
                    return cleaned ? { cache: newCache } : state
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
