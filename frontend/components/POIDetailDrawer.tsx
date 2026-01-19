"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    X, MapPin, Phone, Globe, Clock,
    Navigation, Share2, Plus, Sparkles,
    ExternalLink, Image as ImageIcon, Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useHaptic } from "@/lib/hooks"

// POI 基礎資料 (來自 OSM 向量圖層)
export interface POIBasicData {
    name: string
    type: string  // restaurant, cafe, shop, etc.
    address?: string
    lat: number
    lng: number
    phone?: string
    website?: string
    opening_hours?: string
    photo_url?: string   // 🆕 Optional photo from external sources
    image_url?: string   // 🆕 Alternative image field
}

// AI 增強資料
export interface POIEnrichData {
    summary: string        // AI 懶人包
    must_try: string[]     // 必點推薦
    rating: number         // 綜合評分 (1-5)
    business_status?: string
}

interface POIDetailDrawerProps {
    isOpen: boolean
    onClose: () => void
    poi: POIBasicData | null
    onAddToItinerary: (poi: POIBasicData, time: string, aiSummary?: POIEnrichData) => void
    suggestedTime?: string  // 建議時間 (來自父組件計算)
}

export default function POIDetailDrawer({
    isOpen,
    onClose,
    poi,
    onAddToItinerary,
    suggestedTime = "10:00"
}: POIDetailDrawerProps) {
    const haptic = useHaptic()
    const [aiData, setAiData] = useState<POIEnrichData | null>(null)
    const [aiLoading, setAiLoading] = useState(false)
    const [aiError, setAiError] = useState<string | null>(null)
    const [selectedTime, setSelectedTime] = useState(suggestedTime)
    const [isSharing, setIsSharing] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)  // 🆕 最小化狀態

    // 🛡️ 狀態重置：當 POI 變更或關閉時清除舊資料
    useEffect(() => {
        setAiData(null)
        setAiError(null)
        setAiLoading(false)
        setSelectedTime(suggestedTime)
        setIsMinimized(false)  // 🆕 重置最小化狀態
    }, [poi?.name, poi?.lat, poi?.lng, suggestedTime, isOpen])

    if (!poi) return null

    // 類別圖示對照
    const getTypeIcon = (type: string) => {
        const typeMap: Record<string, string> = {
            restaurant: "🍽️",
            cafe: "☕",
            bar: "🍺",
            shop: "🛍️",
            hotel: "🏨",
            museum: "🏛️",
            park: "🌳",
            temple: "⛩️",
            default: "📍"
        }
        return typeMap[type.toLowerCase()] || typeMap.default
    }

    // 深層連結：Google Maps 導航
    const handleNavigate = () => {
        haptic.tap()
        const url = `https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lng}`
        window.open(url, "_blank")
    }

    // 深層連結：Google Image 搜尋（包含位置資訊）
    const handleViewPhotos = () => {
        haptic.tap()
        // 優先用地址，其次用坐標（給 Google 提示是日本的店）
        let locationHint = ''
        if (poi.address) {
            locationHint = poi.address.split(',')[0]
        } else if (poi.lat && poi.lng) {
            // 無地址時，用日本地理提示讓 Google 搜尋日本結果
            locationHint = '日本 Japan'
        }
        const query = encodeURIComponent(`${poi.name} ${locationHint}`.trim())
        const url = `https://www.google.com/search?tbm=isch&q=${query}`
        window.open(url, "_blank")
    }

    // Web Share API
    const handleShare = async () => {
        if (isSharing) return
        haptic.tap()

        if (navigator.share) {
            setIsSharing(true)
            try {
                await navigator.share({
                    title: poi.name,
                    text: `${poi.name} - ${poi.type}`,
                    url: `https://www.google.com/maps/search/?api=1&query=${poi.lat},${poi.lng}`
                })
            } catch (err) {
                const error = err as Error
                if (error.name !== 'AbortError' && error.name !== 'InvalidStateError') {
                    console.error("POI Share failed:", err)
                }
            } finally {
                setIsSharing(false)
            }
        }
    }

    // 加入行程
    const handleAddToItinerary = () => {
        haptic.success()
        onAddToItinerary(poi, selectedTime, aiData || undefined)
        onClose()
    }

    // AI 分析 (Layer 2)
    const handleAIAnalyze = async () => {

        haptic.tap()
        setAiLoading(true)
        setAiError(null)

        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/poi/ai-enrich`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: poi.name,
                        type: poi.type,
                        lat: poi.lat,
                        lng: poi.lng,
                        api_key: localStorage.getItem("user_gemini_key")
                    })
                }
            )

            if (!response.ok) throw new Error("AI 分析失敗")

            const data = await response.json()
            setAiData(data)
        } catch {
            setAiError("無法取得 AI 分析，請稍後再試")
        } finally {
            setAiLoading(false)
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* 背景遮罩 - 最小化時隱藏 */}
                    {!isMinimized && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                            className="fixed inset-0 bg-black/50 z-50"
                        />
                    )}

                    {/* Drawer 主體 */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className={`fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl overflow-hidden transition-all ${isMinimized ? 'max-h-[120px]' : 'max-h-[80vh]'}`}
                    >
                        {/* 🆕 拖曳把手 - 點擊切換最小化 */}
                        <button
                            onClick={() => setIsMinimized(!isMinimized)}
                            className="w-full flex flex-col items-center pt-3 pb-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
                        >
                            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full group-hover:bg-slate-400 transition-colors" />
                            <span className="text-xs text-slate-400 mt-1 group-hover:text-slate-600 transition-colors">
                                {isMinimized ? "▲ 展開" : "▼ 收起"}
                            </span>
                        </button>

                        {/* 關閉按鈕 */}
                        <button
                            onClick={() => { onClose(); setIsMinimized(false); }}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* 🆕 最小化時只顯示標題 */}
                        {isMinimized ? (
                            <div className="px-6 pb-4 flex items-center gap-3">
                                <span className="text-2xl">{getTypeIcon(poi.type)}</span>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-slate-900 dark:text-white truncate">{poi.name}</h3>
                                    <p className="text-xs text-slate-500 truncate">{poi.address || poi.type}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="px-6 pb-6 space-y-4 overflow-y-auto max-h-[calc(80vh-60px)]">
                                {/* ========== Layer 1: OSM 骨架層 ========== */}

                                {/* Header */}
                                <div className="flex items-start gap-3">
                                    <span className="text-3xl">{getTypeIcon(poi.type)}</span>
                                    <div className="flex-1">
                                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                            {poi.name}
                                        </h2>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">
                                            {poi.type}
                                        </p>
                                    </div>
                                </div>

                                {/* 基礎資訊 */}
                                <div className="space-y-2 text-sm">
                                    {poi.address && (
                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                            <MapPin className="w-4 h-4 flex-shrink-0" />
                                            <span>{poi.address}</span>
                                        </div>
                                    )}
                                    {poi.phone && (
                                        <a
                                            href={`tel:${poi.phone}`}
                                            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                                        >
                                            <Phone className="w-4 h-4 flex-shrink-0" />
                                            <span>{poi.phone}</span>
                                        </a>
                                    )}
                                    {poi.website && (
                                        <a
                                            href={poi.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                                        >
                                            <Globe className="w-4 h-4 flex-shrink-0" />
                                            <span className="truncate">{poi.website}</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                    {poi.opening_hours && (
                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                            <Clock className="w-4 h-4 flex-shrink-0" />
                                            <span>{poi.opening_hours}</span>
                                        </div>
                                    )}
                                </div>

                                {/* 🆕 時間選擇器 */}
                                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                                    <Clock className="w-5 h-5 text-indigo-500" />
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">加入時間</span>
                                    <input
                                        type="time"
                                        value={selectedTime}
                                        onChange={(e) => setSelectedTime(e.target.value)}
                                        className="ml-auto px-3 py-1.5 text-sm font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                </div>

                                {/* 主要操作按鈕 */}
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleNavigate}
                                        variant="outline"
                                        className="flex-1 gap-2"
                                    >
                                        <Navigation className="w-4 h-4" />
                                        導航
                                    </Button>
                                    <Button
                                        onClick={handleShare}
                                        variant="outline"
                                        className="flex-1 gap-2"
                                    >
                                        <Share2 className="w-4 h-4" />
                                        分享
                                    </Button>
                                    <Button
                                        onClick={handleAddToItinerary}
                                        className="flex-1 gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
                                    >
                                        <Plus className="w-4 h-4" />
                                        加入行程
                                    </Button>
                                </div>

                                {/* ========== Layer 2: AI 智慧層 ========== */}

                                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                                    {!aiData && !aiLoading && (
                                        <Button
                                            onClick={handleAIAnalyze}
                                            variant="ghost"
                                            className="w-full gap-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                        >
                                            <Sparkles className="w-4 h-4" />
                                            ✨ 分析此地點
                                        </Button>
                                    )}

                                    {aiLoading && (
                                        <div className="space-y-3 animate-pulse">
                                            <div className="flex items-center gap-2 text-purple-500">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span className="text-sm">AI 正在分析網路評價與熱門菜單...</span>
                                            </div>
                                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                                        </div>
                                    )}

                                    {aiError && (
                                        <p className="text-sm text-red-500 text-center">{aiError}</p>
                                    )}

                                    {aiData && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-3 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl p-4"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-purple-500" />
                                                <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                                                    AI 懶人包
                                                </span>
                                                {aiData.rating && (
                                                    <span className="ml-auto text-sm font-bold text-amber-600">
                                                        ⭐ {aiData.rating.toFixed(1)}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-700 dark:text-slate-300">
                                                {aiData.summary}
                                            </p>
                                            {aiData.must_try && aiData.must_try.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1">
                                                        🍽️ 必點推薦
                                                    </p>
                                                    <ul className="text-sm text-slate-600 dark:text-slate-400 list-disc list-inside">
                                                        {aiData.must_try.map((item, i) => (
                                                            <li key={i}>{item}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </div>

                                {/* ========== Layer 3: 導流層 ========== */}

                                <div className="flex gap-2 pt-2">
                                    <Button
                                        onClick={handleViewPhotos}
                                        variant="ghost"
                                        size="sm"
                                        className="flex-1 gap-2 text-slate-600"
                                    >
                                        <ImageIcon className="w-4 h-4" />
                                        看網友照片
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            // 使用精確坐標開啟 Google Maps
                                            const url = `https://www.google.com/maps/search/?api=1&query=${poi.lat},${poi.lng}`
                                            window.open(url, "_blank")
                                        }}
                                        variant="ghost"
                                        size="sm"
                                        className="flex-1 gap-2 text-slate-600"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        在 Google Maps 開啟
                                    </Button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
