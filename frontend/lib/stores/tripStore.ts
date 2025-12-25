/**
 * Trip Store - Zustand State Management
 * Manages global trip state with localStorage persistence
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TripState {
    // State
    activeTripId: string | null
    userId: string | null
    activeTripTitle: string | null

    // Actions
    setActiveTripId: (id: string | null) => void
    setUserId: (id: string | null) => void
    setActiveTripTitle: (title: string | null) => void
    initializeFromStorage: () => void
}

export const useTripStore = create<TripState>()(
    persist(
        (set) => ({
            // Initial state
            activeTripId: null,
            userId: null,
            activeTripTitle: null,

            // Actions
            setActiveTripId: (id) => set({ activeTripId: id }),
            setUserId: (id) => set({ userId: id }),
            setActiveTripTitle: (title) => set({ activeTripTitle: title }),

            // Initialize from legacy localStorage (for migration)
            initializeFromStorage: () => {
                if (typeof window !== 'undefined') {
                    const userId = localStorage.getItem('user_uuid')
                    const activeTripId = localStorage.getItem('active_trip_id')
                    const activeTripTitle = localStorage.getItem('active_trip_title')

                    set({
                        userId,
                        activeTripId,
                        activeTripTitle
                    })
                }
            }
        }),
        {
            name: 'trip-storage', // localStorage key
            partialize: (state) => ({
                // Only persist these fields
                activeTripId: state.activeTripId,
                activeTripTitle: state.activeTripTitle,
                // Note: userId is managed separately by user auth flow
            }),
        }
    )
)

/**
 * Selector hooks for performance optimization
 */
export const useActiveTripId = () => useTripStore((s) => s.activeTripId)
export const useUserId = () => useTripStore((s) => s.userId)
export const useActiveTripTitle = () => useTripStore((s) => s.activeTripTitle)
