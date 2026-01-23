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
            // 🆕 v2.6: Safe body handling (consistency with api.ts)
            let body: Record<string, unknown> = {};
            if (options.body instanceof FormData) {
                body = { _offline_type: 'formData' };
            } else {
                try {
                    body = options.body ? JSON.parse(options.body as string) : {};
                } catch {
                    body = { _raw: options.body as string };
                }
            }

            await SyncQueue.enqueue({
                url,
                method: (options.method as SyncRequest['method']) || 'POST',
                body,
                headers: options.headers as Record<string, string>
            });
            setIsQueued(true);
            return { ok: true, json: async () => ({ status: 'queued' }) };
        } else {
            return fetch(url, options);
        }
    }, []);

    return { mutate, isQueued };
}

// 🆕 Simple lock for processQueue
let isProcessing = false;

/**
 * ⚙️ Background Worker (Simulated)
 */
export function useBackgroundSync() {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const processQueue = async () => {
            if (!navigator.onLine || isProcessing) return;
            isProcessing = true;

            try {
                const queue = await SyncQueue.peek();
                if (queue.length === 0) return;

                console.log(`[SyncEngine] 🔄 Processing ${queue.length} offline requests...`);

                // 🆕 優化：依據行程 ID 分組以實現並行重播 (橫向並行，縱向序列)
                const groups: Record<string, SyncRequest[]> = {};
                const general: SyncRequest[] = [];

                queue.forEach(req => {
                    // 嘗試從 URL 提取行程 ID (例如: /api/trips/UUID/...)
                    const match = req.url.match(/\/api\/trips\/([a-f0-9-]{36})\//i);
                    const id = match ? match[1] : null;
                    if (id) {
                        if (!groups[id]) groups[id] = [];
                        groups[id].push(req);
                    } else {
                        general.push(req);
                    }
                });

                const processGroup = async (requests: SyncRequest[]) => {
                    for (const req of requests) {
                        try {
                            // 🆕 安全加固：Warn user about skipped FormData
                            if (req.body?._offline_type === 'formData') {
                                console.warn(`[SyncEngine] ⏭️ Skipping FormData: ${req.url}`);
                                toast.error("⚠️ 部分照片上傳在離線時被略過，請手動重新上傳。", {
                                    description: `路徑: ${req.url}`,
                                    duration: 5000
                                });
                                await SyncQueue.dequeue(req.id);
                                continue;
                            }

                            console.log(`[SyncEngine] ▶️ Replaying: ${req.url}`);
                            const res = await fetch(req.url, {
                                method: req.method,
                                headers: req.headers,
                                body: JSON.stringify(req.body)
                            });

                            if (res.ok) {
                                await SyncQueue.dequeue(req.id);
                                toast.success(`☁️ 已自動同步: ${req.method} ${req.url.split('/').pop()}`);
                            } else {
                                if (req.retryCount >= MAX_RETRIES) {
                                    await SyncQueue.dequeue(req.id);
                                } else {
                                    await SyncQueue.incrementRetry(req.id);
                                }
                                break; // ❌ 如果失敗，停止該分組後續操作以保證順序性
                            }
                        } catch (e) {
                            console.error(`[SyncEngine] 💥 Network Error in group sync:`, e);
                            break;
                        }
                    }
                };

                // 並行處理不同分組，但通用請求保持序列
                const groupTasks = Object.values(groups).map(processGroup);
                await Promise.allSettled([...groupTasks, processGroup(general)]);

            } finally {
                isProcessing = false;
            }
        };

        const interval = setInterval(processQueue, 30000);
        window.addEventListener('online', processQueue);

        return () => {
            clearInterval(interval);
            window.removeEventListener('online', processQueue);
        };
    }, []);
}


