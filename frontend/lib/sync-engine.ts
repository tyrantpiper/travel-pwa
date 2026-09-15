import { get, update } from 'idb-keyval';
import { useSyncStatusStore } from './stores/syncStatusStore';

// === Types ===
export interface SyncRequest {
    id: string;
    url: string;
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: any;
    headers?: Record<string, string>;
    timestamp: number;
    retryCount: number;
}

// === CONSTANTS ===
const STORE_KEY = 'offline-sync-queue';
export const MAX_RETRIES = 3;

function inferEntityType(url: string): 'expense' | 'itinerary_item' | 'trip' | 'general' {
    if (url.includes('/ledger/') || url.includes('/expenses')) return 'expense';
    if (url.includes('/trips/')) return 'itinerary_item';
    return 'general';
}

/**
 * 🔄 Sync Queue Manager (IndexedDB Wrapper)
 */
export const SyncQueue = {
    /** Enqueue a new request */
    enqueue: async (request: Omit<SyncRequest, 'id' | 'timestamp' | 'retryCount'>) => {
        const id = crypto.randomUUID();
        const newReq: SyncRequest = {
            ...request,
            id,
            timestamp: Date.now(),
            retryCount: 0
        };

        await update(STORE_KEY, (old: SyncRequest[] = []) => [...old, newReq]);
        console.log(`[SyncQueue] 📥 Enqueued: ${request.url} (ID: ${id})`);

        // ⚡ E4: 登記至全域樂觀 UI 狀態機
        try {
            const entityType = inferEntityType(request.url);
            const entityId = request.body?.id || request.body?.expense_id || request.body?.item_id;
            const title = request.body?.title || request.body?.description || request.body?.name;
            useSyncStatusStore.getState().trackMutation({
                mutationId: id,
                targetUrl: request.url,
                method: request.method,
                entityType,
                entityId,
                tempId: id,
                title,
                status: 'pending',
                retryCount: 0,
                timestamp: Date.now(),
            });
        } catch {
            // 忽略狀態機通知異常，保障 IndexedDB 主流程不受阻
        }

        return id;
    },

    /** Dequeue a request by ID */
    dequeue: async (id: string) => {
        await update(STORE_KEY, (old: SyncRequest[] = []) => old.filter(r => r.id !== id));
        try {
            useSyncStatusStore.getState().updateStatus(id, 'synced');
            setTimeout(() => {
                useSyncStatusStore.getState().removeMutation(id);
            }, 2500);
        } catch {
            // 安全守護
        }
    },

    /** Get all pending requests */
    peek: async (): Promise<SyncRequest[]> => {
        if (typeof window === 'undefined') return []; // safety for SSR
        return (await get(STORE_KEY)) || [];
    },

    /** Increment retry count for a request */
    incrementRetry: async (id: string) => {
        await update(STORE_KEY, (old: SyncRequest[] = []) =>
            old.map(r => r.id === id ? { ...r, retryCount: r.retryCount + 1 } : r)
        );
    }
};
