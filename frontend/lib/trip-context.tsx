"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useTrips } from "./hooks"

interface TripContextType {
    activeTripId: string | null
    setActiveTripId: (id: string | null) => void
    trips: any[]
    isLoading: boolean
    activeTrip: any | null
    mutate: () => void
    userId: string | null
}

const TripContext = createContext<TripContextType | undefined>(undefined)

export function TripProvider({ children }: { children: ReactNode }) {
    const [userId, setUserId] = useState<string | null>(null)
    const [activeTripId, setActiveTripId] = useState<string | null>(null)

    // 初始化時從 localStorage 讀取 user_uuid
    useEffect(() => {
        if (typeof window !== "undefined") {
            setUserId(localStorage.getItem("user_uuid"))
            // 嘗試恢復上次選中的行程
            const savedTripId = localStorage.getItem("active_trip_id")
            if (savedTripId) setActiveTripId(savedTripId)
        }
    }, [])

    const { trips, isLoading, mutate } = useTrips(userId)

    // 當 trips 載入完成且沒有選中行程時，預設選中最新的行程
    useEffect(() => {
        if (!isLoading && trips.length > 0 && !activeTripId) {
            const latestTrip = trips[0] // 假設 API 回傳已排序
            setActiveTripId(latestTrip.id)
            localStorage.setItem("active_trip_id", latestTrip.id)
        }
    }, [isLoading, trips, activeTripId])

    // 當切換行程時，儲存到 localStorage
    const handleSetActiveTripId = (id: string | null) => {
        setActiveTripId(id)
        if (id) {
            localStorage.setItem("active_trip_id", id)
            // 🆕 儲存行程標題，供 ChatWidget 使用
            const trip = trips.find((t: { id: string }) => t.id === id)
            if (trip?.title) {
                localStorage.setItem("active_trip_title", trip.title)
            }
        } else {
            localStorage.removeItem("active_trip_id")
            localStorage.removeItem("active_trip_title")
        }
    }

    const activeTrip = trips.find((t: { id: string; title?: string }) => t.id === activeTripId) || null

    // 🆕 當 activeTrip 變更時，也更新 localStorage
    useEffect(() => {
        if (activeTrip?.title) {
            localStorage.setItem("active_trip_title", activeTrip.title)
        }
    }, [activeTrip])

    return (
        <TripContext.Provider value={{
            activeTripId,
            setActiveTripId: handleSetActiveTripId,
            trips,
            isLoading,
            activeTrip,
            mutate,
            userId
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
