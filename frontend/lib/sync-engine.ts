import { get, update } from 'idb-keyval';
import { useCallback, useEffect, useState } from 'react';

// === Types ===
interface SyncRequest {
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
const MAX_RETRIES = 3;

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
        return (await get(STORE_KEY)) || [];
    },

    /** Increment retry count for a request */
    incrementRetry: async (id: string) => {
        await update(STORE_KEY, (old: SyncRequest[] = []) =>
            old.map(r => r.id === id ? { ...r, retryCount: r.retryCount + 1 } : r)
        );
    }
};

/**
 * 🛠️ React Hook: useOfflineMutation
 * usage: const { mutate, isQueued } = useOfflineMutation()
 */
export function useOfflineMutation() {
    const [isQueued, setIsQueued] = useState(false);

    const mutate = useCallback(async (url: string, options: RequestInit) => {
        if (!navigator.onLine) {
            // Offline Mode: Queue it
            await SyncQueue.enqueue({
                url,
                method: (options.method as SyncRequest['method']) || 'POST',
                body: options.body ? JSON.parse(options.body as string) : {},
                headers: options.headers as Record<string, string>
            });
            setIsQueued(true);
            // Simulate 'success' to UI for optimistic updates
            return { ok: true, json: async () => ({ status: 'queued' }) };
        } else {
            // Online Mode: Direct fetch
            return fetch(url, options);
        }
    }, []);

    return { mutate, isQueued };
}

/**
 * ⚙️ Background Worker (Simulated)
 */
// 🆕 Import toast
import { toast } from "sonner";

/**
 * ⚙️ Background Worker (Simulated)
 * In a real PWA this would be a Service Worker, but for now we run it in the main thread
 * when the app is open (Client-side Intelligence).
 */
export function useBackgroundSync() {
    useEffect(() => {
        const processQueue = async () => {
            if (!navigator.onLine) return;

            const queue = await SyncQueue.peek();
            if (queue.length === 0) return;

            console.log(`[SyncEngine] 🔄 Processing ${queue.length} offline requests...`);

            for (const req of queue) {
                try {
                    console.log(`[SyncEngine] ▶️ Replaying: ${req.url}`);
                    const res = await fetch(req.url, {
                        method: req.method,
                        headers: req.headers,
                        body: JSON.stringify(req.body)
                    });

                    if (res.ok) {
                        await SyncQueue.dequeue(req.id);
                        console.log(`[SyncEngine] ✅ Sync Success: ${req.url}`);

                        // 🆕 Polish: Visual Feedback
                        toast.success(`☁️ 已自動同步相關操作`);
                    } else {
                        console.error(`[SyncEngine] ❌ Sync Failed: ${req.url} (${res.status})`);
                        if (req.retryCount >= MAX_RETRIES) {
                            console.warn(`[SyncEngine] 💀 Dropping request after ${MAX_RETRIES} retries`);
                            await SyncQueue.dequeue(req.id); // Give up to prevent jamming
                        } else {
                            await SyncQueue.incrementRetry(req.id);
                        }
                    }
                } catch (e) {
                    console.error(`[SyncEngine] 💥 Network Error during sync:`, e);
                }
            }
        };

        const interval = setInterval(processQueue, 30000); // Check every 30s
        window.addEventListener('online', processQueue);

        return () => {
            clearInterval(interval);
            window.removeEventListener('online', processQueue);
        };
    }, []);
}
