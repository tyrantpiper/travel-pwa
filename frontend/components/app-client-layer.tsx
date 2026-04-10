"use client"

import dynamic from "next/dynamic"
import { Suspense } from "react"

// 🚀 [Perf Audit 2026] 建立客戶端隔離區 (Client Boundary)
// 1. 解決 Server Component (layout.tsx) 不能直接使用 ssr:false dynamic 的限制
// 2. 確保 AI 機器人在背景獨立 Hydrate，不阻塞首屏渲染
const ChatWidget = dynamic(() => import("@/components/chat-widget").then(mod => mod.default), {
    ssr: false,
})

export function AppClientLayer() {
    return (
        <Suspense fallback={null}>
            <ChatWidget />
        </Suspense>
    )
}
