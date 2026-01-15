"use client"

import { useCallback, useEffect, useState } from 'react';
import { SyncQueue, MAX_RETRIES, SyncRequest } from './sync-engine';
import { toast } from "sonner";

/**
 * 🛠️ React Hook: useOfflineMutation
 * usage: const { mutate, isQueued } = useOfflineMutation()
 */
export function useOfflineMutation() {
    const [isQueued, setIsQueued] = useState(false);

    const mutate = useCallback(async (url: string, options: RequestInit) => {
        if (typeof window !== 'undefined' && !navigator.onLine) {
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
 * In a real PWA this would be a Service Worker, but for now we run it in the main thread
 * when the app is open (Client-side Intelligence).
 */
export function useBackgroundSync() {
    useEffect(() => {
        if (typeof window === 'undefined') return;

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

                        // Visual Feedback
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
