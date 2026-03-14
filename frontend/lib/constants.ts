/**
 * 共用常量定義
 * 從 itinerary-view.tsx 和 info-view.tsx 抽取的共用數據
 */

/**
 * 國家與地區對照表
 * 用於地點搜尋的國家/地區下拉選單
 */
export const COUNTRY_REGIONS: { [key: string]: string[] } = {
    "Japan": ["Tokyo 東京", "Osaka 大阪", "Kyoto 京都", "Hokkaido 北海道", "Okinawa 沖繩", "Fukuoka 福岡", "Nagoya 名古屋", "Yokohama 橫濱", "Nara 奈良", "Hiroshima 廣島"],
    "Taiwan": ["Taipei 台北", "Kaohsiung 高雄", "Taichung 台中", "Tainan 台南", "Hualien 花蓮", "Yilan 宜蘭", "Taitung 台東"],
    "South Korea": ["Seoul 首爾", "Busan 釜山", "Jeju 濟州島", "Incheon 仁川", "Daegu 大邱"],
    "Thailand": ["Bangkok 曼谷", "Chiang Mai 清邁", "Phuket 普吉島", "Pattaya 芭達雅"],
    "Vietnam": ["Ho Chi Minh City 胡志明市", "Hanoi 河內", "Da Nang 峴港", "Hoi An 會安"],
    "Hong Kong": ["Central 中環", "Tsim Sha Tsui 尖沙咀", "Mong Kok 旺角", "Causeway Bay 銅鑼灣"],
    "Singapore": ["Marina Bay 濱海灣", "Sentosa 聖淘沙", "Chinatown 牛車水", "Orchard 烏節路"],
    "USA": ["New York 紐約", "Los Angeles 洛杉磯", "San Francisco 舊金山", "Las Vegas 拉斯維加斯", "Chicago 芝加哥"],
    "UK": ["London 倫敦", "Edinburgh 愛丁堡", "Manchester 曼徹斯特", "Oxford 牛津"],
    "France": ["Paris 巴黎", "Nice 尼斯", "Lyon 里昂", "Marseille 馬賽"],
    "Italy": ["Rome 羅馬", "Milan 米蘭", "Venice 威尼斯", "Florence 佛羅倫斯"],
}

/**
 * 地圖樣式配置 (Terra-Cognita 架構)
 * 可透過環境變數覆寫實現解耦
 */
export const MAP_STYLES = {
    // OpenFreeMap 向量底圖 (免費、無限制、無 API Key)
    VECTOR: process.env.NEXT_PUBLIC_MAP_STYLE_VECTOR || "https://tiles.openfreemap.org/styles/liberty",

    // Esri 衛星影像 (免費，需標註來源)
    // Legacy Raster Tile: 不需要 Token，但僅地圖磚
    SATELLITE: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",

    // Esri modern Basemap Styles API v2 (需要 ArcGIS API Token)
    // Monthly 2M requests free: https://location.arcgis.com/
    SATELLITE_V2: (token: string) => `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/imagery?token=${token}`,

    // 3D 建築設定
    BUILDING_3D: {
        MIN_ZOOM: 15,           // 只在 zoom >= 15 時渲染 3D
        MAX_HEIGHT: 200,        // 最大高度限制 (米)
        OPACITY: 0.8,
        COLOR: "#dcdcdc",
    },

    // 衛星模式下需隱藏的圖層 (背景類)
    LAYERS_HIDE_ON_SATELLITE: [
        "background",
        "land",
        "landcover",
        "landuse",
        "water",
        "waterway",
    ],

    // 衛星模式下需調整透明度的圖層 (道路類)
    LAYERS_TRANSPARENT_ON_SATELLITE: [
        "road",
        "bridge",
        "tunnel",
    ],

    // 衛星模式道路透明度
    ROAD_OPACITY_ON_SATELLITE: 0.7,
}

/**
 * 地圖中文化配置
 * 將所有標籤優先顯示繁體中文，並提供回退機制
 */
export const MAP_LOCALIZATION = {
    // 中文標籤優先級表達式 (用於 MapLibre setLayoutProperty)
    CHINESE_LABEL_EXPRESSION: [
        'coalesce',
        ['get', 'name:zh-Hant'],  // 1. 繁體中文
        ['get', 'name:zh'],        // 2. 簡體中文
        ['get', 'name:latin'],     // 3. 拉丁字母
        ['get', 'name']            // 4. 當地語系 (最終回退)
    ] as const,

    // POI 名稱優先級順序
    CHINESE_NAME_KEYS: ['name:zh-Hant', 'name:zh', 'name', 'name_en'] as const,
}
