/**
 * 天氣API工具 - 使用 Open-Meteo SDK (FlatBuffers 優化)
 * 
 * 🆕 P6: 使用官方 SDK 處理 FlatBuffers 二進位解碼
 * 比 JSON 節省 70% 流量，加速行動端載入
 */

import { fetchWeatherApi } from 'openmeteo'

export interface HourlyForecast {
    time: string
    temp: number
    code: number
    humidity?: number               // 🆕 濕度 (%)
    precipitation_probability?: number  // 🆕 降雨機率 (%)
    apparent_temperature?: number   // 🆕 體感溫度
    uvIndex?: number                // 🆕 Phase 6: 紫外線指數
    windSpeed?: number              // 🆕 Phase 6: 風速 (km/h)
    visibility?: number             // 🆕 Phase 6: 能見度 (m)
    airQuality?: number             // 🆕 Phase 9: AQI (US AQI)
}

export type WeatherMode = 'live' | 'forecast' | 'seasonal' | 'trend'

export interface WeatherResult {
    forecast: HourlyForecast[]
    mode: WeatherMode
    source: 'sdk' | 'fallback'
    elevation?: number // 🆕 Phase 6: 海拔 (m)
}

/**
 * 🆕 Phase 3: 季節配置
 */
type Season = 'summer' | 'winter' | 'spring_autumn'

const getSeasonConfig = (month: number, dayLength: number) => {
    // 根據日照長度和月份判斷季節
    // 夏季: 日長 > 13 小時 (5-8月)
    // 冬季: 日長 < 11 小時 (11-2月)
    // 春秋: 其他

    let season: Season
    if (dayLength > 13 || (month >= 5 && month <= 8)) {
        season = 'summer'
    } else if (dayLength < 11 || month >= 11 || month <= 2) {
        season = 'winter'
    } else {
        season = 'spring_autumn'
    }

    const configs: Record<Season, { decayMod: number; peakDelay: number; label: string }> = {
        summer: {
            decayMod: 0.7,      // 夏季: 緩慢衰減 (濕度高)
            peakDelay: 0.5,     // 最高溫延後 0.5 小時
            label: '夏季模式'
        },
        winter: {
            decayMod: 1.5,      // 冬季: 快速衰減 (輻射冷卻強)
            peakDelay: -0.5,    // 最高溫提早 0.5 小時
            label: '冬季模式'
        },
        spring_autumn: {
            decayMod: 1.0,      // 春秋: 標準
            peakDelay: 0,
            label: '春秋模式'
        }
    }

    return { season, ...configs[season] }
}

/**
 * 🆕 Phase 1-3: 非對稱三段式溫度曲線生成 (Linvill 改進版 + 季節調節)
 * 
 * 三段式模型:
 * 1. 日出 → 最高溫: 正弦快速上升
 * 2. 最高溫 → 日落: 正弦緩慢下降 (熱慣性)
 * 3. 日落 → 日出: 指數衰減 (輻射冷卻)
 * 
 * @param tMin 日最低溫
 * @param tMax 日最高溫
 * @param sunriseHour 日出時間 (小時, 如 5.5 = 05:30)
 * @param sunsetHour 日落時間 (小時, 如 18.5 = 18:30)
 * @param month 月份 (1-12) 用於季節判斷
 * @param elevation 海拔高度 (公尺) 用於地理修正
 * @param latitude 緯度 用於地理修正
 */
