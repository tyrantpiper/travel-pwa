"use client"

import { useBackgroundSync } from "@/lib/sync-engine"

export function SyncManager() {
    useBackgroundSync()
    return null
}
