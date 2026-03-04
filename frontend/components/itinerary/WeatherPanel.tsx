"use client"

import { Sun, CloudRain, MapPin, Edit3, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { DayWeather, LocationInfo } from "@/lib/itinerary-types"
import { getNowInZone } from "@/lib/timezone"
import { useLanguage } from "@/lib/LanguageContext"

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
    const { t } = useLanguage()

    // 🆕 2026: WBGT (Heat Stress) Simplified Calculation for Japan
    const calculateWBGT = (temp: number, rh: number) => 0.735 * temp + 0.0374 * rh + 0.00292 * temp * rh - 4.06

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

                                    let advice = t('w_advice_range', { min: String(minTemp), max: String(maxTemp) })

                                    if (isHeatStrokeRisk) {
                                        advice = t('w_advice_heatstroke', { wbgt: currentWBGT.toFixed(1) })
                                    } else if (isVolatile) {
                                        advice = t('w_advice_unstable', { pct: String(weatherConfidence) })
                                    } else if (maxPrecip > 60) {
                                        advice += t('w_advice_rain')
                                    } else if (maxUV > 7) {
                                        advice += t('w_advice_uv')
                                    } else if (avgTemp > 28) {
                                        advice += t('w_advice_humid')
                                    } else if (avgTemp < 10) {
                                        advice += t('w_advice_cold')
                                    } else {
                                        advice += t('w_advice_clear')
                                    }

                                    if (isHighElev) advice += ' ' + t('w_advice_elevation', { elev: String(Math.round(elevation!)) })

                                    // 🕵️ Audit 5.0 Restore: Special location logic
                                    const locLower = resolvedLocation?.name.toLowerCase() || ""
                                    if (locLower.includes("market") || locLower.includes("市場")) {
                                        advice += ' ' + t('w_advice_market')
                                    }
                                    if (locLower.includes("tower") || locLower.includes("skytree") || locLower.includes("塔") || locLower.includes("晴空塔")) {
                                        advice += ' ' + t('w_advice_tower')
                                    }

                                    return advice
                                })()}
                            </p>
                            {weatherMode === 'forecast' && (
                                <div className="mt-2 flex items-center">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                        {t('w_ecmwf_badge')}
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
                                <span className="break-words">{resolvedLocation?.name || t('w_unknown_location')}</span>
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
                        {weatherMode === 'live' && t('w_mode_live')}
                        {weatherMode === 'forecast' && t('w_mode_forecast')}
                        {weatherMode === 'seasonal' && t('w_mode_seasonal')}
                        {weatherMode === 'trend' && t('w_mode_trend')}
                        {(weatherMode === 'seasonal' || weatherMode === 'trend') && (
                            <span className="text-[7px] opacity-60">{t('w_reference_only')}</span>
                        )}
                    </span>

                    {weatherConfidence !== null && (
                        <span className={cn(
                            "px-1.5 py-0.5 rounded-full text-[9px] font-bold border transition-all duration-300",
                            weatherConfidence >= 80 ? "bg-green-50/80 border-green-200 text-green-600 shadow-sm" :
                                weatherConfidence >= 50 ? "bg-amber-50/80 border-amber-200 text-amber-600" :
                                    "bg-red-50/80 border-red-200 text-red-600"
                        )}>
                            {t('w_confidence', { value: String(weatherConfidence) })}
                        </span>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
                {/* Row 1: 穿衣 | 降雨 */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-lg">👕</span>
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{t('w_clothing')}</div>
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {weatherData.length > 0 ? (() => {
                                const temps = weatherData.map(w => w.temp)
                                const avgTemp = (Math.max(...temps) + Math.min(...temps)) / 2
                                if (avgTemp > 28) return t('w_cloth_tank')
                                if (avgTemp > 22) return t('w_cloth_tshirt')
                                if (avgTemp > 15) return t('w_cloth_longsleeve')
                                if (avgTemp > 10) return t('w_cloth_jacket')
                                if (avgTemp > 5) return t('w_cloth_coat')
                                return t('w_cloth_parka')
                            })() : '--'}
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-lg">☔</span>
                    <div>
                        <div className="text-xs text-slate-500">
                            {weatherData[0]?.isSeasonalEstimate ? t('w_rain_trend') : t('w_rain_prob')}
                        </div>
                        <div className="text-sm font-medium text-slate-700">
                            {weatherData.length > 0 ? (
                                weatherData[0]?.isSeasonalEstimate ? (
                                    (() => {
                                        const trend = weatherData[0]?.precipTrend
                                        if (trend === 'wet') return <span className="text-blue-600">{t('w_trend_wet')}</span>
                                        if (trend === 'unstable') return <span className="text-amber-600">{t('w_trend_unstable')}</span>
                                        return <span className="text-green-600">{t('w_trend_dry')}</span>
                                    })()
                                ) : (
                                    <>{Math.max(...weatherData.map(w => w.precipitation_probability ?? 0))}%</>
                                )
                            ) : '--'}
                        </div>
                        {weatherData[0]?.isSeasonalEstimate && (
                            <div className="text-[9px] text-slate-400 mt-0.5">{t('w_trend_disclaimer')}</div>
                        )}
                    </div>
                </div>

                {/* Row 2: 濕度 | 體感 */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-lg">💧</span>
                    <div>
                        <div className="text-xs text-slate-500">{t('w_humidity')}</div>
                        <div className="text-sm font-medium text-slate-700">
                            {weatherData.length > 0 ? `${weatherData[Math.floor(weatherData.length / 2)]?.humidity ?? '--'}%` : '--'}
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-lg">🌡️</span>
                    <div className="flex-1">
                        <div className="text-xs text-slate-500">{t('w_apparent')}</div>
                        <div className="text-sm font-medium text-slate-700 flex items-center justify-between">
                            {weatherData.length > 0 ? (() => {
                                const avgApparent = weatherData[Math.floor(weatherData.length / 2)]?.apparent_temperature
                                const avgTemp = weatherData[Math.floor(weatherData.length / 2)]?.temp ?? 20
                                const avgRH = weatherData[Math.floor(weatherData.length / 2)]?.humidity ?? 50
                                if (avgApparent === undefined) return '-- °C'
                                const wbgt = calculateWBGT(avgTemp, avgRH)
                                let feeling = t('w_comfort_pleasant')
                                if (avgApparent >= 35) feeling = t('w_comfort_extreme')
                                else if (avgApparent >= 28) feeling = t('w_comfort_hot')
                                else if (avgApparent >= 20) feeling = t('w_comfort_pleasant')
                                else if (avgApparent >= 10) feeling = t('w_comfort_cool')
                                else feeling = t('w_comfort_cold')
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
                        <div className="text-xs text-slate-500">{t('w_uv')}</div>
                        <div className="text-sm font-medium text-slate-700">
                            {weatherData.length > 0 ? (() => {
                                const maxUV = Math.max(...weatherData.map(w => w.uvIndex ?? 0))
                                if (!isFinite(maxUV)) return '--'
                                return `${maxUV} (${maxUV > 7 ? t('w_uv_extreme') : maxUV > 5 ? t('w_uv_high') : maxUV > 2 ? t('w_uv_moderate') : t('w_uv_low')})`
                            })() : '--'}
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-lg">🌬️</span>
                    <div>
                        <div className="text-xs text-slate-500">{t('w_wind')}</div>
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
                        <div className="text-xs text-slate-500">{t('w_visibility')}</div>
                        <div className="text-sm font-medium text-slate-700">
                            {weatherData.length > 0 ? (() => {
                                const avgVis = weatherData[Math.floor(weatherData.length / 2)]?.visibility
                                if (avgVis === undefined || avgVis === null) return '--'
                                if (avgVis >= 10000) return `${(avgVis / 1000).toFixed(0)} km (${t('w_vis_good')})`
                                if (avgVis >= 5000) return `${(avgVis / 1000).toFixed(1)} km (${t('w_vis_fair')})`
                                return `${(avgVis / 1000).toFixed(1)} km (${t('w_vis_poor')})`
                            })() : '--'}
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-lg">🏔️</span>
                    <div>
                        <div className="text-xs text-slate-500">{t('w_elevation')}</div>
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
                                <div className="text-xs text-slate-500">{t('w_aqi')}</div>
                                <div className="text-sm font-medium text-slate-700">
                                    {hasData ? (() => {
                                        const maxAQI = Math.max(...validData.map(w => w.airQuality!))
                                        let level = t('w_aqi_good')
                                        let color = 'text-green-600'
                                        if (maxAQI > 300) { level = t('w_aqi_hazardous'); color = 'text-red-600' }
                                        else if (maxAQI > 200) { level = t('w_aqi_very_unhealthy'); color = 'text-red-500' }
                                        else if (maxAQI > 150) { level = t('w_aqi_unhealthy'); color = 'text-orange-500' }
                                        else if (maxAQI > 100) { level = t('w_aqi_sensitive'); color = 'text-yellow-600' }
                                        else if (maxAQI > 50) { level = t('w_aqi_moderate'); color = 'text-yellow-500' }
                                        return <span className={color}>{maxAQI} ({level})</span>
                                    })() : <span className="text-slate-400">{t('w_aqi_nodata')}</span>}
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
