"use client"

import { useState } from "react"
import { MapPin, Plus, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { poiApi } from "@/lib/api"
import { useLanguage } from "@/lib/LanguageContext"
import { getSecureApiKey } from "@/lib/security"


// POI 類別定義
const POI_CATEGORIES = [
    { id: "department_store", name: "百貨", icon: "🏬" },
    { id: "restaurant", name: "美食", icon: "🍽️" },
    { id: "convenience", name: "超商", icon: "🏪" },
    { id: "supermarket", name: "超市", icon: "🛒" },
    { id: "pharmacy", name: "藥局", icon: "💊" },
    { id: "popular", name: "熱門", icon: "🔥" }
]

// Category name lookup for i18n
const CATEGORY_KEYS: Record<string, string> = {
    department_store: 'ps_department',
    restaurant: 'ps_restaurant',
    convenience: 'ps_convenience',
    supermarket: 'ps_supermarket',
    pharmacy: 'ps_pharmacy',
    popular: 'ps_popular'
}

interface POI {
    id: string
    name: string
    category: string
    lat: number
    lng: number
    distance?: number
    rating?: number
    opening_hours?: string
    address?: string
    phone?: string
    website?: string
    source?: string
}

interface POISearchProps {
    centerLat: number
    centerLng: number
    onSelectPOI?: (poi: POI) => void
    className?: string
}

export function POISearch({ centerLat, centerLng, onSelectPOI, className }: POISearchProps) {
    const { t } = useLanguage()
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [pois, setPois] = useState<POI[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [aiRecommendation, setAiRecommendation] = useState<string | null>(null)
    const [isAiLoading, setIsAiLoading] = useState(false)

    const handleCategoryClick = async (categoryId: string) => {
        if (selectedCategory === categoryId) {
            // 再次點擊同類別 = 取消搜索
            setSelectedCategory(null)
            setPois([])
            setAiRecommendation(null)
            return
        }

        setSelectedCategory(categoryId)
        setIsLoading(true)
        setPois([])
        setAiRecommendation(null)

        try {
            const userId = localStorage.getItem("user_uuid") || ""
            const data = await poiApi.nearby(centerLat, centerLng, categoryId, userId)
            setPois(data.pois || [])
        } catch (e) {
            console.error("POI search error:", e)
        } finally {
            setIsLoading(false)
        }
    }

    const handleAiRecommend = async () => {
        if (pois.length === 0) return

        setIsAiLoading(true)
        setAiRecommendation(null)

        try {
            const apiKey = getSecureApiKey()

            if (!apiKey) {
                setAiRecommendation(t('ps_no_api_key'))
                return
            }

            const userId = localStorage.getItem("user_uuid") || ""
            const data = await poiApi.recommend({
                pois: pois.slice(0, 10),
                user_query: "請推薦最適合觀光客的一間，說明原因。",
                api_key: apiKey,
                user_preferences: JSON.parse(localStorage.getItem("poi_preferences") || "{}")
            }, userId)
            setAiRecommendation(data.recommendation)
        } catch (e) {
            console.error("AI recommend error:", e)
            setAiRecommendation(t('ps_ai_failed'))
        } finally {
            setIsAiLoading(false)
        }
    }

    const getRatingStars = (rating?: number) => {
        if (!rating) return null
        const normalized = Math.min(5, Math.round(rating / 2))
        return "⭐".repeat(normalized)
    }

    return (
        <div className={className}>
            {/* 類別快速按鈕列 */}
            <div className="flex flex-wrap gap-2 py-2">
                {POI_CATEGORIES.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => handleCategoryClick(cat.id)}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === cat.id
                            ? "bg-amber-500 text-white shadow-md"
                            : "bg-secondary border border-input text-secondary-foreground hover:bg-secondary/80"
                            }`}
                    >
                        <span>{cat.icon}</span>
                        <span>{t(CATEGORY_KEYS[cat.id] as Parameters<typeof t>[0]) || cat.name}</span>
                    </button>
                ))}
            </div>

            {/* 搜索結果 */}
            {(isLoading || pois.length > 0) && (
                <div className="mt-3">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8 text-slate-400">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            <span>{t('ps_searching')}</span>
                        </div>
                    ) : (
                        <>
                            {/* AI 推薦按鈕 */}
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-slate-500">
                                    {t('ps_result_count', { count: String(pois.length) })}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleAiRecommend}
                                    disabled={isAiLoading}
                                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                >
                                    {isAiLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                    ) : (
                                        <Sparkles className="w-4 h-4 mr-1" />
                                    )}
                                    {t('ps_ai_recommend')}
                                </Button>
                            </div>

                            {/* AI 推薦結果 */}
                            {aiRecommendation && (
                                <Card className="p-3 mb-3 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
                                    <div className="flex items-start gap-2">
                                        <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-slate-700">{aiRecommendation}</p>
                                    </div>
                                </Card>
                            )}

                            {/* POI 列表 */}
                            <ScrollArea className="max-h-[300px]">
                                <div className="space-y-2">
                                    {pois.slice(0, 10).map((poi) => (
                                        <div
                                            key={poi.id}
                                            className="p-3 bg-card rounded-lg border border-border hover:border-amber-300 hover:shadow-sm transition-all cursor-pointer"
                                            onClick={() => onSelectPOI?.(poi)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                                        <span className="font-medium text-slate-800 text-sm">
                                                            {poi.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                                        <span>{poi.distance}m</span>
                                                        {poi.rating && (
                                                            <span>{getRatingStars(poi.rating)}</span>
                                                        )}
                                                        {poi.opening_hours && (
                                                            <span className="truncate max-w-[120px]">
                                                                {poi.opening_hours}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {onSelectPOI && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 text-slate-400 hover:text-amber-500 hover:bg-amber-50"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            onSelectPOI(poi)
                                                        }}
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
