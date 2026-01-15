"use client"

import { useBackgroundSync } from "@/lib/sync-hooks"

export function SyncManager() {
    useBackgroundSync()
    return null
}
