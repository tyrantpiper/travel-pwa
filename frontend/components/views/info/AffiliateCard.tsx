// 📍 frontend/components/views/info/AffiliateCard.tsx
// Single affiliate platform card with brand styling, deep link CTA, and real-time flight comparison accordion
// Supports Hybrid 3-Tier airport resolution (Global hubs + Dynamic search + Manual override)

'use client'

import { useState, useEffect, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, ChevronDown, Copy, Check, Plane, MapPin, Search, Ticket, Car, Train, Building, Calendar } from 'lucide-react'
import { openExternalLink } from '@/lib/utils'
import { useFlightPrice } from '@/lib/hooks'
import { travelDataApi } from '@/lib/api'
import { getAirlineName, DEFAULT_ORIGIN_HUBS, getDestinationHubs, resolveAirportFromDestination } from '@/lib/airport-mapping'
import { getDestinationTransportRoutes, type TransportRouteItem } from '@/lib/activity-mapping'
import type { AffiliatePlatform, TripContext } from '@/lib/affiliate-config'
import { sanitizeActivityQuery } from '@/lib/affiliate-config'
import { toast } from 'sonner'

interface AffiliateCardProps {
  platform: AffiliatePlatform
  tripContext: TripContext
  lang: 'en' | 'zh'
  index?: number
}

function trackAffiliateClick(platform: AffiliatePlatform, destination?: string) {
  try {
    window.dispatchEvent(new CustomEvent('affiliate-click', {
      detail: {
        platformId: platform.id,
        platformName: platform.name,
        category: platform.category,
        destination: destination || 'unknown',
        timestamp: Date.now(),
      }
    }))
  } catch { /* non-blocking */ }
}