export const generateHourlyCurve = (
    tMin: number,
    tMax: number,
    sunriseHour: number = 6,
    sunsetHour: number = 18,
    month?: number,
    elevation?: number,
    latitude?: number,
    weatherCode?: number // 🆕 Phase 9: 天氣代碼微氣候修正
): number[] => {
    const dayLength = sunsetHour - sunriseHour

    // 🆕 Phase 3: 季節調節
    const currentMonth = month ?? new Date().getMonth() + 1
    const seasonConfig = getSeasonConfig(currentMonth, dayLength)

    // 🆕 Phase 9: 微氣候聚類 (Physics-based Shape Tuning)
    const weatherMod = { decayFactor: 1.0, peakShift: 0 }
    if (weatherCode !== undefined) {
        if (weatherCode <= 1) { // 晴天: 輻射冷卻強
            weatherMod.decayFactor = 1.5
        } else if (weatherCode >= 2 && weatherCode <= 3) { // 多雲: 雲層保溫
            weatherMod.decayFactor = 0.8
        } else if (weatherCode >= 50 && weatherCode <= 69) { // 雨天: 濕度高，溫差小
            weatherMod.decayFactor = 0.5
        } else if (weatherCode >= 95) { // 雷雨: 午後對流，提早降溫
            weatherMod.peakShift = -1.5
        }
    }

    // 🆕 Phase 4: 地理修正係數
    const geoMod = {
        // 高海拔 (>1000m): 夜間衰減更快
        elevationFactor: elevation && elevation > 1000 ? 1.3 : 1.0,
        // 高緯度夏季 (>45°): 曲線扁平化
        latitudeFactor: latitude && Math.abs(latitude) > 45 && (currentMonth >= 5 && currentMonth <= 8) ? 0.7 : 1.0,
        // 沿海判斷需要更多數據，暫用溫差小判斷
        coastalDelay: (tMax - tMin) < 8 ? 0.5 : 0  // 溫差小可能沿海，延後最高溫
    }

    // 最高溫發生時間: 季節 + 地理調整 + 天氣修正
    const basePeakHour = dayLength > 13 ? sunsetHour - 3 : sunsetHour - 4
    const peakHour = basePeakHour + seasonConfig.peakDelay + geoMod.coastalDelay + weatherMod.peakShift

    // 平均溫度
    const avg = (tMax + tMin) / 2

    // 夜間衰減係數: 日溫差 + 季節 + 地理 + 天氣修正
    const range = tMax - tMin
    const baseDecay = range > 15 ? 0.25 : range < 5 ? 0.08 : 0.15
    const decayRate = baseDecay * seasonConfig.decayMod * geoMod.elevationFactor * geoMod.latitudeFactor * weatherMod.decayFactor

    const temps: number[] = []

    for (let hour = 0; hour < 24; hour++) {
        let temp: number

        if (hour >= sunriseHour && hour <= peakHour) {
            // ========== 段 1: 日出 → 最高溫 (正弦快速上升) ==========
            const divisor1 = peakHour - sunriseHour
            const progress = divisor1 > 0 ? (hour - sunriseHour) / divisor1 : 0
            temp = tMin + (tMax - tMin) * Math.sin(progress * Math.PI / 2)
        }
        else if (hour > peakHour && hour <= sunsetHour) {
            // ========== 段 2: 最高溫 → 日落 (正弦緩慢下降) ==========
            const divisor2 = sunsetHour - peakHour
            const progress = divisor2 > 0 ? (hour - peakHour) / divisor2 : 0
            temp = tMax - (tMax - avg) * Math.sin(progress * Math.PI / 2)
        }
        else {
            // ========== 段 3: 夜間 (指數衰減) ==========
            let hoursSinceSunset: number
            if (hour > sunsetHour) {
                hoursSinceSunset = hour - sunsetHour
            } else {
                // 過了午夜
                hoursSinceSunset = (24 - sunsetHour) + hour
            }

            // 從日落時的溫度開始衰減到最低溫
            const sunsetTemp = avg  // 日落時約為平均溫度
            const targetAtSunrise = tMin

            // 指數衰減: T(t) = Tmin + (Tsunset - Tmin) * e^(-λt)
            const lambda = decayRate
            temp = targetAtSunrise + (sunsetTemp - targetAtSunrise) * Math.exp(-lambda * hoursSinceSunset)
        }

        temps.push(Math.round(temp))
    }

    console.log(`📈 Phase 4 Linvill: ${seasonConfig.label} | peak=${peakHour.toFixed(1)}, decay=${decayRate.toFixed(2)}, elev=${elevation ?? 0}m, lat=${latitude?.toFixed(1) ?? 'N/A'}`)
    return temps
}

/**
 * 使用 Open-Meteo SDK 取得天氣 (FlatBuffers 優化)
 */
