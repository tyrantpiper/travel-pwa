/**
 * Weather panel translations — temperature feelings, UV index levels,
 * AQI ratings, visibility descriptions, and AI weather advice.
 *
 * Consumed by `WeatherPanel.tsx`.
 *
 * Design note: Weather advice uses interpolation keys like `{min}`, `{max}`
 * so the `t()` function can inject dynamic values.
 */
export const weatherTranslations = {
    en: {
        // Mode labels
        w_location: "Location",
        w_mode_live: "Live Weather",
        w_mode_forecast: "Forecast (ECMWF)",
        w_mode_seasonal: "Seasonal Ref",
        w_mode_trend: "Historical Weather",
        w_reference_only: "(Reference only)",
        w_confidence: "Confidence {value}%",

        // Row labels
        w_temp: "Temp",
        w_humidity: "Humidity",
        w_apparent: "Feels Like",
        w_uv: "UV Index",
        w_wind: "Max Wind",
        w_visibility: "Visibility",
        w_cloud: "Cloud",
        w_aqi: "Air Quality (AQI)",
        w_precip_chance: "Rain %",
        w_precip_amount: "Rainfall",
        w_seasonal_estimate: "Seasonal Est.",

        // Temperature feel (6 levels)
        w_feel_scorching: "Scorching",
        w_feel_hot: "Hot & Humid",
        w_feel_warm: "Warm",
        w_feel_cool: "Cool",
        w_feel_chilly: "Chilly",
        w_feel_freezing: "Freezing",

        // Comfort (6 levels)
        w_comfort_extreme: "Extreme Heat",
        w_comfort_hot: "Hot",
        w_comfort_pleasant: "Pleasant",
        w_comfort_cool: "Cool",
        w_comfort_cold: "Cold",

        // Rain trend
        w_trend_wet: "Wet 💦",
        w_trend_unstable: "Unstable 🌦️",
        w_trend_dry: "Dry ☀️",
        w_trend_note: "Estimates based on seasonal data",

        // UV levels
        w_uv_extreme: "Extreme",
        w_uv_high: "High",
        w_uv_moderate: "Moderate",
        w_uv_low: "Low",

        // Visibility
        w_vis_good: "Good",
        w_vis_fair: "Fair",
        w_vis_poor: "Poor",

        // AQI levels
        w_aqi_good: "Good",
        w_aqi_moderate: "Moderate",
        w_aqi_sensitive: "Unhealthy for Sensitive",
        w_aqi_unhealthy: "Unhealthy",
        w_aqi_very_unhealthy: "Very Unhealthy",
        w_aqi_hazardous: "Hazardous",
        w_aqi_nodata: "-- (No data)",

        // AI advice fragments (interpolation)
        w_advice_range: "Expected {min}°C – {max}°C.",
        w_advice_heatstroke: "⚠️ Beware of heatstroke (WBGT {wbgt}). Stay hydrated and avoid prolonged outdoor activity.",
        w_advice_unstable: "⚠️ Weather is unstable (confidence {pct}%). Flexible plans recommended.",
        w_advice_rain: "Rain is likely. Bring an umbrella and waterproof shoes.",
        w_advice_wind: "Strong winds expected. Wear windproof layers or a jacket.",
        w_advice_snow: "Snow possible. Watch for icy roads and carry traction gear.",
        w_advice_cold: "Cold weather. Large temperature swings — dress in layers.",
        w_advice_clear: "Clear and pleasant — great for outdoor activities!",
        w_advice_elevation: "Current elevation ~{elev}m. Temperature drops faster at altitude.",
        w_advice_market: "Markets can be crowded. Watch your belongings.",
        w_advice_tower: "Observation towers may have strong winds. Secure loose items.",
        w_advice_uv: "Strong UV. Apply sunscreen and stay hydrated outdoors.",
        w_advice_humid: "Hot & humid. Watch for heat exhaustion, limit long walks.",

        // Clothing (6 levels)
        w_clothing: "Clothing",
        w_cloth_tank: "Tank Top & Shorts",
        w_cloth_tshirt: "T-Shirt",
        w_cloth_longsleeve: "Long Sleeve",
        w_cloth_jacket: "Light Jacket",
        w_cloth_coat: "Heavy Coat",
        w_cloth_parka: "Down Jacket",

        // Additional labels
        w_rain_trend: "Rain Trend",
        w_rain_prob: "Rain %",
        w_elevation: "Elevation",
        w_trend_disclaimer: "Estimates based on seasonal data",
        w_ecmwf_badge: "🛰️ ECMWF Forecast (9km)",
        w_unknown_location: "Unknown Location",

        // Season mode labels (consumed via key-based lookup)
        w_season_summer: "Summer Mode",
        w_season_winter: "Winter Mode",
        w_season_spring: "Spring/Autumn Mode",
    },
    zh: {
        // Mode labels
        w_location: "地點",
        w_mode_live: "即時天氣",
        w_mode_forecast: "預報 (ECMWF)",
        w_mode_seasonal: "季節參考",
        w_mode_trend: "歷史天氣",
        w_reference_only: "(僅供參考)",
        w_confidence: "信心指數 {value}%",

        // Row labels
        w_temp: "溫",
        w_humidity: "濕",
        w_apparent: "體感溫",
        w_uv: "UV 值",
        w_wind: "最大風速",
        w_visibility: "能見度",
        w_cloud: "雲",
        w_aqi: "空氣品質 (AQI)",
        w_precip_chance: "降機率",
        w_precip_amount: "降水量",
        w_seasonal_estimate: "僅供參考季節性資料",

        // Temperature feel
        w_feel_scorching: "非常悶熱",
        w_feel_hot: "悶熱",
        w_feel_warm: "溫暖",
        w_feel_cool: "微涼",
        w_feel_chilly: "小寒冷",
        w_feel_freezing: "嚴寒",

        // Comfort
        w_comfort_extreme: "酷熱",
        w_comfort_hot: "悶熱",
        w_comfort_pleasant: "舒適",
        w_comfort_cool: "涼爽",
        w_comfort_cold: "寒冷",

        // Rain trend
        w_trend_wet: "濕潤 💦",
        w_trend_unstable: "不穩定 🌦️",
        w_trend_dry: "乾燥 ☀️",
        w_trend_note: "僅供參考季節性資料",

        // UV levels
        w_uv_extreme: "極強",
        w_uv_high: "強",
        w_uv_moderate: "中",
        w_uv_low: "低",

        // Visibility
        w_vis_good: "良好",
        w_vis_fair: "普通",
        w_vis_poor: "差",

        // AQI levels
        w_aqi_good: "良好",
        w_aqi_moderate: "普通",
        w_aqi_sensitive: "敏感人群有害",
        w_aqi_unhealthy: "有害",
        w_aqi_very_unhealthy: "非常有害",
        w_aqi_hazardous: "危險",
        w_aqi_nodata: "-- (暫無資料)",

        // AI advice
        w_advice_range: "預計氣溫 {min}°C ~ {max}°C。",
        w_advice_heatstroke: "⚠️ 當心中暑 (WBGT {wbgt})，建議盡量避免戶外工作與運動，多時充水。",
        w_advice_unstable: "⚠️ 穩定度大 (信心度 {pct}%)，建議彈性行程。",
        w_advice_rain: "降雨機率高，建議準備雨傘及防水鞋。",
        w_advice_wind: "風力較大，外出建議加大衣或防風外套。",
        w_advice_snow: "降雪可能，請注意路面結冰，攜帶防滑鞋。",
        w_advice_cold: "氣溫低，晝夜溫差大，請注意保暖。",
        w_advice_clear: "天氣晴朗穩定，非常適合出門！",
        w_advice_elevation: "目前海拔 ~{elev}m，氣溫降低速度比平地高。",
        w_advice_market: "市場人流眾多，請注意安全。",
        w_advice_tower: "高層建築觀景台風速可能較大，建議繫好外衣。",
        w_advice_uv: "紫外線強烈，戶外活動請加強防曬與補水。",
        w_advice_humid: "體感悶熱，請注意防暑降溫，減少長途步行。",

        // Clothing (6 levels)
        w_clothing: "穿衣",
        w_cloth_tank: "短袖短褲",
        w_cloth_tshirt: "短袖",
        w_cloth_longsleeve: "長袖",
        w_cloth_jacket: "薄外套",
        w_cloth_coat: "厚外套",
        w_cloth_parka: "羽絨服",

        // Additional labels
        w_rain_trend: "降雨趨勢",
        w_rain_prob: "降雨機率",
        w_elevation: "海拔",
        w_trend_disclaimer: "趨勢估算僅供參考",
        w_ecmwf_badge: "🛰️ ECMWF 精準預報 (9km)",
        w_unknown_location: "未知地點",

        // Season mode labels (consumed via key-based lookup)
        w_season_summer: "夏季模式",
        w_season_winter: "冬季模式",
        w_season_spring: "春秋模式",
    },
} as const