export function AffiliateCard({ platform, tripContext, lang, index = 0 }: AffiliateCardProps) {
  const isAviasales = platform.id === 'aviasales'
  const isActivity = platform.id === 'klook' || platform.id === 'kkday' || platform.id === 'tiqets' || platform.id === 'wegotrip'
  const isTransport = platform.id === 'kiwitaxi' || platform.id === 'welcome-pickups' || platform.id === '12go'
  const isTripCom = platform.id === 'trip' || platform.id === 'tripcom'

  const activities = tripContext.itineraryActivities || []
  const hasActivities = isActivity && activities.length > 0
  const transportRoutes = isTransport
    ? getDestinationTransportRoutes(tripContext.destination, tripContext.arrivalAirport)
    : []

  const [selectedActivityPill, setSelectedActivityPill] = useState<string>('all')
  const [customActivityInput, setCustomActivityInput] = useState<string>('')
  const [showCustomActivitySearch, setShowCustomActivitySearch] = useState<boolean>(false)

  // ✈️ 出發地切換狀態 (預設：tripContext.departureAirport > 'TPE')
  const [selectedOrigin, setSelectedOrigin] = useState<string>(
    tripContext.departureAirport || 'TPE'
  )

  // 🌍 取得目的地的多樞紐推薦列表 (例如義大利 ➔ 羅馬 FCO, 米蘭 MXP, 威尼斯 VCE)
  const destinationHubs = isAviasales ? getDestinationHubs(tripContext.destination) : []

  // 🛬 抵達地切換狀態 (優先順序：tripContext.arrivalAirport > 本地字典首選樞紐)
  const initialArrival = tripContext.arrivalAirport || (destinationHubs.length > 0 ? destinationHubs[0].code : resolveAirportFromDestination(tripContext.destination))
  const [selectedArrival, setSelectedArrival] = useState<string | undefined>(initialArrival)

  const [isExpanded, setIsExpanded] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  
  // 🔍 手動自訂/搜尋機場狀態 (Tier 3)
  const [showCustomSearch, setShowCustomSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ code: string; name: string; city_name?: string }>>([])
  const [isSearching, startSearchTransition] = useTransition()


  // 🛡️ Tier 2 動態補位：若本地字典無匹配且未手動設定，透過後端 API 搜尋最鄰近機場
  useEffect(() => {
    if (isAviasales && !selectedArrival && tripContext.destination) {
      travelDataApi.searchAirports(tripContext.destination).then((airports) => {
        if (airports && airports.length > 0) {
          setSelectedArrival(airports[0].code)
        }
      })
    }
  }, [isAviasales, selectedArrival, tripContext.destination])

  // 🛡️ 防禦起降同城（如境內台北行程 TPE ➔ TPE）無效航線
  const isValidRoute = isAviasales && !!selectedArrival && !!selectedOrigin && selectedOrigin !== selectedArrival
  const showPrice = isValidRoute

  const { lowestPrice, prices, currency, isLoading: priceLoading } = useFlightPrice(
    showPrice ? selectedOrigin : undefined,
    showPrice ? selectedArrival : undefined,
    tripContext.checkinDate,
  )

  const handleMainClick = () => {
    // 預設跳轉 URL（帶入目前選定的出發地與目的地）
    const effectiveContext: TripContext = {
      ...tripContext,
      departureAirport: selectedOrigin,
      arrivalAirport: selectedArrival,
    }
    const url = platform.buildUrl(effectiveContext)

    // 📊 Affiliate click tracking
    trackAffiliateClick(platform, tripContext.destination)

    openExternalLink(url)
  }

  const handleCopyFlight = (e: React.MouseEvent, flightKey: string, text: string) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(flightKey)
      toast.success(lang === 'zh' ? '已複製航班資訊' : 'Flight info copied')
      setTimeout(() => setCopiedKey(null), 2000)
    }).catch(() => {
      toast.error(lang === 'zh' ? '複製失敗' : 'Copy failed')
    })
  }

  const handleFlightDirectBook = (e: React.MouseEvent, departureDate?: string, returnDate?: string | null) => {
    e.stopPropagation()
    const cleanDepDate = departureDate ? departureDate.split('T')[0] : tripContext.checkinDate
    const cleanRetDate = returnDate ? returnDate.split('T')[0] : undefined
    const directContext: TripContext = {
      ...tripContext,
      departureAirport: selectedOrigin,
      arrivalAirport: selectedArrival,
      checkinDate: cleanDepDate,
      checkoutDate: cleanRetDate,
    }
    const url = platform.buildUrl(directContext)

    // 📊 Affiliate click tracking
    trackAffiliateClick(platform, tripContext.destination)

    openExternalLink(url)
  }

  const toggleAccordion = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(prev => !prev)
  }

  const handleCopyActivity = (e: React.MouseEvent, actName: string) => {
    e.stopPropagation()
    const query = sanitizeActivityQuery(tripContext.destination, actName)
    navigator.clipboard.writeText(query).then(() => {
      setCopiedKey(actName)
      toast.success(lang === 'zh' ? `已複製「${query}」` : `Copied "${query}"`)
      setTimeout(() => setCopiedKey(null), 2000)
    }).catch(() => {
      toast.error(lang === 'zh' ? '複製失敗' : 'Copy failed')
    })
  }

  const handleActivityDirectBook = (e: React.MouseEvent, actName?: string) => {
    e.stopPropagation()
    const targetQuery = actName?.trim()
    const directContext: TripContext = {
      ...tripContext,
      customActivityQuery: targetQuery,
    }
    const url = platform.buildUrl(directContext)

    // 📊 Affiliate click tracking
    trackAffiliateClick(platform, tripContext.destination)

    openExternalLink(url)
  }

  const handleTransportDirectBook = (e: React.MouseEvent, route: TransportRouteItem) => {
    e.stopPropagation()
    const directContext: TripContext = {
      ...tripContext,
      serviceType: 'transfer',
      transferRoute: {
        origin: route.origin,
        destination: route.destination,
      },
    }
    const url = platform.buildUrl(directContext)
    trackAffiliateClick(platform, tripContext.destination)
    openExternalLink(url)
  }

  const handleCopyTransportRoute = (e: React.MouseEvent, routeText: string) => {
    e.stopPropagation()
    navigator.clipboard.writeText(routeText).then(() => {
      setCopiedKey(routeText)
      toast.success(lang === 'zh' ? `已複製路線「${routeText}」` : `Route "${routeText}" copied`)
      setTimeout(() => setCopiedKey(null), 2000)
    }).catch(() => {
      toast.error(lang === 'zh' ? '複製失敗' : 'Copy failed')
    })
  }

  const handleTripComDirectBook = (e: React.MouseEvent, serviceType: 'hotel' | 'train') => {
    e.stopPropagation()
    const directContext: TripContext = {
      ...tripContext,
      serviceType,
    }
    const url = platform.buildUrl(directContext)
    trackAffiliateClick(platform, tripContext.destination)
    openExternalLink(url)
  }

  const handleAirportSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchQuery(val)
    if (val.trim().length >= 2) {
      startSearchTransition(async () => {
        const results = await travelDataApi.searchAirports(val.trim())
        setSearchResults(results)
      })
    } else {
      setSearchResults([])
    }
  }

  const handleSelectCustomAirport = (e: React.MouseEvent, airportCode: string) => {
    e.stopPropagation()
    setSelectedArrival(airportCode)
    setShowCustomSearch(false)
    setSearchQuery('')
    setSearchResults([])
    toast.success(lang === 'zh' ? `已切換目的地為 ${airportCode}` : `Destination set to ${airportCode}`)
  }

  const hasFlightDetails = isAviasales && showPrice && prices && prices.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      className={`
        relative overflow-hidden rounded-2xl border-l-4 ${platform.borderColor}
        ${platform.bgColor} 
        shadow-xs hover:shadow-md transition-shadow duration-200
      `}
    >
      {/* 🛡️ Decoupled DOM: 主點擊卡片改為 div 容器，杜絕 HTML5 巢狀按鈕違法 */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleMainClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleMainClick() }}
        className="w-full text-left p-4 flex items-center gap-3.5 group cursor-pointer select-none"
      >
        {/* Emoji Icon */}
        <div className="text-3xl shrink-0 group-hover:scale-110 transition-transform duration-200">
          {platform.emoji}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              {platform.name}
            </h4>
            {platform.badge && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                {platform.badge[lang]}
              </span>
            )}
            {/* 機場代碼標籤 (如果有) */}
            {isAviasales && selectedArrival && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                {selectedOrigin} ➔ {selectedArrival}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
            {platform.description[lang]}
          </p>

          {/* 💰 即時最低價標籤與比價按鈕 */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {showPrice && lowestPrice != null && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                  bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400
                  text-xs font-black"
              >
                💰 {currency} {lowestPrice.toLocaleString()}+
              </motion.span>
            )}
            {showPrice && priceLoading && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] animate-pulse"
              >
                {lang === 'zh' ? '查價中...' : 'Fetching price...'}
              </span>
            )}

            {/* 展開比價按鈕 (當有航班明細時) */}
            {hasFlightDetails && (
              <button
                type="button"
                onClick={toggleAccordion}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold
                  bg-blue-100/70 hover:bg-blue-200/80 dark:bg-blue-900/40 dark:hover:bg-blue-900/60
                  text-blue-700 dark:text-blue-300 transition-colors"
                aria-expanded={isExpanded}
              >
                <span>{isExpanded ? (lang === 'zh' ? '收合' : 'Hide') : (lang === 'zh' ? `比價明細 (${prices.length}班)` : `Compare (${prices.length})`)}</span>
                <motion.span
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="inline-block"
                >
                  <ChevronDown className="w-3 h-3" />
                </motion.span>
              </button>
            )}

            {/* 🎫 活動門票標籤與手風琴按鈕 (Klook / KKday / Tiqets / WeGoTrip) */}
            {hasActivities && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100/80 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 text-[11px] font-bold">
                  🎯 {lang === 'zh' ? `推薦活動 (${activities.length})` : `Activities (${activities.length})`}
                </span>

                <button
                  type="button"
                  onClick={toggleAccordion}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold
                    bg-orange-100/60 hover:bg-orange-200/80 dark:bg-orange-900/40 dark:hover:bg-orange-900/60
                    text-orange-700 dark:text-orange-300 transition-colors"
                  aria-expanded={isExpanded}
                >
                  <span>{isExpanded ? (lang === 'zh' ? '收合' : 'Hide') : (lang === 'zh' ? '展開推薦門票' : 'View Activities')}</span>
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="inline-block"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </motion.span>
                </button>
              </div>
            )}

            {/* 🚕 接駁專車與跨城交通手風琴按鈕 (Kiwitaxi / Welcome Pickups / 12Go Asia) */}
            {isTransport && transportRoutes.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100/80 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300 text-[11px] font-bold">
                  🚖 {lang === 'zh' ? `推薦路線 (${transportRoutes.length})` : `Routes (${transportRoutes.length})`}
                </span>

                <button
                  type="button"
                  onClick={toggleAccordion}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold
                    bg-yellow-100/60 hover:bg-yellow-200/80 dark:bg-yellow-900/40 dark:hover:bg-yellow-900/60
                    text-yellow-800 dark:text-yellow-300 transition-colors"
                  aria-expanded={isExpanded}
                >
                  <span>{isExpanded ? (lang === 'zh' ? '收合' : 'Hide') : (lang === 'zh' ? '展開專車與接駁路線' : 'View Routes')}</span>
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="inline-block"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </motion.span>
                </button>
              </div>
            )}

            {/* 🏨 Trip.com 住宿與火車票手風琴按鈕 */}
            {isTripCom && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100/80 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 text-[11px] font-bold">
                  ✨ {lang === 'zh' ? '住宿與火車票' : 'Hotels & Trains'}
                </span>

                <button
                  type="button"
                  onClick={toggleAccordion}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold
                    bg-sky-100/60 hover:bg-sky-200/80 dark:bg-sky-900/40 dark:hover:bg-sky-900/60
                    text-sky-800 dark:text-sky-300 transition-colors"
                  aria-expanded={isExpanded}
                >
                  <span>{isExpanded ? (lang === 'zh' ? '收合' : 'Hide') : (lang === 'zh' ? '展開快捷預訂' : 'View Options')}</span>
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="inline-block"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </motion.span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CTA Arrow */}
        <div className={`
          shrink-0 w-8 h-8 rounded-full flex items-center justify-center
          bg-white/60 dark:bg-white/10 group-hover:bg-white dark:group-hover:bg-white/20
          transition-all duration-200 group-hover:scale-105
        `}>
          <ExternalLink className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
        </div>
      </div>

      {/* 🛫 手風琴展開比價區域 (Framer Motion 平滑展開) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/30 px-4 pb-3.5 pt-2.5"
          >
            {isAviasales && (
              <>
                {/* 1. 出發樞紐切換 Chip */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <Plane className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {lang === 'zh' ? '出發地' : 'Origin'}:
                </span>
              </div>
              <div className="flex items-center gap-1">
                {DEFAULT_ORIGIN_HUBS.map((hub) => {
                  const isActive = selectedOrigin === hub
                  return (
                    <button
                      key={hub}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedOrigin(hub)
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {hub}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2. 抵達樞紐切換 Chip (若目的地有多個主要機場，如義大利 FCO/MXP/VCE) */}
            <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {lang === 'zh' ? '目的地' : 'Destination'}:
                </span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {destinationHubs.map((hub) => {
                  const isActive = selectedArrival === hub.code
                  return (
                    <button
                      key={hub.code}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedArrival(hub.code)
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {lang === 'zh' ? hub.labelZh : hub.labelEn}
                    </button>
                  )
                })}

                {/* 搜尋/更換其他機場按鈕 (Tier 3) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowCustomSearch(prev => !prev)
                  }}
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-0.5"
                  title={lang === 'zh' ? '搜尋自訂機場' : 'Search airport'}
                >
                  <Search className="w-2.5 h-2.5" />
                  <span>{lang === 'zh' ? '自訂' : 'Custom'}</span>
                </button>
              </div>
            </div>

            {/* 自訂機場搜尋輸入框 (Tier 3) */}
            {showCustomSearch && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="mb-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleAirportSearchInput}
                    placeholder={lang === 'zh' ? '輸入城市名或機場代碼 (如 MXP, 米蘭)...' : 'Enter city or airport (e.g. MXP, Milan)...'}
                    className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none"
                    autoFocus
                  />
                </div>
                {isSearching && (
                  <p className="text-[10px] text-slate-400 mt-1 pl-5 animate-pulse">
                    {lang === 'zh' ? '搜尋中...' : 'Searching...'}
                  </p>
                )}
                {searchResults.length > 0 && (
                  <div className="mt-1.5 space-y-1 max-h-32 overflow-y-auto">
                    {searchResults.map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={(e) => handleSelectCustomAirport(e, item.code)}
                        className="w-full text-left px-2 py-1 rounded text-xs hover:bg-blue-50 dark:hover:bg-blue-900/40 flex items-center justify-between transition-colors"
                      >
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {item.name} {item.city_name ? `(${item.city_name})` : ''}
                        </span>
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                          {item.code}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 航班價格明細清單 (最多 5 筆，加載中顯示骨架屏) */}
            <div className="space-y-1.5">
              {priceLoading ? (
                <div className="space-y-1.5 animate-pulse py-1">
                  <div className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800/60" />
                  <div className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800/60" />
                </div>
              ) : prices.length === 0 ? (
                <div className="text-center py-3 text-xs text-slate-400">
                  {lang === 'zh' ? '暫無直飛或特惠航班報價' : 'No flight quotes available'}
                </div>
              ) : (
                prices.slice(0, 5).map((p, idx) => {
                  const flightNo = p.flight_number ? `${p.airline}${p.flight_number}` : p.airline
                  const airlineName = getAirlineName(p.airline)
                  const isLowest = lowestPrice != null && p.price === lowestPrice
                  const priceDiff = lowestPrice != null ? p.price - lowestPrice : 0
                  const cleanDate = p.departure_at ? p.departure_at.split('T')[0] : ''
                  const flightKey = `${p.airline}-${p.flight_number || idx}-${p.price}`
                  const copyText = `${airlineName} (${flightNo}) ${selectedOrigin}➔${selectedArrival} ${cleanDate} NT$${p.price.toLocaleString()}`

                  return (
                    <div
                      key={flightKey}
                      className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 text-xs shadow-2xs hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                    >
                      {/* 左側：航司與班號 + 轉機標籤 */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {airlineName}
                            </span>
                            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                              {flightNo}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                              p.transfers === 0
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                            }`}>
                              {p.transfers === 0 ? (lang === 'zh' ? '直飛' : 'Direct') : (lang === 'zh' ? `${p.transfers}轉` : `${p.transfers} stops`)}
                            </span>
                          </div>
                          {cleanDate && (
                            <span className="text-[10px] text-slate-400 mt-0.5">
                              {cleanDate}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 右側：價格與操作 */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                            {currency} {p.price.toLocaleString()}
                          </div>
                          {isLowest ? (
                            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">
                              👑 {lang === 'zh' ? '最低價' : 'Lowest'}
                            </span>
                          ) : priceDiff > 0 ? (
                            <span className="text-[9px] text-slate-400">
                              +{currency} {priceDiff.toLocaleString()}
                            </span>
                          ) : null}
                        </div>

                        {/* 複製按鈕 */}
                        <button
                          type="button"
                          onClick={(e) => handleCopyFlight(e, flightKey, copyText)}
                          title={lang === 'zh' ? '複製航班資訊' : 'Copy flight info'}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                        >
                          {copiedKey === flightKey ? (
                            <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>

                        {/* 直達按鈕 (英文國際版帶參跳轉) */}
                        <button
                          type="button"
                          onClick={(e) => handleFlightDirectBook(e, p.departure_at, p.return_at)}
                          title={lang === 'zh' ? '前往預訂 (Aviasales)' : 'Book now (Aviasales)'}
                          className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
              </>
            )}

            {isActivity && (
              <div className="space-y-2.5">
                {/* 1. 景點快捷 Pills 篩選列 */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                    {lang === 'zh' ? '熱門標籤' : 'Tags'}:
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedActivityPill('all')
                      setShowCustomActivitySearch(false)
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      selectedActivityPill === 'all' && !showCustomActivitySearch
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {lang === 'zh' ? '全部' : 'All'}
                  </button>

                  {activities.map((act) => {
                    const isActive = selectedActivityPill === act.name && !showCustomActivitySearch
                    return (
                      <button
                        key={act.name}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedActivityPill(prev => prev === act.name ? 'all' : act.name)
                          setShowCustomActivitySearch(false)
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all truncate max-w-32.5 cursor-pointer ${
                          isActive
                            ? 'bg-orange-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                        title={act.name}
                      >
                        {act.name}
                      </button>
                    )
                  })}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowCustomActivitySearch(prev => !prev)
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      showCustomActivitySearch
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {showCustomActivitySearch ? (lang === 'zh' ? '關閉自訂' : 'Close') : (lang === 'zh' ? '+ 自訂' : '+ Custom')}
                  </button>
                </div>

                {/* 2. 自訂關鍵字搜尋框 (當點選 + 自訂) */}
                {showCustomActivitySearch && (
                  <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800/60 shadow-2xs">
                    <Search className="w-3.5 h-3.5 text-orange-500 shrink-0 ml-1" />
                    <input
                      type="text"
                      value={customActivityInput}
                      onChange={(e) => setCustomActivityInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleActivityDirectBook(e as unknown as React.MouseEvent, customActivityInput)
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder={lang === 'zh' ? '輸入景點或體驗關鍵字 (如 貢多拉、龐貝...)' : 'Search custom activity...'}
                      className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-200 outline-hidden placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={(e) => handleActivityDirectBook(e, customActivityInput)}
                      className="px-2 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>{lang === 'zh' ? '搜尋' : 'Go'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* 3. 推薦活動清單 */}
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                  {(selectedActivityPill === 'all'
                    ? activities
                    : activities.filter(a => a.name === selectedActivityPill)
                  ).map((item) => {
                    const itemKey = `act-${item.name}`
                    const isCopied = copiedKey === item.name

                    let badgeText = lang === 'zh' ? '推薦體驗' : 'Experience'
                    let badgeClass = 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'

                    if (item.source === 'itinerary') {
                      badgeText = lang === 'zh' ? '行程景點' : 'Itinerary'
                      badgeClass = 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                    } else if (item.category === 'ticket') {
                      badgeText = lang === 'zh' ? '熱門門票' : 'Ticket'
                      badgeClass = 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                    } else if (item.category === 'tour') {
                      badgeText = lang === 'zh' ? '精選一日遊' : 'Day Tour'
                      badgeClass = 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300'
                    } else if (item.category === 'pass') {
                      badgeText = lang === 'zh' ? '通行證' : 'Pass'
                      badgeClass = 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                    }

                    return (
                      <div
                        key={itemKey}
                        className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 text-xs shadow-2xs hover:border-orange-300 dark:hover:border-orange-700 transition-colors"
                      >
                        {/* 左側：活動名稱與分類標籤 */}
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <Ticket className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-50">
                                {item.name}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${badgeClass}`}>
                                {badgeText}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 右側：操作按鈕 (複製 + 直達) */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* 複製關鍵字按鈕 */}
                          <button
                            type="button"
                            onClick={(e) => handleCopyActivity(e, item.name)}
                            title={lang === 'zh' ? '複製搜尋關鍵字' : 'Copy search keyword'}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          >
                            {isCopied ? (
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>

                          {/* 直達按鈕 (走 tp.media 帶參跳轉) */}
                          <button
                            type="button"
                            onClick={(e) => handleActivityDirectBook(e, item.name)}
                            title={lang === 'zh' ? `前往預訂 (${platform.name})` : `Book now (${platform.name})`}
                            className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/60 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 🚕 接駁專車與跨城交通路線 (Kiwitaxi / Welcome Pickups / 12Go Asia) */}
            {isTransport && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'zh' ? '熱門專車接送與交通路線' : 'Popular Transfer Routes'}:
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {platform.name}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {transportRoutes.map((route) => {
                    const routeTitle = lang === 'en' ? route.name.en : route.name.zh
                    const isCopied = copiedKey === routeTitle
                    const badgeText = route.badge ? (lang === 'en' ? route.badge.en : route.badge.zh) : ''

                    return (
                      <div
                        key={route.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 text-xs shadow-2xs hover:border-yellow-300 dark:hover:border-yellow-700 transition-colors"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {routeTitle}
                            </span>
                            {badgeText && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300">
                                {badgeText}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <span>{route.origin} ➔ {route.destination}</span>
                            {route.duration && <span>⏱️ {route.duration}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleCopyTransportRoute(e, routeTitle)}
                            title={lang === 'zh' ? '複製路線' : 'Copy route'}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          >
                            {isCopied ? (
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleTransportDirectBook(e, route)}
                            title={lang === 'zh' ? `前往預訂 (${platform.name})` : `Book on ${platform.name}`}
                            className="p-1.5 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/60 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 🏨 Trip.com 住宿與歐亞火車票快捷切換 */}
            {isTripCom && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-sky-500" />
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'zh' ? 'Trip.com 快捷服務' : 'Trip.com Quick Services'}:
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {tripContext.destination || 'Global'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* 飯店預訂卡 */}
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 shadow-2xs hover:border-sky-300 dark:hover:border-sky-700 transition-colors flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Building className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                          {lang === 'zh' ? '精選住宿預訂' : 'Hotel Booking'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {tripContext.destination ? `${tripContext.destination} 飯店、度假村與公寓` : 'Hotels & Resorts'}
                      </p>
                      {(tripContext.checkinDate || tripContext.checkoutDate) && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                          <Calendar className="w-3 h-3" />
                          <span>{tripContext.checkinDate || '—'} ➔ {tripContext.checkoutDate || '—'}</span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleTripComDirectBook(e, 'hotel')}
                      className="mt-2.5 w-full py-1.5 px-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <span>{lang === 'zh' ? '搜尋住宿' : 'Search Hotels'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>

                  {/* 火車票預訂卡 */}
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Train className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                          {lang === 'zh' ? '歐亞跨城火車票' : 'Train Tickets'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {/義大利|法國|英國|德國|瑞士|西班牙|歐洲|Italy|France|UK|Germany|Europe/i.test(tripContext.destination || '')
                          ? (lang === 'zh' ? '歐洲國鐵、義鐵 Trenitalia、歐洲之星' : 'Trenitalia, Eurostar & European Rail')
                          : (lang === 'zh' ? '亞洲高鐵、新幹線與跨城鐵路' : 'High-Speed Rail & Intercity Trains')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleTripComDirectBook(e, 'train')}
                      className="mt-2.5 w-full py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <span>{lang === 'zh' ? '查詢火車班次' : 'Search Trains'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
