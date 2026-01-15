import { get, update } from 'idb-keyval';

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
        return id;
    },

    /** Dequeue a request by ID */
    dequeue: async (id: string) => {
        await update(STORE_KEY, (old: SyncRequest[] = []) => old.filter(r => r.id !== id));
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