export const fetchWeatherWithSDK = async (
    lat: number,
    lng: number,
    targetDate: string | null,
    daysFromNow: number
): Promise<WeatherResult | null> => {
    try {
        // 決定模式
        let mode: WeatherMode = 'live'
        if (daysFromNow < 0) mode = 'trend'
        else if (daysFromNow === 0) mode = 'live'  // 今天 = 即時
        else if (daysFromNow <= 16) mode = 'forecast'
        else if (daysFromNow <= 46) mode = 'seasonal'
        else mode = 'trend'

        // Forecast API (0-16 天) - live 和 forecast 都用這個
        if (mode === 'forecast' || mode === 'live') {
            // 🆕 Phase 6: 並行請求海拔與天氣數據
            // P6-1: 請求 Elevation API (需手動 fetch 因為 SDK 只支援 weather)
            // 🔧 Fix: Unify cache precision to toFixed(2) (~1.1km) to match Weather. 
            const elevCacheKey = `elev_${lat.toFixed(2)}_${lng.toFixed(2)}`
            const cachedElev = typeof localStorage !== 'undefined' ? localStorage.getItem(elevCacheKey) : null

            const elevationPromise = (async () => {
                if (cachedElev) return parseFloat(cachedElev)
                try {
                    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`)
                    const data = await res.json()
                    const val = data.elevation?.[0] as number | undefined
                    if (val !== undefined && typeof localStorage !== 'undefined') {
                        localStorage.setItem(elevCacheKey, val.toString())
                    }
                    return val
                } catch { return undefined }
            })()

            // 🆕 Phase 9: Air Quality API (並行請求 + Cache)
            const aqiCacheKey = `aqi_${lat.toFixed(2)}_${lng.toFixed(2)}_${targetDate || 'today'}`
            const cachedAQI = typeof localStorage !== 'undefined' ? localStorage.getItem(aqiCacheKey) : null

            const aqiPromise = (async () => {
                if (cachedAQI) {
                    try { return JSON.parse(cachedAQI).data as number[] } catch { /* ignore */ }
                }
                try {
                    const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&hourly=us_aqi&domain=cams_global&timezone=auto&start_date=${targetDate || new Date().toISOString().split('T')[0]}&end_date=${targetDate || new Date().toISOString().split('T')[0]}`)
                    const data = await res.json()
                    const vals = data.hourly?.us_aqi as number[] | undefined
                    if (vals && typeof localStorage !== 'undefined') {
                        localStorage.setItem(aqiCacheKey, JSON.stringify({ data: vals, ts: Date.now() }))
                    }
                    return vals
                } catch { return undefined }
            })()


            const params = {
                latitude: lat,
                longitude: lng,
                // 🆕 Phase 6: 加入 UV, 風速, 能見度
                hourly: ['temperature_2m', 'weather_code', 'relative_humidity_2m', 'precipitation_probability', 'apparent_temperature', 'uv_index', 'wind_speed_10m', 'visibility'],
                models: 'ecmwf_ifs' as const,
                timezone: 'auto',
                ...(targetDate ? { start_date: targetDate, end_date: targetDate } : { forecast_days: 1 })
            }

            // P6-2 + P9: 並行執行 (Weather + Elevation + AQI)
            // 🔧 Fix: Use allSettled to prevent failures
            const [weatherResult, elevResult, aqiResult] = await Promise.allSettled([
                fetchWeatherApi('https://api.open-meteo.com/v1/forecast', params),
                elevationPromise,
                aqiPromise
            ])

            // P6-3 & P9: 解析數據
            const response = weatherResult.status === 'fulfilled' ? weatherResult.value[0] : null
            if (!response) return null

            const elevation = elevResult.status === 'fulfilled' ? elevResult.value : undefined
            const aqiData = aqiResult.status === 'fulfilled' ? aqiResult.value : undefined

            const utcOffsetSeconds = response.utcOffsetSeconds()
            const hourly = response.hourly()!

            // Helper function to generate a range of numbers
            const range = (start: number, stop: number, step: number) =>
                Array.from({ length: (stop - start) / step }, (_, i) => start + i * step);

            const weatherData = {
                hourly: {
                    time: range(Number(hourly.time()), Number(hourly.timeEnd()), hourly.interval()).map(
                        (t) => new Date((t + utcOffsetSeconds) * 1000).toISOString()
                    ),
                    temperature_2m: hourly.variables(0)?.valuesArray(),
                    weather_code: hourly.variables(1)?.valuesArray(),
                    relative_humidity_2m: hourly.variables(2)?.valuesArray(),
                    precipitation_probability: hourly.variables(3)?.valuesArray(),
                    apparent_temperature: hourly.variables(4)?.valuesArray(),
                    uv_index: hourly.variables(5)?.valuesArray(),
                    wind_speed: hourly.variables(6)?.valuesArray(),
                    visibility: hourly.variables(7)?.valuesArray(),
                },
            }

            // 🛡️ 數據完整性檢查：如果核心溫度數據缺失，返回 null 觸發 JSON Fallback
            if (!weatherData.hourly.temperature_2m) {
                console.warn("SDK Mapping: Missing core temperature data")
                return null
            }

            // 🆕 偵錯日誌：追蹤變數映射狀態
            console.log(`[Weather SDK] Successfully mapped ${hourly.variablesLength()} variables for ${lat.toFixed(2)}, ${lng.toFixed(2)}`)

            const forecast: HourlyForecast[] = []
            for (let i = 0; i < weatherData.hourly.time.length; i++) {
                // 取得小時 (0-23)
                const hour = new Date(weatherData.hourly.time[i]).getHours()

                forecast.push({
                    time: `${hour}:00`,
                    temp: Math.round(weatherData.hourly.temperature_2m[i]),
                    code: weatherData.hourly.weather_code ? weatherData.hourly.weather_code[i] : 0,
                    humidity: weatherData.hourly.relative_humidity_2m ? Math.round(weatherData.hourly.relative_humidity_2m[i]) : undefined,
                    precipitation_probability: weatherData.hourly.precipitation_probability ? Math.round(weatherData.hourly.precipitation_probability[i]) : undefined,
                    apparent_temperature: weatherData.hourly.apparent_temperature ? Math.round(weatherData.hourly.apparent_temperature[i]) : undefined,
                    uvIndex: weatherData.hourly.uv_index ? Number(weatherData.hourly.uv_index[i].toFixed(1)) : 0,
                    windSpeed: weatherData.hourly.wind_speed ? Math.round(weatherData.hourly.wind_speed[i]) : 0,
                    visibility: weatherData.hourly.visibility ? weatherData.hourly.visibility[i] : 10000,
                    airQuality: aqiData ? aqiData[i] : undefined // 🆕 Phase 9: AQI
                })
            }

            return {
                forecast,
                mode,
                source: 'sdk',
                elevation
            }
        }

        return null // 其他模式暫時返回 null (由外部 fallback 處理)

    } catch (e) {
        console.error("SDK Error:", e)
        return null
    }
}
