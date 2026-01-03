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
}

export type WeatherMode = 'live' | 'forecast' | 'seasonal' | 'trend'

export interface WeatherResult {
    forecast: HourlyForecast[]
    mode: WeatherMode
    source: 'sdk' | 'fallback'
}

/**
 * 🆕 Phase 1: 非對稱三段式溫度曲線生成 (Linvill 改進版)
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
 * @param tempRange 日溫差 (用於判斷乾燥/潮濕)
 */
export const generateHourlyCurve = (
    tMin: number,
    tMax: number,
    sunriseHour: number = 6,
    sunsetHour: number = 18,
    tempRange?: number
): number[] => {
    const dayLength = sunsetHour - sunriseHour

    // 最高溫發生時間: 日落前 3-4 小時 (夏季日長則延後)
    const peakHour = dayLength > 13
        ? sunsetHour - 3   // 夏季: 日落前 3 小時
        : sunsetHour - 4   // 冬季: 日落前 4 小時 (約 14:00)

    // 平均溫度
    const avg = (tMax + tMin) / 2

    // 夜間衰減係數: 日溫差大 = 乾燥 = 快速衰減
    const range = tempRange ?? (tMax - tMin)
    const decayRate = range > 15 ? 0.25 : range < 5 ? 0.08 : 0.15

    const temps: number[] = []

    for (let hour = 0; hour < 24; hour++) {
        let temp: number

        if (hour >= sunriseHour && hour <= peakHour) {
            // ========== 段 1: 日出 → 最高溫 (正弦快速上升) ==========
            const progress = (hour - sunriseHour) / (peakHour - sunriseHour)
            temp = tMin + (tMax - tMin) * Math.sin(progress * Math.PI / 2)
        }
        else if (hour > peakHour && hour <= sunsetHour) {
            // ========== 段 2: 最高溫 → 日落 (正弦緩慢下降) ==========
            const progress = (hour - peakHour) / (sunsetHour - peakHour)
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

    console.log(`📈 Linvill 曲線: sunrise=${sunriseHour}, peak=${peakHour.toFixed(1)}, sunset=${sunsetHour}, decay=${decayRate}`)
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
            const params = {
                latitude: lat,
                longitude: lng,
                hourly: ['temperature_2m', 'weather_code', 'relative_humidity_2m', 'precipitation_probability', 'apparent_temperature'],
                models: 'ecmwf_ifs' as const,
                timezone: 'auto',
                ...(targetDate ? { start_date: targetDate, end_date: targetDate } : { forecast_days: 1 })
            }

            const responses = await fetchWeatherApi(
                'https://api.open-meteo.com/v1/forecast',
                params
            )

            if (responses.length > 0) {
                const response = responses[0]
                const hourly = response.hourly()!
                const temps = hourly.variables(0)!.valuesArray()!
                const codes = hourly.variables(1)!.valuesArray()!
                const humidity = hourly.variables(2)?.valuesArray() || []
                const precipProb = hourly.variables(3)?.valuesArray() || []
                const apparent = hourly.variables(4)?.valuesArray() || []

                const forecast: HourlyForecast[] = []
                for (let i = 6; i <= 23 && i < temps.length; i++) {
                    forecast.push({
                        time: `${i}:00`,
                        temp: Math.round(temps[i]),
                        code: codes[i] || 0,
                        humidity: humidity[i] ? Math.round(humidity[i]) : undefined,
                        precipitation_probability: precipProb[i] ? Math.round(precipProb[i]) : undefined,
                        apparent_temperature: apparent[i] ? Math.round(apparent[i]) : undefined
                    })
                }

                console.log(`🚀 P6 SDK (FlatBuffers): ${forecast.length} 小時預報`)
                return { forecast, mode, source: 'sdk' }
            }
        }

        return null
    } catch (error) {
        console.warn('⚠️ P6 SDK 失敗，將使用 JSON fallback:', error)
        return null
    }
}
