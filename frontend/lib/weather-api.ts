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
}

export type WeatherMode = 'live' | 'forecast' | 'seasonal' | 'trend'

export interface WeatherResult {
    forecast: HourlyForecast[]
    mode: WeatherMode
    source: 'sdk' | 'fallback'
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
                hourly: ['temperature_2m', 'weather_code'],
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

                const forecast: HourlyForecast[] = []
                for (let i = 6; i <= 23 && i < temps.length; i++) {
                    forecast.push({
                        time: `${i}:00`,
                        temp: Math.round(temps[i]),
                        code: codes[i] || 0
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
