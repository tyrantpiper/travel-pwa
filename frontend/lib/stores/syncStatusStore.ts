/**
 * Sync Status Store - Zustand State Management
 * ⚡ E4: 離線突變樂觀 UI 狀態機
 * 追蹤所有未完成上雲的離線變更 (費用、景點、行程)，提供琥珀色/綠色/紅色視覺徽章與頂部膠囊狀態
 */
import { create } from 'zustand'

export type ItemSyncStatus = 'pending' | 'syncing' | 'synced' | 'failed'

export interface PendingMutationMeta {
    mutationId: string
    targetUrl: string
    method: string
    entityType: 'expense' | 'itinerary_item' | 'trip' | 'general'
    entityId?: string
    tempId?: string
    title?: string
    status: ItemSyncStatus
    errorMessage?: string
    retryCount: number
    timestamp: number
}

interface SyncStatusState {
    mutations: Record<string, PendingMutationMeta>
    pendingCount: number
    failedCount: number
    isOnline: boolean

    // Actions
    trackMutation: (meta: PendingMutationMeta) => void
    updateStatus: (mutationId: string, status: ItemSyncStatus, error?: string) => void
    removeMutation: (mutationId: string) => void
    setIsOnline: (online: boolean) => void
    clearSynced: () => void
    getMutationByEntityId: (id: string) => PendingMutationMeta | undefined
}

function calculateCounts(mutations: Record<string, PendingMutationMeta>) {
    let pending = 0
    let failed = 0
    Object.values(mutations).forEach(m => {
        if (m.status === 'pending' || m.status === 'syncing') pending++
        if (m.status === 'failed') failed++
    })
    return { pendingCount: pending, failedCount: failed }
}

export const useSyncStatusStore = create<SyncStatusState>((set, get) => ({
    mutations: {},
    pendingCount: 0,
    failedCount: 0,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

    trackMutation: (meta) => set((state) => {
        const next = { ...state.mutations, [meta.mutationId]: meta }
        return {
            mutations: next,
            ...calculateCounts(next),
        }
    }),

    updateStatus: (mutationId, status, error) => set((state) => {
        const existing = state.mutations[mutationId]
        if (!existing) return state

        const updated: PendingMutationMeta = {
            ...existing,
            status,
            errorMessage: error !== undefined ? error : existing.errorMessage,
        }
        const next = { ...state.mutations, [mutationId]: updated }
        return {
            mutations: next,
            ...calculateCounts(next),
        }
    }),

    removeMutation: (mutationId) => set((state) => {
        if (!state.mutations[mutationId]) return state
        const next = { ...state.mutations }
        delete next[mutationId]
        return {
            mutations: next,
            ...calculateCounts(next),
        }
    }),

    setIsOnline: (online) => set({ isOnline: online }),

    clearSynced: () => set((state) => {
        const next: Record<string, PendingMutationMeta> = {}
        Object.entries(state.mutations).forEach(([id, meta]) => {
            if (meta.status !== 'synced') {
                next[id] = meta
            }
        })
        return {
            mutations: next,
            ...calculateCounts(next),
        }
    }),

    getMutationByEntityId: (id: string) => {
        const mutations = get().mutations
        return Object.values(mutations).find(
            m => m.entityId === id || m.tempId === id || m.mutationId === id
        )
    },
}))
