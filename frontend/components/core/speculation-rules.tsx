"use client"

import { useEffect, useMemo } from "react"
import { useTripContextSafe } from "@/lib/trip-context"

interface SpeculationRulesProps {
    tripIds?: string[]
}

/**
 * 🚀 Chromium 原生 Speculation Rules 預渲染引擎
 * 榨乾背景 CPU 與渲染進程，對核心後續行程發起激進式預渲染
 * 🛡️ 關鍵防護：徹底排除自身頁面路徑，絕不對首頁自身進行遞迴自渲染轟炸
 */
export function SpeculationRules({ tripIds }: SpeculationRulesProps) {
    const tripContext = useTripContextSafe()
    const trips = tripContext?.trips

    const contextTripIds = useMemo(() => {
        if (!trips || !Array.isArray(trips)) return []
        return trips.map((t: { id: string }) => t.id).filter(Boolean)
    }, [trips])

    const effectiveTripIds = useMemo(() => {
        if (tripIds && tripIds.length > 0) return tripIds.filter(Boolean)
        return contextTripIds
    }, [tripIds, contextTripIds])

    useEffect(() => {
        if (typeof document === "undefined") return

        // 🛡️ 嚴格排除根路徑 "/"，僅對具體的後續目標行程發起預渲染，徹底避免自我轟炸
        const targetUrls = effectiveTripIds
            .slice(0, 3)
            .map(id => `/?trip=${id}`)

        const existingScript = document.getElementById("tabidachi-speculation-rules")
        if (existingScript) {
            existingScript.remove()
        }

        try {
            const specScript = document.createElement("script")
            specScript.id = "tabidachi-speculation-rules"
            specScript.type = "speculationrules"
            specScript.textContent = JSON.stringify({
                prerender: [
                    {
                        source: "list",
                        urls: targetUrls,
                        eagerness: "eager" // 🔥 激進全速預渲染模式
                    }
                ]
            })
            document.head.appendChild(specScript)
        } catch (err) {
            // 靜默降級，非 Chromium 核心無感跳過
            console.debug("[SpeculationRules] Non-Chromium or security sandbox skipped:", err)
        }
    }, [effectiveTripIds])

    return null
}
