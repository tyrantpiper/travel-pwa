"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    X, MapPin, Phone, Globe, Clock,
    Navigation, Share2, Plus, Sparkles,
    ExternalLink, Image as ImageIcon, Loader2,
    BookOpen, Tent, AlertCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useHaptic } from "@/lib/hooks"
import { poiApi } from "@/lib/api"
import { useLanguage } from "@/lib/LanguageContext"
import { getSecureApiKey } from "@/lib/security"

export interface ClusterItem {
    id?: string;
    lat: number;
    lng: number;
    place: string;
    number: number;
    time?: string;
    category?: string;
    desc?: string;
    notes?: string;
    time_slot?: string;
}

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
    clusterItems?: ClusterItem[] // 🆕 Added for Cluster Support
    number?: number      // 🆕 Added for Itinerary Sequence
    poi_id?: string;      // 🆕 Added for precise caching
    wikidata_id?: string; // 🆕 Added for precise caching
}

// AI 增強資料
export interface POIEnrichData {
    summary: string;
    must_try: string[];
    rating: number;
    cultural_desc?: string;       // Layer 2: Wikipedia (Primary)
    travel_tips?: string;         // Layer 3: WikiVoyage (Secondary)
    resolved_language?: string;   // BCP 47 (e.g., "zh-TW")
    image_url?: string;           // 🆕 Phase 5: Wikipedia/Wikidata image
    status: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";
    warnings?: string[];
}

interface POIDetailDrawerProps {
    isOpen: boolean
    onClose: () => void
    poi: POIBasicData | null
    onAddToItinerary: (poi: POIBasicData, time: string, aiSummary?: POIEnrichData) => void
    suggestedTime?: string  // 建議時間 (來自父組件計算)
    isInternal?: boolean    // 🆕 是否在容器內部 (例如地圖內)
    onSelectClusterItem?: (item: ClusterItem) => void // 🆕 點擊群聚項目
}

