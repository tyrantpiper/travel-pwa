"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { MultiImageUpload } from "@/components/ui/multi-image-upload"
import { POISearch } from "@/components/poi-search"
import { COUNTRY_REGIONS } from "@/lib/constants"
import { ItineraryItemState, LocationInfo, DailyLocation, GeocodeResult } from "@/lib/itinerary-types"
import { geocodeApi } from "@/lib/api"
import { useHaptic } from "@/lib/hooks"
import { useLanguage } from "@/lib/LanguageContext"
import { X, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { extractCoordsFromUrl, isGoogleMapsUrl } from "../../lib/location-utils"

const ACTIVITY_CATEGORIES = [
    { id: 'sightseeing', icon: '🎯', label: '景點', labelEn: 'Sightseeing' },
    { id: 'food', icon: '🍽️', label: '美食', labelEn: 'Food' },
    { id: 'hotel', icon: '🏨', label: '住宿', labelEn: 'Hotel' },
    { id: 'transport', icon: '🚃', label: '交通', labelEn: 'Transport' },
    { id: 'shopping', icon: '🛍️', label: '購物', labelEn: 'Shopping' },
    { id: 'activity', icon: '🎭', label: '活動', labelEn: 'Activity' },
]

const TYPE_LABELS: { [key: string]: string } = {
    restaurant: '🍽️', cafe: '☕', fast_food: '🍔',
    station: '🚉', bus_stop: '🚌', subway_entrance: '🚇',
    hotel: '🏨', hostel: '🛏️', attraction: '🎯',
    museum: '🏛️', park: '🌳', temple: '⛩️', shrine: '⛩️',
    shop: '🛍️', mall: '🏬', supermarket: '🛒',
}

interface ActivityEditModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    editItem: ItineraryItemState | null
    setEditItem: (item: ItineraryItemState | null) => void
    isAddMode: boolean
    isSaving: boolean
    onSave: () => void
    dailyLoc?: DailyLocation
    tripTitle?: string  // 🆕 智能搜尋用
    biasLoc?: { lat: number, lng: number } // 🆕 Smart Geocoding Bias
}

