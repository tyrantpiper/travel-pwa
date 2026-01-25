"use client"

import { Sun, CloudRain, MapPin, Edit3, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { DayWeather, LocationInfo } from "@/lib/itinerary-types"
import { getNowInZone } from "@/lib/timezone"

interface WeatherPanelProps {
    day: number
    weatherData: DayWeather[]
    weatherMode: string
    weatherConfidence: number | null
    elevation: number | null
    resolvedLocation: LocationInfo | null
    currentTimezone: string
    onEditLocation: () => void
}

export function WeatherPanel({
    weatherData,
    weatherMode,
    weatherConfidence,
    elevation,
    resolvedLocation,
    currentTimezone,
    onEditLocation
}: WeatherPanelProps) {

    // 🆕 2026: WBGT (Heat Stress) Simplified Calculation for Japan
    const calculateWBGT = (t: number, rh: number) => 0.735 * t + 0.0374 * rh + 0.00292 * t * rh - 4.06

    return (
        <div className="py-6 px-6 bg-stone-50/50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={onEditLocation}
                    className="flex items-center gap-2 hover:bg-white/50 dark:hover:bg-slate-700/50 p-2 -ml-2 rounded-lg transition-colors group"
                >
                    <MapPin className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-colors" />
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                        {resolvedLocation?.name || <span className="inline-block w-20 h-4 bg-slate-200 animate-pulse rounded align-middle" />}
                    </span>
                    <Edit3 className="w-3 h-3 text-slate-300 group-hover:text-amber-500 transition-colors" />
                </button>

                {/* 當地時間顯示 */}
                <div className="flex items-center gap-1.5 bg-white/80 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
                        {getNowInZone(currentTimezone)}
                    </span>
                </div>
            </div>

            {/* 🤖 AI 天氣建議 */}
            {weatherData.length > 0 && (
                <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl p-4 text-white shadow-lg mb-4">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl">🤖</span>
                        <div className="flex-1">
                            <p className="text-sm leading-relaxed">
                                {(() => {
                                    const temps = weatherData.map(w => w.temp)
                                    const maxTemp = Math.max(...temps)
                                    const minTemp = Math.min(...temps)
                                    const avgTemp = (maxTemp + minTemp) / 2
                                    const maxPrecip = Math.max(...weatherData.map(w => w.precipitation_probability ?? 0))
                                    const maxUV = Math.max(...weatherData.map(w => w.uvIndex ?? 0))
                                    const avgRH = weatherData[Math.floor(weatherData.length / 2)]?.humidity ?? 50
                                    const isHighElev = elevation && elevation > 1000
                                    const isVolatile = weatherConfidence !== null && weatherConfidence < 50

                                    const currentWBGT = calculateWBGT(avgTemp, avgRH)
                                    const isHeatStrokeRisk = currentWBGT > 28

                                    let advice = `今日氣溫預計為 ${minTemp}°C 至 ${maxTemp}°C。`

                                    if (isHeatStrokeRisk) {
                                        advice = `🔥 注意：中暑風險極高 (WBGT ${currentWBGT.toFixed(1)})，請盡量避免戶外劇烈運動，多補充水分。`
                                    } else if (isVolatile) {
                                        advice = `⚠️ 預報變動大 (信心度 ${weatherConfidence}%)，建議行程保持彈性。`
                                    } else if (maxPrecip > 60) {
                                        advice += "降雨機率高，建議準備雨具並規劃室內行程。"
                                    } else if (maxUV > 7) {
                                        advice += "紫外線強烈，戶外活動請加強防曬與補水。"
                                    } else if (avgTemp > 28) {
                                        advice += "體感悶熱，請注意防暑降溫，減少長途步行。"
                                    } else if (avgTemp < 10) {
                                        advice += "氣溫較低，早晚溫差大，請注意保暖。"
                                    } else {
                                        advice += "天氣穩定舒適，非常適合戶外探索！"
                                    }

                                    if (isHighElev) advice += ` 目前海拔約 ${Math.round(elevation!)}m，空氣較涼且紫外線更高。`

                                    // 🕵️ Audit 5.0 Restore: Special location logic
                                    const locLower = resolvedLocation?.name.toLowerCase() || ""
                                    if (locLower.includes("market") || locLower.includes("市場")) {
                                        advice += " 市場地面可能濕滑且清晨人多，請注意安全。"
                                    }
                                    if (locLower.includes("tower") || locLower.includes("skytree") || locLower.includes("塔") || locLower.includes("晴空塔")) {
                                        advice += " 高層建築觀景台風力可能較大，建議穿著防風外套。"
                                    }

                                    return advice
                                })()}
                            </p>
                            {weatherMode === 'forecast' && (
                                <div className="mt-2 flex items-center">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                        🛰️ ECMWF 精準預報 (9km)
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 mb-4">
                {weatherData.length > 0 ? weatherData.map((w, i) => (
                    <div key={i} className="flex flex-col items-center min-w-[4rem] gap-2 p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                        <span className="text-xs text-slate-400 font-mono">{w.time}</span>
                        {w.code <= 3 ? <Sun className="w-6 h-6 text-amber-400" /> : <CloudRain className="w-6 h-6 text-blue-400" />}
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">{w.temp}°</span>
                    </div>
                )) : (
                    Array.from({ length: 24 }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center min-w-[4rem] gap-2 p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm shrink-0 animate-pulse">
                            <div className="w-8 h-3 bg-slate-200 dark:bg-slate-700 rounded"></div>
                            <div className="w-6 h-6 bg-slate-200 rounded-full"></div>
                            <div className="w-6 h-4 bg-slate-200 rounded"></div>
                        </div>
                    ))
                )}
            </div>

            <div className="space-y-4 mb-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-xl shrink-0 mt-0.5">
                            {weatherData.length > 0 ? (
                                weatherData[0].code <= 3 ? <Sun className="w-5 h-5 text-amber-500" /> : <CloudRain className="w-5 h-5 text-blue-500" />
                            ) : (
                                <div className="w-5 h-5 bg-slate-200 animate-pulse rounded" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 flex flex-wrap items-center gap-2 leading-tight">
                                <span className="break-words">{resolvedLocation?.name || "未知地點"}</span>
                                {resolvedLocation && (
                                    <span className="text-[9px] font-mono font-normal text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800 px-1 rounded inline-block">
                                        {resolvedLocation.lat.toFixed(2)}, {resolvedLocation.lng.toFixed(2)}
                                    </span>
                                )}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-mono mt-1">
                                <Clock className="w-2.5 h-2.5" />
                                {getNowInZone(currentTimezone)}
                            </div>
                        </div>
                    </div>

                    <div className="text-right shrink-0">
                        <p className="text-sm font-black text-slate-700 dark:text-slate-200 font-mono">
                            {weatherData.length > 0 ? (
                                <>{Math.min(...weatherData.map(w => w.temp))}° / {Math.max(...weatherData.map(w => w.temp))}°</>
                            ) : (
                                <span className="inline-block w-16 h-3 bg-slate-100 animate-pulse rounded" />
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className={`text-[9px] font-bold flex items-center gap-1 px-1.5 py-0.5 rounded-full border transition-all duration-300 ${weatherMode === 'live' ? 'bg-green-50/80 border-green-200 text-green-600 shadow-sm' :
                        weatherMode === 'forecast' ? 'bg-blue-50/80 border-blue-200 text-blue-600 shadow-sm' :
                            weatherMode === 'seasonal' ? 'bg-purple-50/80 border-purple-200 text-purple-600 shadow-sm' :
                                'bg-amber-50/80 border-amber-200 text-amber-600 shadow-sm'
                        }`}>
                        <span className={`w-1 h-1 rounded-full ${weatherMode === 'live' ? 'bg-green-500 animate-pulse' :
                            weatherMode === 'forecast' ? 'bg-blue-500' :
                                weatherMode === 'seasonal' ? 'bg-purple-500' :
                                    'bg-amber-500'
                            }`} />
                        {weatherMode === 'live' && '即時天氣'}
                        {weatherMode === 'forecast' && '精準預報 (ECMWF)'}
                        {weatherMode === 'seasonal' && '季節預報'}
                        {weatherMode === 'trend' && '歷史同期參考'}
                        {(weatherMode === 'seasonal' || weatherMode === 'trend') && (
                            <span className="text-[7px] opacity-60">(觀望趨勢)</span>
                        )}
                    </span>

                    {weatherConfidence !== null && (
                        <span className={cn(
                            "px-1.5 py-0.5 rounded-full text-[9px] font-bold border transition-all duration-300",
                            weatherConfidence >= 80 ? "bg-green-50/80 border-green-200 text-green-600 shadow-sm" :
                                weatherConfidence >= 50 ? "bg-amber-50/80 border-amber-200 text-amber-600" :
                                    "bg-red-50/80 border-red-200 text-red-600"
                        )}>
                            信心度 {weatherConfidence}%
                        </span>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
                {/* Row 1: 穿衣 | 降雨 */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-lg">👕</span>
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">穿衣</div>
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {weatherData.length > 0 ? (() => {
                                const temps = weatherData.map(w => w.temp)
                                const avgTemp = (Math.max(...temps) + Math.min(...temps)) / 2
                                if (avgTemp > 28) return '短袖短褲'
                                if (avgTemp > 22) return '短袖'
                                if (avgTemp > 15) return '長袖'
                                if (avgTemp > 10) return '薄外套'
                                if (avgTemp > 5) return '厚外套'
                                return '羽絨服'
                            })() : '--'}
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-lg">☔</span>
                    <div>
                        <div className="text-xs text-slate-500">
                            {weatherData[0]?.isSeasonalEstimate ? '降雨趨勢' : '降雨機率'}
                        </div>
                        <div className="text-sm font-medium text-slate-700">
                            {weatherData.length > 0 ? (
                                weatherData[0]?.isSeasonalEstimate ? (
                                    (() => {
                                        const trend = weatherData[0]?.precipTrend
                                        if (trend === 'wet') return <span className="text-blue-600">濕潤 💦</span>
                                        if (trend === 'unstable') return <span className="text-amber-600">不穩定 🌦️</span>
                                        return <span className="text-green-600">乾燥 ☀️</span>
                                    })()
                                ) : (
                                    <>{Math.max(...weatherData.map(w => w.precipitation_probability ?? 0))}%</>
                                )
                            ) : '--'}
                        </div>
                        {weatherData[0]?.isSeasonalEstimate && (
                            <div className="text-[9px] text-slate-400 mt-0.5">趨勢估算僅供參考</div>
                        )}
                    </div>
                </div>

                {/* Row 2: 濕度 | 體感 */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-lg">💧</span>
                    <div>
                        <div className="text-xs text-slate-500">濕度</div>
                        <div className="text-sm font-medium text-slate-700">
                            {weatherData.length > 0 ? `${weatherData[Math.floor(weatherData.length / 2)]?.humidity ?? '--'}%` : '--'}
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-lg">🌡️</span>
                    <div className="flex-1">
                        <div className="text-xs text-slate-500">體感溫度</div>
                        <div className="text-sm font-medium text-slate-700 flex items-center justify-between">
                            {weatherData.length > 0 ? (() => {
                                const avgApparent = weatherData[Math.floor(weatherData.length / 2)]?.apparent_temperature
                                const avgTemp = weatherData[Math.floor(weatherData.length / 2)]?.temp ?? 20
                                const avgRH = weatherData[Math.floor(weatherData.length / 2)]?.humidity ?? 50
                                if (avgApparent === undefined) return '-- °C'
                                const wbgt = calculateWBGT(avgTemp, avgRH)
                                let feeling = '舒適'
                                if (avgApparent >= 35) feeling = '酷熱'
                                else if (avgApparent >= 28) feeling = '悶熱'
                                else if (avgApparent >= 20) feeling = '舒適'
                                else if (avgApparent >= 10) feeling = '涼爽'
                                else feeling = '寒冷'
                                return (
                                    <>
                                        <span>{avgApparent}°C ({feeling})</span>
                                        {wbgt > 28 && (
                                            <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded font-bold animate-pulse">
                                                WBGT {wbgt.toFixed(1)} 🔥
                                            </span>
                                        )}
                                    </>
                                )
                            })() : '--'}
                        </div>
                    </div>
                </div>

                {/* Row 3: UV | 風速 */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-lg">☀️</span>
                    <div>
                        <div className="text-xs text-slate-500">UV 指數</div>
                        <div className="text-sm font-medium text-slate-700">
                            {weatherData.length > 0 ? (() => {
                                const maxUV = Math.max(...weatherData.map(w => w.uvIndex ?? 0))
                                if (!isFinite(maxUV)) return '--'
                                return `${maxUV} (${maxUV > 7 ? '極強' : maxUV > 5 ? '強' : maxUV > 2 ? '中' : '弱'})`
                            })() : '--'}
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-lg">🌬️</span>
                    <div>
                        <div className="text-xs text-slate-500">最大風速</div>
                        <div className="text-sm font-medium text-slate-700">
                            {weatherData.length > 0 ? (() => {
                                const maxWind = Math.max(...weatherData.map(w => w.windSpeed ?? 0))
                                if (!isFinite(maxWind)) return '--'
                                return `${maxWind} km/h`
                            })() : '--'}
                        </div>
                    </div>
                </div>

                {/* Row 4: 能見度 | 海拔 */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-lg">👁️</span>
                    <div>
                        <div className="text-xs text-slate-500">能見度</div>
                        <div className="text-sm font-medium text-slate-700">
                            {weatherData.length > 0 ? (() => {
                                const avgVis = weatherData[Math.floor(weatherData.length / 2)]?.visibility
                                if (avgVis === undefined || avgVis === null) return '--'
                                if (avgVis >= 10000) return `${(avgVis / 1000).toFixed(0)} km (良好)`
                                if (avgVis >= 5000) return `${(avgVis / 1000).toFixed(1)} km (普通)`
                                return `${(avgVis / 1000).toFixed(1)} km (較差)`
                            })() : '--'}
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-lg">🏔️</span>
                    <div>
                        <div className="text-xs text-slate-500">海拔</div>
                        <div className="text-sm font-medium text-slate-700">
                            {elevation !== null ? `${Math.round(elevation)} m` : (
                                <span className="inline-block w-8 h-3 bg-slate-200 animate-pulse rounded" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Row 5: AQI */}
                {(() => {
                    // 🛡️ Fix: Always render AQI row (permanent display), show placeholder if no data
                    const validData = weatherData.filter(w => w.airQuality !== undefined)
                    const hasData = validData.length > 0

                    return (
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2 col-span-2">
                            <span className="text-lg">🍃</span>
                            <div className="flex-1">
                                <div className="text-xs text-slate-500">空氣品質 (AQI)</div>
                                <div className="text-sm font-medium text-slate-700">
                                    {hasData ? (() => {
                                        const maxAQI = Math.max(...validData.map(w => w.airQuality!))
                                        let level = '良好'
                                        let color = 'text-green-600'
                                        if (maxAQI > 300) { level = '極危險'; color = 'text-red-600' }
                                        else if (maxAQI > 200) { level = '非常不健康'; color = 'text-red-500' }
                                        else if (maxAQI > 150) { level = '不健康'; color = 'text-orange-500' }
                                        else if (maxAQI > 100) { level = '對敏感人群不健康'; color = 'text-yellow-600' }
                                        else if (maxAQI > 50) { level = '普通'; color = 'text-yellow-500' }
                                        return <span className={color}>{maxAQI} ({level})</span>
                                    })() : <span className="text-slate-400">-- (暫無資料)</span>}
                                </div>
                            </div>
                        </div>
                    )
                })()}
            </div>

            {/* Data attribution */}
            <div className="flex justify-end pt-2">
                <a
                    href="https://open-meteo.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-slate-400 hover:text-blue-500 transition-colors"
                >
                    Weather data by Open-Meteo
                </a>
            </div>
        </div>
    )
}
