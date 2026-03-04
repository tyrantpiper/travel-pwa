"use client"

import { ExternalLink } from "lucide-react"
import { useLanguage } from "@/lib/LanguageContext"

interface GroundingSource {
    title: string
    uri: string
}

interface SourceCitationProps {
    sources: GroundingSource[]
}

/**
 * 📚 來源標籤 (Source Citation)
 * 
 * 顯示 AI 回應的資料來源，建立資訊時效性信任
 * 點擊可開啟原始來源網頁
 */
export default function SourceCitation({ sources }: SourceCitationProps) {
    const { lang } = useLanguage()
    const zh = lang === 'zh'
    if (!sources || sources.length === 0) return null

    return (
        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-slate-100">
            <span className="text-[10px] text-slate-400 mr-1">{zh ? '來源：' : 'Sources:'}</span>
            {sources.map((source, idx) => (
                <a
                    key={idx}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors"
                    title={source.uri}
                >
                    {/* Truncate long titles */}
                    <span className="max-w-[120px] truncate">
                        {source.title || new URL(source.uri).hostname}
                    </span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                </a>
            ))}
        </div>
    )
}