export function ActivityEditModal({
    isOpen,
    onOpenChange,
    editItem,
    setEditItem,
    isAddMode,
    isSaving,
    onSave,
    dailyLoc,
    tripTitle,  // 🆕 智能搜尋用
    biasLoc,    // 🆕 Smart Geocoding Bias
}: ActivityEditModalProps) {
    const [searchCountry, setSearchCountry] = useState("")
    const [searchRegion, setSearchRegion] = useState("")
    const [placeSearchResults, setPlaceSearchResults] = useState<LocationInfo[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [isResolvingLink, setIsResolvingLink] = useState(false)
    const [resolveStatus, setResolveStatus] = useState<'idle' | 'success' | 'fallback' | 'error'>('idle')
    const [isResolvingAddress, setIsResolvingAddress] = useState(false)
    const [addressResolveStatus, setAddressResolveStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const haptic = useHaptic()
    const { t, lang } = useLanguage()
    const zh = lang === 'zh'
    const originalUrlRef = useRef<string>("")

    // 🕵️ 奈米級追蹤：掛載時捕獲原始網址，並重置人工狀態
    useEffect(() => {
        if (isOpen && editItem) {
            originalUrlRef.current = editItem.link_url || ""
            // 重置人工編輯狀態（除非已經標記過）
            if (editItem.isManualCoords === undefined) {
                setEditItem({ ...editItem, isManualCoords: false })
            }
        }
    }, [isOpen, editItem, setEditItem])

    const handleSearchPlace = async () => {
        if (!editItem?.place?.trim()) return
        setIsSearching(true)
        try {
            // 🧠 決定位置權重 (Location Bias)
            // 優先順序: 1. 當前編輯項目的座標 (若是修改) 2. 外部傳入的偏差座標 (Sequential) 3. 當日位置
            const targetLat = (editItem.lat ? Number(editItem.lat) : undefined) || biasLoc?.lat || dailyLoc?.lat
            const targetLng = (editItem.lng ? Number(editItem.lng) : undefined) || biasLoc?.lng || dailyLoc?.lng

            // 🆕 使用結構化參數（取代字串拼接）
            const data = await geocodeApi.search({
                query: editItem.place.trim(),       // 純淨的搜尋字串
                limit: 5,
                tripTitle,
                lat: targetLat,
                lng: targetLng,
                country: searchCountry || undefined,  // 🆕 結構化國家過濾
                region: searchRegion || undefined     // 🆕 結構化區域過濾
            })
            setPlaceSearchResults((data.results || []).map((item: GeocodeResult) => ({
                name: item.name,
                display_name: item.address || item.name,
                lat: item.lat,
                lng: item.lng,
                type: item.type || "place",
                source: item.source
            })))
        } catch { toast.error(zh ? '搜尋失敗' : 'Search failed') }
        finally { setIsSearching(false) }
    }

    // 🧠 Heuristic Dual-Link Engine (Split-Field)
    const handleResolveLink = async (type: "map" | "media") => {
        const url = type === "map" ? editItem?.link_url : editItem?.website_link
        if (!url || !editItem) return

        // ⚡ Tier 1: Client-side Regex (Only for Map coordinates)
        if (type === "map") {
            const extracted = extractCoordsFromUrl(url)
            if (extracted.lat && extracted.lng) {
                updateCoords(extracted.lat, extracted.lng)
                setResolveStatus('success')
                toast.success(zh ? "已從連結自動提取座標" : "Coords extracted from link")
                // 🚀 Decoupling: Continue to backend to fetch metadata (images) if possible
            }
        }

        // 🌐 Tier 2: Backend Neural Engine (Scraper + Geocoder)
        if (type === "map" && !isGoogleMapsUrl(url)) {
            toast.info(zh ? "此連結不包含可識別座標，請使用搜尋功能" : "This link has no coordinates, use search instead")
            return
        }

        setIsResolvingLink(true)
        setResolveStatus('idle')
        try {
            const result = await geocodeApi.resolveLink(url, type)
            if (result.success) {
                if (type === "map" && result.lat && result.lng) {
                    // 🧬 v35.80: Clean Name Logic (Atomic Overwrite)
                    // Supports: " - ", " | ", Maps, 地圖, 地图, マップ, etc.
                    // 🧬 v35.82: DNA-Level Overwrite Priority
                    const rawTitle = result.metadata?.title || "";
                    const cleanedTitle = rawTitle
                        .replace(/\s*[-|]\s*Google\s*(Maps|地图|地圖|マップ|映射|map|search)/gi, "")
                        .trim();
                    
                    // 🛡️ Ensure query (path extraction) wins over old name if title is generic/empty
                    const cleanName = cleanedTitle || result.query || editItem.place;

                    const newMetadata = result.metadata?.image ? {
                        ...editItem.preview_metadata,
                        map_image: result.metadata.image
                    } : editItem.preview_metadata;

                    console.log("🛡️ [Audit] Place Name resolved & overwritten:", cleanName);

                    setEditItem({
                        ...editItem,
                        place: cleanName,
                        lat: result.lat,
                        lng: result.lng,
                        isManualCoords: true,
                        preview_metadata: newMetadata
                    })
                    setResolveStatus(result.method?.includes('jit') ? 'fallback' : 'success')
                    toast.success(result.method?.includes('jit') ? (zh ? "已透過地名語意自動定位" : "Located via semantic analysis") : (zh ? "已完成座標解析" : "Coordinate resolved"))
                } else if (type === "media") {
                    const meta = result.metadata || {}
                    // 🧠 Quantum Merge: Ensure og_image/title is stored without deleting map_image
                    // 🛡️ v35.38: Standard setEditItem (no closure issue for media type)
                    setEditItem({
                        ...editItem,
                        preview_metadata: {
                            ...editItem.preview_metadata,
                            og_image: meta.image,
                            og_title: meta.title
                        }
                    })
                    setResolveStatus('success')
                    toast.success(zh ? "官網首圖解析成功！" : "Website image parsed!")
                }
            } else {
                setResolveStatus('error')
                toast.error((zh ? "解析失敗：" : "Parse failed: ") + (result.error || (zh ? "請檢查網址" : "Check URL")))
            }
        } catch (e) {
            console.error("Link Resolution Error:", e)
            setResolveStatus('error')
        } finally {
            setIsResolvingLink(false)
        }
    }

    const handleResolveAddress = async () => {
        if (!editItem?.address?.trim()) return
        setIsResolvingAddress(true)
        setAddressResolveStatus('idle')
        try {
            const data = await geocodeApi.resolveAddress(editItem.address)
            if (data.success && data.lat && data.lng) {
                // 順向補填: 如果 place 為空，拿 name 或 address 當 place
                const currentPlace = editItem.place?.trim()
                const newPlace = currentPlace ? currentPlace : (data.name || data.address || "")
                setEditItem({
                    ...editItem,
                    lat: data.lat,
                    lng: data.lng,
                    place: newPlace,
                    isManualCoords: true
                })
                setAddressResolveStatus('success')
                toast.success(zh ? "地址高精解析成功" : "Address resolved with high precision")
            }
        } catch (error: unknown) {
            setAddressResolveStatus('error')
            const err = error as { message?: string, retryable?: boolean }
            const msg = err.message || (zh ? "無法在地圖上定位此地址" : "Address not found")
            const isRetryable = err.retryable
            
            if (isRetryable) {
                toast.error(`⚠️ ${msg}`, { duration: 5000 })
            } else {
                toast.error(msg)
            }
        } finally {
            setIsResolvingAddress(false)
        }
    }

    const updateCoords = (lat: number | string, lng: number | string) => {
        if (!editItem) return
        setEditItem({
            ...editItem,
            lat: lat,
            lng: lng,
            isManualCoords: true // 🚩 探針發射：只要座標變動，系統自動退讓
        })
    }

    const handleSelectLocation = (loc: LocationInfo) => {
        if (editItem) {
            setEditItem({
                ...editItem,
                place: loc.name,
                address: loc.address || loc.display_name, // 順向自動帶入
                lat: loc.lat,
                lng: loc.lng,
                isManualCoords: true, // 🚩 手動選擇地點視同人工座標
                link_url: editItem.link_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.name)}`
            })
            setPlaceSearchResults([])
        }
    }

    const handleAddTag = (inputId: string) => {
        const input = document.getElementById(inputId) as HTMLInputElement
        const newTag = input?.value?.trim()
        if (editItem && newTag && !(editItem.tags || []).includes(newTag)) {
            setEditItem({ ...editItem, tags: [...(editItem.tags || []), newTag] })
            input.value = ''
        }
    }

    if (!editItem) return null

    const hasCoordsForPOI = (editItem.lat && editItem.lng) || (dailyLoc?.lat && dailyLoc?.lng)

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isAddMode ? "Add Activity" : "Edit Activity"}</DialogTitle>
                    <DialogDescription className="sr-only">
                        {isAddMode ? "Fill in the details to add a new activity to your itinerary." : "Update the details of this itinerary activity."}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {/* Spot Photo Upload - 多圖片 */}
                    <div className="flex justify-center mb-2">
                        <MultiImageUpload
                            values={editItem.image_urls || (editItem.image_url ? [editItem.image_url] : [])}
                            onChange={(urls) => setEditItem({ ...editItem, image_urls: urls, image_url: urls[0] || "" })}
                            maxImages={5}
                            folder="ryan_travel/spots"
                        />
                    </div>

                    {/* Time */}
                    <div className="space-y-1.5">
                        <Label>{t('time')}</Label>
                        <Input
                            type="time"
                            value={editItem.time || ""}
                            onChange={(e) => setEditItem({ ...editItem, time: e.target.value })}
                            className="w-full"
                        />
                    </div>

                    {/* Filter: Country/Region */}
                    <div className="space-y-1.5">
                        <Label>Filter</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <select
                                className="w-full h-9 rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={searchCountry}
                                onChange={(e) => {
                                    setSearchCountry(e.target.value)
                                    setSearchRegion("")
                                }}
                            >
                                <option value="">🌍 Country</option>
                                <option value="Japan">🇯🇵 Japan</option>
                                <option value="Taiwan">🇹🇼 Taiwan</option>
                                <option value="South Korea">🇰🇷 Korea</option>
                                <option value="Thailand">🇹🇭 Thailand</option>
                                <option value="Vietnam">🇻🇳 Vietnam</option>
                                <option value="Hong Kong">🇭🇰 Hong Kong</option>
                                <option value="Singapore">🇸🇬 Singapore</option>
                                <option value="USA">🇺🇸 USA</option>
                                <option value="UK">🇬🇧 UK</option>
                                <option value="France">🇫🇷 France</option>
                                <option value="Italy">🇮🇹 Italy</option>
                            </select>

                            {searchCountry && COUNTRY_REGIONS[searchCountry] ? (
                                <select
                                    className="w-full h-9 rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={searchRegion}
                                    onChange={(e) => setSearchRegion(e.target.value)}
                                >
                                    <option value="">🏙️ Region (All)</option>
                                    {COUNTRY_REGIONS[searchCountry].map(region => (
                                        <option key={region} value={region}>{region}</option>
                                    ))}
                                </select>
                            ) : (
                                <Input
                                    placeholder="🏙️ Region"
                                    className="w-full"
                                    value={searchRegion}
                                    onChange={(e) => setSearchRegion(e.target.value)}
                                />
                            )}
                        </div>
                    </div>

                    {/* Place */}
                    <div className="space-y-1.5">
                        <Label>{t('place')}</Label>
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <Input
                                    value={editItem.place || ""}
                                    onChange={(e) => setEditItem({ ...editItem, place: e.target.value })}
                                    placeholder={zh ? "輸入商家/景點名稱..." : "Search place name..."}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearchPlace()}
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    disabled={isSearching}
                                    onClick={handleSearchPlace}
                                >
                                    {isSearching ? '...' : '🔍'}
                                </Button>
                            </div>

                            {placeSearchResults.length > 0 && (
                                <div className="space-y-1 max-h-40 overflow-y-auto overflow-x-hidden border rounded-lg p-2 bg-slate-50">
                                    {placeSearchResults.map((loc, idx) => {
                                        const icon = TYPE_LABELS[loc.type || ''] || '📍'
                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                className="w-full text-left p-3 rounded-lg hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-colors"
                                                onClick={() => handleSelectLocation(loc)}
                                            >
                                                <div className="flex items-center gap-2 mb-1 min-w-0">
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">
                                                        {icon} {loc.type || (zh ? '地點' : 'Place')}
                                                    </span>
                                                    <span className="font-bold text-sm text-slate-800 truncate">{loc.name}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 truncate">
                                                    {loc.display_name}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                    {loc.lat?.toFixed(6)}, {loc.lng?.toFixed(6)}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* POI Search */}
                    {hasCoordsForPOI ? (
                        <div className="border-t border-dashed pt-4 mt-2">
                            <Label className="text-xs text-slate-500 mb-2 block">📍 {zh ? '附近搜索' : 'Nearby Search'}</Label>
                            <POISearch
                                centerLat={Number(editItem.lat) || dailyLoc?.lat || 35.6895}
                                centerLng={Number(editItem.lng) || dailyLoc?.lng || 139.6917}
                                onSelectPOI={(poi) => {
                                    setEditItem({
                                        ...editItem,
                                        place: poi.name,
                                        lat: poi.lat,
                                        lng: poi.lng,
                                        isManualCoords: true, // 🚩 選擇 POI 視同人工座標
                                        link_url: editItem.link_url || poi.website || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(poi.name)}`,
                                        desc: poi.opening_hours ? `${zh ? '營業' : 'Hours'}: ${poi.opening_hours}` : (editItem.desc || "")
                                    })
                                    toast.success(zh ? `已選擇: ${poi.name}` : `Selected: ${poi.name}`)
                                }}
                            />
                        </div>
                    ) : (
                        <div className="text-xs text-slate-400 text-center py-2 border-t border-dashed mt-2">
                            💡 {zh ? '先搜索地點以啟用附近 POI 搜索' : 'Search a place first to enable nearby POI search'}
                        </div>
                    )}

                    {/* Primary Link - Priority Moved Up */}
                    <div className="space-y-3 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                        {/* 🛡️ v35.46: Surgically hiding Media Link per user request. 
                            Keeping logic in place, but removing UI visibility.
                        {/* 1. 媒體連結 (Website/Social) */}
                        {/* 
                        <div className="space-y-1.5">
                            <Label className="text-[10px] text-blue-600 dark:text-blue-400 uppercase flex items-center gap-1.5 font-black tracking-widest">
                                🔗 {t('media_link')}
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder={t('media_link_placeholder')}
                                    className="text-xs bg-white dark:bg-slate-900 border-blue-100 flex-1"
                                    value={editItem.website_link || ''}
                                    onChange={(e) => setEditItem({ ...editItem, website_link: e.target.value })}
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    disabled={isResolvingLink || !editItem.website_link?.trim()}
                                    onClick={() => handleResolveLink("media")}
                                    className="h-9 px-3 bg-blue-600 text-white hover:bg-blue-700 border-none transition-all active:scale-95"
                                >
                                    {isResolvingLink ? <Loader2 className="w-3 h-3 animate-spin" /> : "解析美照"}
                                </Button>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-800 my-2" />
                        */}

                        {/* 🌟 2026 高精度地址解析引擎 (Green Block) */}
                        <div className="space-y-1.5 bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none transition-transform group-hover:scale-110"></div>
                            
                            <div className="flex justify-between items-center mb-2">
                                <Label className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase flex items-center gap-1.5 font-black tracking-widest relative z-10">
                                    📍 {zh ? '地址解析引擎' : 'Address Engine'}
                                </Label>
                                <div className="flex items-center gap-2 relative z-10">
                                    {isResolvingAddress && <Loader2 className="w-3 h-3 text-emerald-500 animate-spin" />}
                                    {!isResolvingAddress && addressResolveStatus === 'success' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                                    {!isResolvingAddress && addressResolveStatus === 'error' && <AlertCircle className="w-3 h-3 text-rose-500" />}
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-2 relative z-10">
                                <textarea
                                    placeholder={zh ? "貼上混亂地址，AI 會為您精確定位...\n(例: 105台北市松山區敦化北路100號)" : "Paste full address..."}
                                    className="text-xs min-h-[64px] w-full resize-y rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-white dark:bg-slate-900/60 px-3 py-2.5 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 shadow-inner transition-colors"
                                    value={editItem.address || ''}
                                    onChange={(e) => {
                                        setEditItem({ ...editItem, address: e.target.value })
                                        setAddressResolveStatus('idle')
                                    }}
                                />
                                <div className="flex justify-end mt-0.5">
                                    <Button
                                        type="button"
                                        size="sm"
                                        disabled={isResolvingAddress || !editItem.address?.trim()}
                                        onClick={handleResolveAddress}
                                        className="h-8 px-5 rounded-md text-[11px] font-bold tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white border border-transparent shadow-[0_2px_10px_-3px_rgba(5,150,105,0.4)] transition-all active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                                    >
                                        {isResolvingAddress ? <Loader2 className="w-3 h-3 animate-spin" /> : (zh ? "高精解析" : "GEOCODE")}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* 2. 導航網址 (Google Maps / Apple Maps Link) */}
                        <div className="space-y-1.5 p-1">
                            <div className="flex justify-between items-center mb-1">
                                <Label className="text-[10px] text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1.5 font-black tracking-widest">
                                    🔗 {zh ? '導航網址' : 'Navigation URL'}
                                </Label>
                                <div className="flex items-center gap-2">
                                    {isResolvingLink && <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />}
                                    {!isResolvingLink && resolveStatus === 'success' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                                    {!isResolvingLink && resolveStatus === 'fallback' && (
                                        <div className="flex items-center gap-1 text-[9px] text-amber-600 font-bold">
                                            <AlertCircle className="w-3 h-3" />
                                            {zh ? '語意定位' : 'Semantic'}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="https://maps.app.goo.gl/..."
                                    className="text-xs bg-white dark:bg-slate-900 border-amber-100 flex-1"
                                    value={editItem.link_url || ''}
                                    onChange={(e) => {
                                        setEditItem({ ...editItem, link_url: e.target.value })
                                        setResolveStatus('idle')
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    disabled={isResolvingLink || !editItem.link_url?.trim()}
                                    onClick={() => handleResolveLink("map")}
                                    className="h-9 px-3 bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-none transition-all active:scale-95"
                                >
                                    {isResolvingLink ? <Loader2 className="w-3 h-3 animate-spin" /> : (zh ? "解析座標" : "Resolve")}
                                </Button>
                            </div>
                        </div>

                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                        <Label>{t('notes')}</Label>
                        <Input
                            value={editItem.desc || ""}
                            onChange={(e) => setEditItem({ ...editItem, desc: e.target.value })}
                            className="w-full"
                        />
                    </div>
                    {/* Reservation & Cost Grid */}
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-dashed">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Reservation Code</Label>
                            <Input
                                placeholder="PDR / Code"
                                className="text-xs"
                                value={editItem.reservation_code || ''}
                                onChange={(e) => setEditItem({ ...editItem, reservation_code: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Estimated Cost</Label>
                            <Input
                                type="number"
                                placeholder="Amount"
                                className="text-xs"
                                value={editItem.cost || ''}
                                onChange={(e) => setEditItem({ ...editItem, cost: e.target.value ? parseFloat(e.target.value) : undefined })}
                            />
                        </div>
                    </div>

                    {/* Category */}
                    <div className="space-y-1.5">
                        <Label>Category</Label>
                        <div className="flex flex-wrap gap-2">
                            {ACTIVITY_CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setEditItem({ ...editItem, category: cat.id })}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 transition-all",
                                        editItem.category === cat.id
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                                    )}
                                >
                                    <span>{cat.icon}</span>
                                    <span>{zh ? cat.label : cat.labelEn}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="space-y-1.5">
                        <Label>Tags</Label>
                        <div className="space-y-2">
                            <div className="flex flex-wrap gap-1">
                                {(editItem.tags || []).map((tag: string, i: number) => (
                                    <span key={i} className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs flex items-center gap-1.5 transition-all active:scale-95">
                                        {tag}
                                        <button
                                            type="button"
                                            className="w-4 h-4 flex items-center justify-center font-black text-red-500 hover:text-red-700 bg-white/50 rounded-full"
                                            onClick={() => {
                                                haptic.tap()
                                                setEditItem({
                                                    ...editItem,
                                                    tags: (editItem.tags || []).filter((_: string, idx: number) => idx !== i)
                                                })
                                            }}
                                        >×</button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    id="activity-tag-input"
                                    placeholder={zh ? "新增標籤" : "Add tag"}
                                    className="text-sm flex-1"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            handleAddTag('activity-tag-input')
                                        }
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleAddTag('activity-tag-input')}
                                >
                                    +
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Coordinates */}
                    <div className="space-y-1.5 pt-2 border-t border-dashed">
                        <Label className="text-xs text-muted-foreground">Coordinates</Label>
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Lat"
                                    className="text-xs font-mono"
                                    value={editItem.lat || ''}
                                    onChange={(e) => setEditItem({ ...editItem, lat: e.target.value, isManualCoords: true })}
                                />
                                <Input
                                    placeholder="Lng"
                                    className="text-xs font-mono"
                                    value={editItem.lng || ''}
                                    onChange={(e) => setEditItem({ ...editItem, lng: e.target.value, isManualCoords: true })}
                                />
                            </div>
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[10px] text-slate-400 font-medium">
                                    {editItem.lat && editItem.lng ? "📍 Precise Geolocation" : "🔍 Search mode"}
                                </span>
                                <div className="flex items-center gap-2">
                                    {(editItem.preview_metadata?.og_image || editItem.preview_metadata?.map_image) && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-[10px] text-blue-500 hover:text-blue-600 hover:bg-blue-50 font-bold"
                                            onClick={() => {
                                                haptic.tap()
                                                setEditItem({ ...editItem, preview_metadata: {} })
                                                toast.info(zh ? "已清除連結預覽" : "Link preview cleared")
                                            }}
                                        >
                                            <X className="w-3 h-3" /> Clear Preview
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-[10px] text-red-500 hover:text-red-600 hover:bg-red-50 font-bold flex items-center gap-1"
                                        onClick={() => {
                                            haptic.tap()
                                            setEditItem({ ...editItem, lat: null, lng: null, isManualCoords: true })
                                        }}
                                    >
                                        <X className="w-3 h-3" /> Clear Coords
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Setting Toggles */}
                    <div className="grid grid-cols-1 gap-2">
                        {/* Private Mode Toggle */}
                        <div className="flex items-center justify-between space-x-2 border rounded-lg p-3 bg-slate-50/50 dark:bg-slate-800/50">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-medium">Private Activity</Label>
                                <p className="text-[10px] text-slate-500">Only visible to you (Local Tag)</p>
                            </div>
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                checked={!!editItem.is_private}
                                onChange={(e) => {
                                    setEditItem({ ...editItem, is_private: e.target.checked })
                                }}
                            />
                        </div>

                        {/* No Navigation Toggle */}
                        <div className="flex items-center justify-between space-x-2 border rounded-lg p-3 bg-slate-50/50 dark:bg-slate-800/50">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                    <Label className="text-sm font-medium">{zh ? '不須導航' : 'No Navigation'}</Label>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">Manual</span>
                                </div>
                                <p className="text-[10px] text-slate-500">{zh ? '隱藏卡片上的地圖按鈕' : 'Hide map button on card'}</p>
                            </div>
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                checked={!!editItem.hide_navigation}
                                onChange={(e) => setEditItem({ ...editItem, hide_navigation: e.target.checked })}
                            />
                        </div>

                        {/* ⚠️ Temporarily Removed: High-Priority Toggle (VIP) */}
                        {/* 
                        <div className="flex items-center justify-between space-x-2 border rounded-lg p-3 bg-amber-50/30 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/50">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                    <Label className="text-sm font-medium text-amber-700 dark:text-amber-400">高亮顯示</Label>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 font-bold">VIP</span>
                                </div>
                                <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70">在時間軸上以琥珀金邊框固定顯示</p>
                            </div>
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                checked={!!editItem.is_highlight}
                                onChange={(e) => setEditItem({ ...editItem, is_highlight: e.target.checked })}
                            />
                        </div>
                        */}
                    </div>

                    <DialogFooter>
                        <Button 
                            onClick={onSave} 
                            disabled={isSaving || isResolvingAddress || isResolvingLink}
                        >
                            {isSaving ? (zh ? "儲存中..." : "Saving...") : 
                             (isResolvingAddress || isResolvingLink) ? (zh ? "解析中..." : "Resolving...") :
                             (isAddMode ? "Add" : "Save")}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog >
    )
}
