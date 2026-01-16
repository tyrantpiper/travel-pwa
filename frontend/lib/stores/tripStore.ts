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
    focusedDay: number // 🆕 2026: The day currently being viewed in the UI

    // Actions
    setActiveTripId: (id: string | null) => void
    setUserId: (id: string | null) => void
    setActiveTripTitle: (title: string | null) => void
    setFocusedDay: (day: number) => void // 🆕 2026
    initializeFromStorage: () => void
}

/**
 * 🔧 FIX: Sync initialize userId from localStorage to fix race condition
 * This ensures userId is available immediately on first render
 * 🆕 Auto-generates UUID if not exists
 */
const getInitialUserId = (): string | null => {
    if (typeof window !== 'undefined') {
        let uuid = localStorage.getItem('user_uuid')
        if (!uuid) {
            // 🆕 Auto-generate UUID for new users
            uuid = crypto.randomUUID?.() ||
                'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                    const r = Math.random() * 16 | 0
                    const v = c === 'x' ? r : (r & 0x3 | 0x8)
                    return v.toString(16)
                })
            localStorage.setItem('user_uuid', uuid)
            console.log('🆕 Auto-generated user_uuid:', uuid)
        }
        return uuid
    }
    return null
}

export const useTripStore = create<TripState>()(
    persist(
        (set) => ({
            // Initial state - 🔧 userId now sync initialized
            activeTripId: null,
            userId: getInitialUserId(),
            activeTripTitle: null,
            focusedDay: 1, // Default to Day 1

            // Actions
            setActiveTripId: (id) => set({ activeTripId: id }),
            setUserId: (id) => set({ userId: id }),
            setActiveTripTitle: (title) => set({ activeTripTitle: title }),
            setFocusedDay: (day) => set({ focusedDay: day }),

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
                userId: state.userId  // 🔧 FIX: Now also persist userId
            }),
            // 🔧 FIX: Custom merge to prevent sync-initialized userId from being overwritten
            merge: (persistedState, currentState) => {
                const persisted = persistedState as Partial<TripState>
                return {
                    ...currentState,
                    ...persisted,
                    // If persisted userId is empty, use sync-initialized value
                    userId: persisted?.userId || currentState.userId
                }
            }
        }
    )
)

/**
 * Selector hooks for performance optimization
 */
export const useActiveTripId = () => useTripStore((s) => s.activeTripId)
export const useUserId = () => useTripStore((s) => s.userId)
export const useActiveTripTitle = () => useTripStore((s) => s.activeTripTitle)
export const useFocusedDay = () => useTripStore((s) => s.focusedDay)