export default function POIDetailDrawer({
    isOpen,
    onClose,
    poi,
    onAddToItinerary,
    suggestedTime = "10:00",
    isInternal = false,
    onSelectClusterItem
}: POIDetailDrawerProps) {
    const haptic = useHaptic()
    const { t } = useLanguage()
    const [aiData, setAiData] = useState<POIEnrichData | null>(null)
    const [aiLoading, setAiLoading] = useState(false)
    const [aiError, setAiError] = useState<string | null>(null)
    const [selectedTime, setSelectedTime] = useState(suggestedTime)
    const [isSharing, setIsSharing] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)

    // 🚀 Phase 3 Logic Guards (Unified Flow)
    const isLegacy = aiData && !('status' in aiData)
    const effectiveStatus = isLegacy ? undefined : aiData?.status
    
    const hasSummary = !!aiData?.summary?.trim()
    const hasCulturalDesc = !!aiData?.cultural_desc?.trim()
    const hasTravelTips = !!aiData?.travel_tips?.trim()
    const hasRenderableEnrichContent = hasSummary || hasCulturalDesc || hasTravelTips
    
    const showSkeleton = aiLoading && !hasRenderableEnrichContent
    const showWikipediaHint = effectiveStatus === "PARTIAL_SUCCESS" && !hasCulturalDesc
    const isFailed = effectiveStatus === "FAILED"

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
        } else if (aiData?.resolved_language) {
            // 🆕 根據解析語言提供動態地理提示 (Phase 6.3)
            const lang = aiData.resolved_language.toLowerCase()
            if (lang.includes('fa')) locationHint = '伊朗 Iran'
            else if (lang.includes('ja')) locationHint = '日本 Japan'
            else if (lang.includes('ko')) locationHint = '韓國 Korea'
            else if (lang.includes('fr')) locationHint = '法國 France'
            else if (lang.includes('de')) locationHint = '德國 Germany'
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
            const userId = localStorage.getItem("user_uuid") || ""
            const data = await poiApi.enrich({
                name: poi.name,
                type: poi.type,
                lat: poi.lat,
                lng: poi.lng,
                api_key: getSecureApiKey(),
                poi_id: poi.poi_id,
                wikidata_id: poi.wikidata_id
            }, userId)

            setAiData(data)
        } catch {
            setAiError(t('poi_ai_failed'))
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
                            className={`${isInternal ? 'absolute' : 'fixed'} inset-0 bg-black/50 ${isInternal ? 'z-[40]' : 'z-[100]'}`}
                        />
                    )}

                    {/* Drawer 主體 */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className={`${isInternal ? 'absolute' : 'fixed'} bottom-0 left-0 right-0 ${isInternal ? 'z-[50] border-t border-x border-slate-200 dark:border-slate-800' : 'z-[100] shadow-2xl'} bg-white dark:bg-slate-900 rounded-t-3xl overflow-hidden transition-all ${isMinimized ? 'max-h-[110px]' : (isInternal ? 'max-h-[70%]' : 'max-h-[85vh]')}`}
                    >
                        {/* 🆕 拖曳把手 - 點擊切換最小化 */}
                        <button
                            onClick={() => setIsMinimized(!isMinimized)}
                            className="w-full flex flex-col items-center pt-3 pb-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
                        >
                            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full group-hover:bg-slate-400 transition-colors" />
                            <span className="text-xs text-slate-400 mt-1 group-hover:text-slate-600 transition-colors">
                                {isMinimized ? t('poi_expand') : t('poi_collapse')}
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
                        ) : poi.type === 'cluster' ? (
                            /* 🆕 CLUSTER LIST VIEW (2026 Selection Menu) */
                            <div className="px-6 pb-8 space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white">{poi.name}</h3>
                                </div>
                                <div className={`grid gap-2 overflow-y-auto ${isInternal ? 'max-h-[220px]' : 'max-h-[50vh]'} pr-1`}>
                                    {poi.clusterItems?.map((item, idx) => (
                                        <button
                                            key={item.id || idx}
                                            onClick={() => {
                                                haptic.tap();
                                                if (onSelectClusterItem) {
                                                    onSelectClusterItem(item);
                                                } else {
                                                    onAddToItinerary({
                                                        name: item.place,
                                                        type: item.category || 'sightseeing',
                                                        lat: item.lat,
                                                        lng: item.lng,
                                                        address: item.desc || item.notes
                                                    }, item.time || "10:00");
                                                }
                                            }}
                                            className="w-full text-left p-4 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all active:scale-[0.98] group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-indigo-500/20">
                                                        {item.number}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors truncate">{item.place}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.time || item.time_slot || '--:--'}</div>
                                                    </div>
                                                </div>
                                                <div className="text-slate-300 group-hover:translate-x-1 transition-transform">→</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-400 text-center italic">{t('poi_tap_to_view')}</p>
                            </div>
                        ) : (
                            <div className={`px-6 pb-6 space-y-4 overflow-y-auto ${isInternal ? 'max-h-[240px]' : 'max-h-[calc(85vh-100px)]'}`}>
                                {/* ========== Layer 1: OSM 骨架層 ========== */}

                                {/* Header */}
                                <div className="flex items-start gap-3">
                                    {poi.number ? (
                                        <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm font-black shadow-lg shadow-indigo-500/20 shrink-0">
                                            {poi.number}
                                        </div>
                                    ) : (
                                        <span className="text-3xl">{getTypeIcon(poi.type)}</span>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">
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
                                            <span className="line-clamp-2">{poi.address}</span>
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
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('poi_add_time')}</span>
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
                                        {t('tc_navigate')}
                                    </Button>
                                    <Button
                                        onClick={handleShare}
                                        variant="outline"
                                        className="flex-1 gap-2"
                                    >
                                        <Share2 className="w-4 h-4" />
                                        {t('share')}
                                    </Button>
                                    <Button
                                        onClick={handleAddToItinerary}
                                        className="flex-1 gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
                                    >
                                        <Plus className="w-4 h-4" />
                                        {t('poi_add_to_trip')}
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
                                            ✨ {t('poi_explore')}
                                        </Button>
                                    )}

                                    {showSkeleton && (
                                        <div className="space-y-4 animate-pulse">
                                            {/* Summary Skeleton */}
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                                                    <div className="h-4 bg-purple-100 dark:bg-purple-900/30 rounded w-24" />
                                                </div>
                                                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                                                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-5/6" />
                                            </div>
                                            {/* Wikipedia Skeleton */}
                                            <div className="pt-2">
                                                <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl w-full" />
                                            </div>
                                            {/* Travel Tips Skeleton */}
                                            <div>
                                                <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl w-full" />
                                            </div>
                                        </div>
                                    )}

                                    {aiError || (isFailed && !aiLoading) ? (
                                        <div className="flex flex-col items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-800/30">
                                            <AlertCircle className="w-8 h-8 text-red-500 opacity-50" />
                                            <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                                                {aiError || t('poi_ai_failed')}
                                            </p>
                                            <Button 
                                                onClick={handleAIAnalyze}
                                                size="sm"
                                                variant="outline"
                                                className="border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50"
                                            >
                                                重試分析 (Retry)
                                            </Button>
                                        </div>
                                    ) : null}

                                    {aiData && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-4"
                                        >
                                            {/* Layer 1: AI / Core Summary */}
                                            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl p-4 space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <Sparkles className="w-4 h-4 text-purple-500" />
                                                    <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                                                        {t('poi_ai_suggestion')}
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
                                                    <div className="pt-1">
                                                        <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1">
                                                            🍽️ {t('poi_take_photo')}
                                                        </p>
                                                        <ul className="text-sm text-slate-600 dark:text-slate-400 list-disc list-inside">
                                                            {aiData.must_try.map((item, i) => (
                                                                <li key={i}>{item}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Layer 2: Wikipedia Insight (Primary) */}
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 px-1">
                                                    <BookOpen className="w-4 h-4 text-indigo-500" />
                                                    <span id="wiki-insight-label" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                        Wikipedia Insight
                                                    </span>
                                                </div>
                                                
                                                <div className="relative min-h-[100px]">
                                                    {hasCulturalDesc ? (
                                                        <div 
                                                            tabIndex={0}
                                                            role="region"
                                                            aria-labelledby="wiki-insight-label"
                                                            className="max-h-[140px] overflow-y-auto p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm text-slate-600 dark:text-slate-300 leading-relaxed focus:ring-2 focus:ring-indigo-500/50 outline-none transition-shadow"
                                                        >
                                                            {aiData.cultural_desc}
                                                            {/* Bottom Fade Overlay */}
                                                            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/90 dark:from-slate-900/90 to-transparent pointer-events-none rounded-b-xl" />
                                                        </div>
                                                    ) : showWikipediaHint ? (
                                                        <div className="p-4 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center gap-2 text-slate-400">
                                                            <AlertCircle className="w-4 h-4" />
                                                            <span className="text-xs italic" aria-live="polite">
                                                                Partial data temporarily unavailable.
                                                            </span>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>

                                            {/* Layer 3: Travel Tips (Secondary) */}
                                            {hasTravelTips && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 px-1">
                                                        <Tent className="w-4 h-4 text-emerald-500" />
                                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                            Travel Tips
                                                        </span>
                                                    </div>
                                                    <div className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100/50 dark:border-emerald-800/30 rounded-xl text-sm text-slate-600 dark:text-slate-300">
                                                        {aiData.travel_tips}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Layer 4: Meta Footer */}
                                            <div className="flex justify-between items-center pt-2 px-1">
                                                <div className="flex items-center gap-1.5">
                                                    {aiData.status === "PARTIAL_SUCCESS" && (
                                                        <div 
                                                            className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full"
                                                            aria-label="Partial data available"
                                                            title="Some data sources timed out or failed"
                                                        >
                                                            <AlertCircle className="w-3 h-3" />
                                                            <span>PARTIAL</span>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {aiData.resolved_language && (
                                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-sm tracking-tighter">
                                                        <span className="opacity-70">RESOURCE LANGUAGE:</span>
                                                        <span className="text-slate-500 dark:text-slate-300 uppercase">{aiData.resolved_language.toUpperCase()}</span>
                                                    </div>
                                                )}
                                            </div>
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
                                        {t('poi_more_photos')}
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
                                        {t('poi_open_gmaps')}
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
