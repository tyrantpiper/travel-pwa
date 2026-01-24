"use client"

import { createContext, useContext, useEffect, ReactNode, useTransition } from "react"
import { useTrips } from "./hooks"
import { useTripStore } from "./stores/tripStore"

interface TripContextType {
    activeTripId: string | null
    setActiveTripId: (id: string | null) => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trips: any[]
    isLoading: boolean
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activeTrip: any | null
    mutate: () => Promise<unknown>
    userId: string | null
    isTransitioning: boolean
}

const TripContext = createContext<TripContextType | undefined>(undefined)

// 🛡️ Identity Validation (Support legacy & modern UUID)
const isValidUserId = (id: string | null): id is string => {
    if (!id || id === "null" || id === "undefined") return false
    // UUID format check
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(id)) return true
    // Legacy support: Alphanumeric username-style IDs (3-64 characters)
    const legacyRegex = /^[a-zA-Z0-9_\-.]{3,64}$/
    return legacyRegex.test(id)
}

export function TripProvider({ children }: { children: ReactNode }) {
    // Use Zustand store for state management
    const activeTripId = useTripStore((s) => s.activeTripId)
    const userId = useTripStore((s) => s.userId)
    const setActiveTripId = useTripStore((s) => s.setActiveTripId)
    const setUserId = useTripStore((s) => s.setUserId)
    const setActiveTripTitle = useTripStore((s) => s.setActiveTripTitle)
    const [isTransitioning, startTransition] = useTransition()

    // 初始化時從 localStorage 讀取 user_uuid (保持向後兼容)
    useEffect(() => {
        if (typeof window !== "undefined") {
            const storedUserId = localStorage.getItem("user_uuid")

            // 🛡️ Data Sanitization: 防止 "null" 字串傳遞
            if (storedUserId) {
                if (isValidUserId(storedUserId)) {
                    if (storedUserId !== userId) {
                        setUserId(storedUserId)
                    }
                } else {
                    console.warn("🛡️ Detected invalid user_uuid in localStorage, clearing...", storedUserId)
                    localStorage.removeItem("user_uuid")
                    setUserId(null)
                }
            }

            // 如果 store 沒有 activeTripId，嘗試從舊的 localStorage 恢復
            const savedTripId = localStorage.getItem("active_trip_id")
            if (savedTripId && !activeTripId) {
                if (isValidUserId(savedTripId)) {
                    setActiveTripId(savedTripId)
                } else {
                    localStorage.removeItem("active_trip_id")
                }
            }
        }
    }, [activeTripId, userId, setActiveTripId, setUserId])

    const { trips, isLoading, mutate } = useTrips(userId)

    // 🔧 FIX: 當 userId 從 Zustand hydration 準備好後，強制刷新 trips
    // 這解決了首次載入時資料不顯示的問題
    useEffect(() => {
        if (userId && mutate) {
            mutate()
        }
    }, [userId, mutate])

    // 當 trips 載入完成，驗證 activeTripId 是否有效
    useEffect(() => {
        if (!isLoading && trips.length > 0) {
            if (activeTripId) {
                // 檢查快取的 ID 是否存在於 trips 中
                const tripExists = trips.some((t: { id: string }) => t.id === activeTripId)
                if (!tripExists) {
                    console.log("⚠️ 快取的行程已刪除，自動選擇最新行程")
                    const latestTrip = trips[0]
                    setActiveTripId(latestTrip.id)
                    setActiveTripTitle(latestTrip.title || null)
                }
            } else {
                // 沒有選中行程時，預設選中最新的行程
                const latestTrip = trips[0]
                setActiveTripId(latestTrip.id)
                setActiveTripTitle(latestTrip.title || null)
            }
        }
    }, [isLoading, trips, activeTripId, setActiveTripId, setActiveTripTitle])

    // 當切換行程時的處理函數
    const handleSetActiveTripId = (id: string | null) => {
        startTransition(() => {
            setActiveTripId(id)
            if (id) {
                // 同步到舊的 localStorage 格式 (向後兼容)
                localStorage.setItem("active_trip_id", id)
                const trip = trips.find((t: { id: string }) => t.id === id)
                if (trip?.title) {
                    localStorage.setItem("active_trip_title", trip.title)
                    setActiveTripTitle(trip.title)
                }
            } else {
                localStorage.removeItem("active_trip_id")
                localStorage.removeItem("active_trip_title")
                setActiveTripTitle(null)
            }
        })
    }

    const activeTrip = trips.find((t: { id: string; title?: string }) => t.id === activeTripId) || null

    // 當 activeTrip 變更時，更新 title
    useEffect(() => {
        if (activeTrip?.title) {
            localStorage.setItem("active_trip_title", activeTrip.title)
            setActiveTripTitle(activeTrip.title)
        }
    }, [activeTrip, setActiveTripTitle])

    return (
        <TripContext.Provider value={{
            activeTripId,
            setActiveTripId: handleSetActiveTripId,
            trips,
            isLoading,
            activeTrip,
            mutate,
            userId,
            isTransitioning
        }}>
            {children}
        </TripContext.Provider>
    )
}

export function useTripContext() {
    const context = useContext(TripContext)
    if (context === undefined) {
        throw new Error("useTripContext must be used within a TripProvider")
    }
    return context
}

