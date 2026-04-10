import { LedgerClient } from "@/components/ledger-client"
import { Suspense } from "react"

interface PageProps {
    params: Promise<{ code: string }>
}

// 🚀 [2026 Architectural Alignment]
// 使用 Suspense 為 PPR 定義「孔位 (Hole)」
// 這能解決在 TripProvider 內部進行靜態分析時的崩潰問題
export default async function LedgerPage({ params }: PageProps) {
    const { code } = await params
    
    return (
        <Suspense fallback={null}>
            <LedgerClient code={code} />
        </Suspense>
    )
}
