"use client"

import { useState } from "react"
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

const ACTIVITY_CATEGORIES = [
    { id: 'sightseeing', icon: '🎯', label: '景點' },
    { id: 'food', icon: '🍽️', label: '美食' },
    { id: 'hotel', icon: '🏨', label: '住宿' },
    { id: 'transport', icon: '🚃', label: '交通' },
    { id: 'shopping', icon: '🛍️', label: '購物' },
    { id: 'activity', icon: '🎭', label: '活動' },
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
        } catch { toast.error('搜尋失敗') }
        finally { setIsSearching(false) }
    }

    const handleSelectLocation = (loc: LocationInfo) => {
        if (editItem) {
            setEditItem({ ...editItem, place: loc.name, lat: loc.lat, lng: loc.lng })
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
                        <Label>Time</Label>
                        <Input
                            type="time"
                            value={editItem.time}
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
                        <Label>Place</Label>
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <Input
                                    value={editItem.place}
                                    onChange={(e) => setEditItem({ ...editItem, place: e.target.value })}
                                    placeholder="輸入商家/景點名稱..."
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
                                <div className="space-y-1 max-h-40 overflow-y-auto border rounded-lg p-2 bg-slate-50">
                                    {placeSearchResults.map((loc, idx) => {
                                        const icon = TYPE_LABELS[loc.type || ''] || '📍'
                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                className="w-full text-left p-3 rounded-lg hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-colors"
                                                onClick={() => handleSelectLocation(loc)}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">
                                                        {icon} {loc.type || '地點'}
                                                    </span>
                                                    <span className="font-bold text-sm text-slate-800">{loc.name}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 line-clamp-1 truncate">
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
                            <Label className="text-xs text-slate-500 mb-2 block">📍 附近搜索</Label>
                            <POISearch
                                centerLat={Number(editItem.lat) || dailyLoc?.lat || 35.6895}
                                centerLng={Number(editItem.lng) || dailyLoc?.lng || 139.6917}
                                onSelectPOI={(poi) => {
                                    setEditItem({
                                        ...editItem,
                                        place: poi.name,
                                        lat: poi.lat,
                                        lng: poi.lng,
                                        desc: poi.opening_hours ? `營業: ${poi.opening_hours}` : editItem.desc
                                    })
                                    toast.success(`已選擇: ${poi.name}`)
                                }}
                            />
                        </div>
                    ) : (
                        <div className="text-xs text-slate-400 text-center py-2 border-t border-dashed mt-2">
                            💡 先搜索地點以啟用附近 POI 搜索
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-1.5">
                        <Label>Notes</Label>
                        <Input
                            value={editItem.desc}
                            onChange={(e) => setEditItem({ ...editItem, desc: e.target.value })}
                            className="w-full"
                        />
                    </div>

                    {/* Meta Info: Link, Reservation, Cost */}
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-dashed">
                        <div className="col-span-2 space-y-1.5">
                            <Label className="text-xs">Primary Link (Website / Nav)</Label>
                            <Input
                                placeholder="https://..."
                                className="text-xs"
                                value={editItem.link_url || ''}
                                onChange={(e) => setEditItem({ ...editItem, link_url: e.target.value })}
                            />
                        </div>
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
                                    <span>{cat.label}</span>
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
                                    <span key={i} className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
                                        {tag}
                                        <button
                                            type="button"
                                            className="hover:text-red-800"
                                            onClick={() => setEditItem({
                                                ...editItem,
                                                tags: (editItem.tags || []).filter((_: string, idx: number) => idx !== i)
                                            })}
                                        >×</button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    id="activity-tag-input"
                                    placeholder="新增標籤"
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
                                    onChange={(e) => setEditItem({ ...editItem, lat: e.target.value })}
                                />
                                <Input
                                    placeholder="Lng"
                                    className="text-xs font-mono"
                                    value={editItem.lng || ''}
                                    onChange={(e) => setEditItem({ ...editItem, lng: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400">{editItem.lat && editItem.lng ? "Precise" : "Search mode"}</span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] text-red-400"
                                    onClick={() => setEditItem({ ...editItem, lat: null, lng: null })}
                                >
                                    Clear
                                </Button>
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
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={(editItem.tags || []).includes("Private")}
                                onChange={(e) => {
                                    const currentTags = editItem.tags || []
                                    if (e.target.checked) {
                                        setEditItem({ ...editItem, tags: [...currentTags, "Private"] })
                                    } else {
                                        setEditItem({ ...editItem, tags: currentTags.filter(t => t !== "Private") })
                                    }
                                }}
                            />
                        </div>

                        {/* No Navigation Toggle */}
                        <div className="flex items-center justify-between space-x-2 border rounded-lg p-3 bg-slate-50/50 dark:bg-slate-800/50">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                    <Label className="text-sm font-medium">不須導航</Label>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">Manual</span>
                                </div>
                                <p className="text-[10px] text-slate-500">隱藏卡片上的地圖按鈕</p>
                            </div>
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                checked={!!editItem.hide_navigation}
                                onChange={(e) => setEditItem({ ...editItem, hide_navigation: e.target.checked })}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button onClick={onSave} disabled={isSaving}>
                            {isSaving ? "儲存中..." : (isAddMode ? "Add" : "Save")}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
