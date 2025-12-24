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
