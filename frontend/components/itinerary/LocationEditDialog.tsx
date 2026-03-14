"use client"

import { useState } from "react"
import { Search, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { GeocodeResult, DailyLocation, Trip, LocationInfo } from "@/lib/itinerary-types"
import { geocodeApi } from "@/lib/api"
import { getDistanceKm } from "@/lib/location-utils"
import { COUNTRY_REGIONS } from "@/lib/constants"
import { useLanguage } from "@/lib/LanguageContext"

interface LocationEditDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    day: number
    dailyLocs: Record<number | string, DailyLocation>
    setDailyLocs: (locs: Record<number | string, DailyLocation>) => void
    currentTrip?: Trip
    biasLoc?: { lat: number, lng: number } // 🆕 Smart Geocoding Bias
}

export function LocationEditDialog({
    isOpen,
    onOpenChange,
    day,
    dailyLocs,
    setDailyLocs,
    currentTrip,
    biasLoc,    // 🆕 Smart Geocoding Bias
}: LocationEditDialogProps) {
    const { t } = useLanguage()
    const [searchCountry, setSearchCountry] = useState("")
    const [dailyLocSearchRegion, setDailyLocSearchRegion] = useState("")
    const [newLocName, setNewLocName] = useState("")
    const [locSearchResults, setLocSearchResults] = useState<GeocodeResult[]>([])
    const [isLocSearching, setIsLocSearching] = useState(false)
    const [isSelectingLocation, setIsSelectingLocation] = useState(false)

    const handleSearchLocation = async () => {
        if (!newLocName.trim()) return
        setIsLocSearching(true)
        try {
            const data = await geocodeApi.search({
                query: newLocName.trim(),
                limit: 8,
                country: searchCountry || undefined,
                region: dailyLocSearchRegion || undefined,
                lat: biasLoc?.lat,
                lng: biasLoc?.lng,
                tripTitle: currentTrip?.title
            })
            const rawResults = data.results || []
            const deduped = rawResults.filter((r: GeocodeResult, idx: number, self: GeocodeResult[]) => {
                if (r.osm_id) {
                    return self.findIndex(x => x.osm_id && String(x.osm_id) === String(r.osm_id)) === idx
                }
                return !self.slice(0, idx).some(existing => {
                    const eLat = existing.lat ?? 0;
                    const eLng = existing.lng ?? 0;
                    const rLat = r.lat ?? 0;
                    const rLng = r.lng ?? 0;
                    return getDistanceKm(eLat, eLng, rLat, rLng) < 0.05;
                })
            })
            setLocSearchResults(deduped)
            if (rawResults.length === 0) {
                toast.error(t('loc_not_found'))
            }
        } catch (err) {
            console.error("Search failed:", err)
            toast.error(t('loc_service_unavailable'))
        } finally {
            setIsLocSearching(false)
        }
    }

    const handleSelectLocation = async (loc: LocationInfo) => {
        if (isSelectingLocation) return
        setIsSelectingLocation(true)
        try {
            setDailyLocs({
                ...dailyLocs,
                [day]: {
                    name: loc.name,
                    lat: loc.lat,
                    lng: loc.lng
                }
            })
            onOpenChange(false)
            toast.success(t('loc_set_success', { name: loc.name }))
        } catch {
            toast.error(t('loc_set_failed'))
        } finally {
            setIsSelectingLocation(false)
        }
    }

    const handleManualLocation = () => {
        const latInput = document.getElementById('manual-lat') as HTMLInputElement
        const lngInput = document.getElementById('manual-lng') as HTMLInputElement
        const lat = parseFloat(latInput?.value)
        const lng = parseFloat(lngInput?.value)

        if (!isNaN(lat) && !isNaN(lng)) {
            setDailyLocs({
                ...dailyLocs,
                [day]: {
                    name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
                    lat,
                    lng
                }
            })
            onOpenChange(false)
            toast.success(t('loc_cleared'))
        } else {
            toast.warning(t('loc_invalid_coords'))
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('loc_edit_title', { day: String(day) })}</DialogTitle>
                    <DialogDescription>
                        {t('loc_edit_desc')}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {/* 當前座標顯示 */}
                    {dailyLocs[day] && (
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                            <div className="text-xs text-slate-500 mb-1">{t('loc_current')}</div>
                            <div className="font-bold text-slate-800 dark:text-slate-200">{dailyLocs[day].name}</div>
                            <div className="text-xs text-slate-400 font-mono">
                                {dailyLocs[day].lat?.toFixed(4)}, {dailyLocs[day].lng?.toFixed(4)}
                            </div>
                        </div>
                    )}

                    {/* 從活動同步按鈕 */}
                    {(() => {
                        const activityLoc = currentTrip?.days?.find((d) => d.day === day)?.activities?.find((a) => a.lat && a.lng)
                        if (activityLoc) {
                            return (
                                <Button
                                    variant="outline"
                                    className="w-full justify-start text-left h-auto py-3"
                                    onClick={() => {
                                        setDailyLocs({ ...dailyLocs, [day]: { name: activityLoc.place || "Location", lat: activityLoc.lat!, lng: activityLoc.lng! } })
                                        onOpenChange(false)
                                    }}
                                >
                                    <div>
                                        <div className="text-xs text-amber-600 font-bold">{t('loc_auto_sync')}</div>
                                        <div className="text-sm text-slate-700 dark:text-slate-300">{activityLoc.place}</div>
                                        <div className="text-xs text-slate-400 font-mono">{activityLoc.lat?.toFixed(4)}, {activityLoc.lng?.toFixed(4)}</div>
                                    </div>
                                </Button>
                            )
                        }
                        return null
                    })()}

                    {/* 搜尋區域 */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500">{t('loc_search')}</label>
                        <div className="flex gap-2">
                            <div className="w-1/3 space-y-2">
                                <select
                                    className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-950 dark:focus:ring-slate-400 dark:text-white"
                                    value={searchCountry}
                                    onChange={e => {
                                        setSearchCountry(e.target.value)
                                        setDailyLocSearchRegion("")
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
                                    <option value="Malaysia">🇲🇾 Malaysia</option>
                                    <option value="Philippines">🇵🇭 Philippines</option>
                                    <option value="Indonesia">🇮🇩 Indonesia</option>
                                    <option value="China">🇨🇳 China</option>
                                    <option value="USA">🇺🇸 USA</option>
                                    <option value="Canada">🇨🇦 Canada</option>
                                    <option value="UK">🇬🇧 UK</option>
                                    <option value="France">🇫🇷 France</option>
                                    <option value="Italy">🇮🇹 Italy</option>
                                    <option value="Germany">🇩🇪 Germany</option>
                                    <option value="Spain">🇪🇸 Spain</option>
                                    <option value="Australia">🇦🇺 Australia</option>
                                    <option value="New Zealand">🇳🇿 New Zealand</option>
                                </select>

                                {searchCountry && COUNTRY_REGIONS[searchCountry] ? (
                                    <select
                                        className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-950 dark:focus:ring-slate-400 dark:text-white"
                                        value={dailyLocSearchRegion}
                                        onChange={e => setDailyLocSearchRegion(e.target.value)}
                                    >
                                        <option value="">🏙️ Region (All)</option>
                                        {COUNTRY_REGIONS[searchCountry].map(region => (
                                            <option key={region} value={region}>{region}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <Input
                                        placeholder="🏙️ Region"
                                        className="h-9 text-xs"
                                        value={dailyLocSearchRegion}
                                        onChange={e => setDailyLocSearchRegion(e.target.value)}
                                    />
                                )}
                            </div>

                            <div className="flex-1 flex gap-2">
                                <Input
                                    placeholder={t('loc_search_placeholder')}
                                    value={newLocName}
                                    onChange={e => setNewLocName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSearchLocation()}
                                    className="flex-1 h-auto"
                                />
                                <Button onClick={handleSearchLocation} disabled={isLocSearching}>
                                    {isLocSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>
                    </div>


                    {locSearchResults.length > 0 && (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {locSearchResults.map((loc, idx) => {
                                const typeLabels: { [key: string]: string } = {
                                    restaurant: '🍴 餐廳', cafe: '☕ 咖啡廳', fast_food: '🍔 快餐',
                                    station: '🚉 車站', bus_stop: '🚌 公車站', subway_entrance: '🚇 地鐵站',
                                    hotel: '🏨 飯店', hostel: '🎒 青年旅館', guest_house: '🏘️ 民宿',
                                    attraction: '🚩 景點', museum: '🏛️ 博物館', park: '🌳 公園',
                                    temple: '⛩️ 寺廟', shrine: '⛩️ 神社', church: '⛪ 教堂',
                                    shop: '🛍️ 商店', mall: '🏬 購物中心', supermarket: '🛒 超市',
                                    convenience: '🏪 便利商店', department_store: '🏬 百貨公司',
                                    administrative: '🏛️ 行政區域', suburb: '🏘️ 市郊', city: '🏙️ 城市',
                                }
                                const typeLabel = typeLabels[loc.type || ''] || `📍 ${loc.type || '地點'}`

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleSelectLocation(loc)}
                                        disabled={isSelectingLocation}
                                        className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:border-amber-300 dark:hover:border-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">{typeLabel}</span>
                                            <span className="font-bold text-sm text-slate-800 dark:text-white">{loc.name}</span>
                                        </div>
                                        <div className="text-[10px] text-slate-500 line-clamp-1">
                                            {loc.display_name || [loc.admin2, loc.admin1, loc.country].filter(Boolean).join(', ')}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                            {loc.lat?.toFixed(6)}, {loc.lng?.toFixed(6)}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    <div className="space-y-2 pt-2 border-t border-dashed">
                        <label className="text-xs font-bold text-slate-500">{t('loc_manual_title')}</label>
                        <div className="flex gap-2">
                            <Input placeholder={t('loc_lat_ph')} className="font-mono text-xs h-8" id="manual-lat" />
                            <Input placeholder={t('loc_lng_ph')} className="font-mono text-xs h-8" id="manual-lng" />
                            <Button size="sm" variant="secondary" onClick={handleManualLocation}>{t('loc_apply')}</Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
