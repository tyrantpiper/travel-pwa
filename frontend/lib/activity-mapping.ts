// 📍 frontend/lib/activity-mapping.ts
// Global Destination Curated Activities & Itinerary Spot Resolver
// Serves Klook & KKday deep linking and interactive accordions

import type { TripActivityItem } from './affiliate-config'

export interface PresetActivityDef {
  name: { zh: string; en: string }
  category: 'ticket' | 'tour' | 'pass' | 'spot'
}

/**
 * Curated high-conversion activities & tickets for major global travel destinations.
 * Keys are lowercase and normalized.
 */
export const DESTINATION_POPULAR_ACTIVITIES: Record<string, PresetActivityDef[]> = {
  // ===== 義大利 (Italy) =====
  '義大利': [
    { name: { zh: '羅馬競技場免排隊門票', en: 'Colosseum Skip-the-Line Ticket' }, category: 'ticket' },
    { name: { zh: '梵蒂岡博物館與西斯汀禮拜堂', en: 'Vatican Museums & Sistine Chapel' }, category: 'ticket' },
    { name: { zh: '米蘭大教堂登頂露台門票', en: 'Milan Duomo Rooftop Ticket' }, category: 'ticket' },
    { name: { zh: '佛羅倫斯聖母百花大教堂', en: 'Florence Duomo Cathedral' }, category: 'ticket' },
    { name: { zh: '威尼斯貢多拉遊船體驗', en: 'Venice Traditional Gondola Ride' }, category: 'tour' },
    { name: { zh: '龐貝古城與阿瑪菲海岸一日遊', en: 'Pompeii & Amalfi Coast Day Tour' }, category: 'tour' },
  ],
  '羅馬': [
    { name: { zh: '羅馬競技場免排隊門票', en: 'Colosseum Skip-the-Line Ticket' }, category: 'ticket' },
    { name: { zh: '梵蒂岡博物館與西斯汀禮拜堂', en: 'Vatican Museums & Sistine Chapel' }, category: 'ticket' },
    { name: { zh: '聖天使城堡門票', en: 'Castel Sant\'Angelo Ticket' }, category: 'ticket' },
    { name: { zh: '羅馬羅馬競技場與古羅馬廣場導覽', en: 'Colosseum & Roman Forum Guided Tour' }, category: 'tour' },
    { name: { zh: '羅馬市區隨上隨下觀光巴士', en: 'Rome Hop-On Hop-Off Bus Pass' }, category: 'pass' },
  ],
  '米蘭': [
    { name: { zh: '米蘭大教堂登頂露台門票', en: 'Milan Duomo Rooftop Ticket' }, category: 'ticket' },
    { name: { zh: '最後的晚餐達文西真跡導覽', en: 'The Last Supper Guided Tour' }, category: 'tour' },
    { name: { zh: '柯莫湖與貝拉焦一日遊', en: 'Lake Como & Bellagio Day Tour' }, category: 'tour' },
    { name: { zh: '聖西羅球場參觀門票', en: 'San Siro Stadium Tour' }, category: 'ticket' },
  ],
  '威尼斯': [
    { name: { zh: '威尼斯貢多拉遊船體驗', en: 'Venice Traditional Gondola Ride' }, category: 'tour' },
    { name: { zh: '威尼斯總督宮快速通關門票', en: 'Doge\'s Palace Priority Ticket' }, category: 'ticket' },
    { name: { zh: '彩色島與玻璃島半日遊', en: 'Murano & Burano Islands Tour' }, category: 'tour' },
    { name: { zh: '威尼斯水上巴士 ACTV 通行證', en: 'Venice ACTV Water Bus Pass' }, category: 'pass' },
  ],
  '佛羅倫斯': [
    { name: { zh: '聖母百花大教堂登頂門票', en: 'Florence Duomo Dome Climb Ticket' }, category: 'ticket' },
    { name: { zh: '烏菲茲美術館免排隊門票', en: 'Uffizi Gallery Priority Ticket' }, category: 'ticket' },
    { name: { zh: '托斯卡尼酒莊與西恩納一日遊', en: 'Tuscany Vineyards & Siena Tour' }, category: 'tour' },
    { name: { zh: '比薩斜塔登頂免排隊門票', en: 'Leaning Tower of Pisa Ticket' }, category: 'ticket' },
  ],

  // ===== 日本 (Japan) =====
  '日本': [
    { name: { zh: 'SHIBUYA SKY 展望台門票', en: 'SHIBUYA SKY Observation Deck Ticket' }, category: 'ticket' },
    { name: { zh: '東京華納兄弟哈利波特影城', en: 'Warner Bros. Studio Tour Tokyo' }, category: 'ticket' },
    { name: { zh: '日本環球影城門票 (USJ)', en: 'Universal Studios Japan (USJ) Ticket' }, category: 'ticket' },
    { name: { zh: '富士山與河口湖一日遊', en: 'Mt. Fuji & Lake Kawaguchi Day Tour' }, category: 'tour' },
    { name: { zh: 'JR Pass 全日本鐵路周遊券', en: 'JR Pass Whole Japan Rail Pass' }, category: 'pass' },
    { name: { zh: '關西周遊卡 / 關西鐵路卡', en: 'Kansai Railway Pass' }, category: 'pass' },
  ],
  '東京': [
    { name: { zh: 'SHIBUYA SKY 展望台門票', en: 'SHIBUYA SKY Observation Deck Ticket' }, category: 'ticket' },
    { name: { zh: '東京華納兄弟哈利波特影城', en: 'Warner Bros. Studio Tour Tokyo' }, category: 'ticket' },
    { name: { zh: '東京迪士尼樂園 / 海洋門票', en: 'Tokyo Disneyland / DisneySea Ticket' }, category: 'ticket' },
    { name: { zh: 'teamLab Planets TOKYO 展覽門票', en: 'teamLab Planets TOKYO Ticket' }, category: 'ticket' },
    { name: { zh: '東京地鐵乘車券 (24/48/72小時)', en: 'Tokyo Subway 24/48/72-hr Ticket' }, category: 'pass' },
    { name: { zh: '富士山一日遊經典行程', en: 'Mt. Fuji Classic Day Tour' }, category: 'tour' },
  ],
  '大阪': [
    { name: { zh: '日本環球影城門票 (USJ)', en: 'Universal Studios Japan (USJ) Ticket' }, category: 'ticket' },
    { name: { zh: '日本環球影城快速通關券 Express Pass', en: 'USJ Universal Express Pass' }, category: 'pass' },
    { name: { zh: '大阪周遊卡 (Osaka Amazing Pass)', en: 'Osaka Amazing Pass' }, category: 'pass' },
    { name: { zh: '阿倍野 HARUKAS 300 展望台門票', en: 'HARUKAS 300 Observatory Ticket' }, category: 'ticket' },
    { name: { zh: '關西機場快線 HARUKA 車票', en: 'Kansai Airport Express HARUKA Ticket' }, category: 'pass' },
  ],
  '京都': [
    { name: { zh: '京都和服體驗 (清水寺/祇園)', en: 'Kyoto Kimono Rental Experience' }, category: 'tour' },
    { name: { zh: '嵐山嵯峨野小火車車票', en: 'Sagano Romantic Train Ticket' }, category: 'ticket' },
    { name: { zh: '伏見稻荷大社與清水寺半日遊', en: 'Fushimi Inari & Kiyomizu-dera Tour' }, category: 'tour' },
    { name: { zh: '金閣寺與二條城門票導覽', en: 'Kinkaku-ji & Nijo Castle Tour' }, category: 'ticket' },
  ],
  '沖繩': [
    { name: { zh: '沖繩美麗海水族館門票', en: 'Okinawa Churaumi Aquarium Ticket' }, category: 'ticket' },
    { name: { zh: '青之洞窟浮潛與潛水體驗', en: 'Blue Cave Snorkeling & Diving Experience' }, category: 'tour' },
    { name: { zh: '沖繩中北部一日遊巴士行程', en: 'Okinawa Hip-Hop Bus 1-Day Tour' }, category: 'tour' },
  ],
  '北海道': [
    { name: { zh: '旭山動物園與美瑛青池一日遊', en: 'Asahiyama Zoo & Blue Pond Day Tour' }, category: 'tour' },
    { name: { zh: '小樽運河與天狗山纜車套票', en: 'Otaru Canal & Mt. Tengu Ropeway' }, category: 'ticket' },
    { name: { zh: 'JR 北海道鐵路周遊券', en: 'JR Hokkaido Rail Pass' }, category: 'pass' },
  ],
  '福岡': [
    { name: { zh: '福岡塔展望台入場券', en: 'Fukuoka Tower Observatory Ticket' }, category: 'ticket' },
    { name: { zh: '太宰府天滿宮與由布院一日遊', en: 'Dazaifu Tenmangu & Yufuin Day Tour' }, category: 'tour' },
    { name: { zh: 'JR九州鐵路周遊券', en: 'JR Kyushu Rail Pass' }, category: 'pass' },
  ],

  // ===== 韓國 (South Korea) =====
  '韓國': [
    { name: { zh: '首爾樂天世界門票', en: 'Lotte World Seoul Ticket' }, category: 'ticket' },
    { name: { zh: '愛寶樂園門票 Everland', en: 'Everland Theme Park Ticket' }, category: 'ticket' },
    { name: { zh: '南怡島與小法國村一日遊', en: 'Nami Island & Petite France Day Tour' }, category: 'tour' },
    { name: { zh: '首爾景福宮傳統韓服租借', en: 'Gyeongbokgung Hanbok Rental' }, category: 'tour' },
    { name: { zh: 'AREX 仁川機場快線直達車票', en: 'AREX Incheon Airport Express Ticket' }, category: 'pass' },
  ],
  '首爾': [
    { name: { zh: '首爾樂天世界門票', en: 'Lotte World Seoul Ticket' }, category: 'ticket' },
    { name: { zh: 'N首爾塔展望台門票', en: 'N Seoul Tower Observatory Ticket' }, category: 'ticket' },
    { name: { zh: '景福宮韓服體驗', en: 'Gyeongbokgung Hanbok Experience' }, category: 'tour' },
    { name: { zh: '南怡島與羊駝牧場一日遊', en: 'Nami Island & Alpaca World Day Tour' }, category: 'tour' },
    { name: { zh: 'AREX 機場快線車票', en: 'AREX Airport Express Ticket' }, category: 'pass' },
  ],
  '釜山': [
    { name: { zh: '釜山 X the SKY 展望台門票', en: 'Busan X the SKY Observatory Ticket' }, category: 'ticket' },
    { name: { zh: '海雲台海邊小火車車票', en: 'Haeundae Blueline Park Beach Train' }, category: 'ticket' },
    { name: { zh: '釜山通行證 Visit Busan Pass', en: 'Visit Busan Pass' }, category: 'pass' },
  ],

  // ===== 法國 (France) =====
  '法國': [
    { name: { zh: '巴黎羅浮宮免排隊門票', en: 'Louvre Museum Priority Access Ticket' }, category: 'ticket' },
    { name: { zh: '凡爾賽宮與花園全票', en: 'Palace of Versailles & Gardens Ticket' }, category: 'ticket' },
    { name: { zh: '巴黎艾菲爾鐵塔登頂門票', en: 'Eiffel Tower Summit Access Ticket' }, category: 'ticket' },
    { name: { zh: '塞納河觀光遊船船票', en: 'Seine River Sightseeing Cruise Ticket' }, category: 'tour' },
    { name: { zh: '巴黎迪士尼樂園門票', en: 'Disneyland Paris 1-Day Ticket' }, category: 'ticket' },
  ],
  '巴黎': [
    { name: { zh: '羅浮宮免排隊門票', en: 'Louvre Museum Priority Access Ticket' }, category: 'ticket' },
    { name: { zh: '凡爾賽宮與花園全票', en: 'Palace of Versailles & Gardens Ticket' }, category: 'ticket' },
    { name: { zh: '艾菲爾鐵塔登頂門票', en: 'Eiffel Tower Summit Access Ticket' }, category: 'ticket' },
    { name: { zh: '塞納河觀光遊船船票', en: 'Seine River Sightseeing Cruise Ticket' }, category: 'tour' },
    { name: { zh: '巴黎博物館通行證 Museum Pass', en: 'Paris Museum Pass' }, category: 'pass' },
  ],

  // ===== 英國 (United Kingdom) =====
  '英國': [
    { name: { zh: '倫敦眼摩天輪標準門票', en: 'London Eye Standard Ticket' }, category: 'ticket' },
    { name: { zh: '倫敦華納兄弟哈利波特片場', en: 'Warner Bros. Studio Tour London' }, category: 'ticket' },
    { name: { zh: '巨石陣與巴斯一日遊', en: 'Stonehenge & Bath Day Tour' }, category: 'tour' },
    { name: { zh: '倫敦塔門票 (含珍寶館)', en: 'Tower of London Ticket with Crown Jewels' }, category: 'ticket' },
    { name: { zh: '西敏寺門票與語音導覽', en: 'Westminster Abbey Ticket & Audio Guide' }, category: 'ticket' },
  ],
  '倫敦': [
    { name: { zh: '倫敦眼摩天輪門票', en: 'London Eye Standard Ticket' }, category: 'ticket' },
    { name: { zh: '華納兄弟哈利波特片場門票含接駁', en: 'Harry Potter Studio Tour with Transfer' }, category: 'ticket' },
    { name: { zh: '巨石陣與溫莎城堡一日遊', en: 'Stonehenge & Windsor Castle Day Tour' }, category: 'tour' },
    { name: { zh: '倫敦探索者通行證 Go City Pass', en: 'London Explorer Pass by Go City' }, category: 'pass' },
  ],

  // ===== 泰國 (Thailand) =====
  '泰國': [
    { name: { zh: '曼谷大皇宮與玉佛寺半日導覽', en: 'Grand Palace & Emerald Buddha Tour' }, category: 'tour' },
    { name: { zh: '美功鐵道市場與安帕瓦水上市場', en: 'Maeklong Railway & Amphawa Floating Market' }, category: 'tour' },
    { name: { zh: '曼谷昭披耶公主號豪華遊船晚宴', en: 'Chao Phraya Princess Dinner Cruise' }, category: 'tour' },
    { name: { zh: '清邁大象自然公園保護區體驗', en: 'Chiang Mai Elephant Nature Park' }, category: 'tour' },
    { name: { zh: '普吉島皮皮島與瑪雅灣快艇一日遊', en: 'Phi Phi & Maya Bay Speedboat Tour' }, category: 'tour' },
  ],
  '曼谷': [
    { name: { zh: '大皇宮與玉佛寺半日導覽', en: 'Grand Palace & Emerald Buddha Tour' }, category: 'tour' },
    { name: { zh: '水上市場與鐵道市場一日遊', en: 'Damnoen Saduak & Maeklong Market Tour' }, category: 'tour' },
    { name: { zh: '昭披耶河豪華自助晚宴遊船', en: 'Chao Phraya River Buffet Dinner Cruise' }, category: 'tour' },
    { name: { zh: '曼谷王權 Mahanakhon SkyWalk 觀景台', en: 'Mahanakhon SkyWalk Ticket' }, category: 'ticket' },
  ],

  // ===== 越南 (Vietnam) =====
  '越南': [
    { name: { zh: '峴港巴拿山太陽世界門票含纜車', en: 'Ba Na Hills Sun World Ticket & Cable Car' }, category: 'ticket' },
    { name: { zh: '河內下龍灣頂級遊船一日遊', en: 'Halong Bay Luxury Day Cruise Tour' }, category: 'tour' },
    { name: { zh: '會安古鎮漫步與手作水燈體驗', en: 'Hoi An Ancient Town Walking Tour' }, category: 'tour' },
  ],

  // ===== 台灣 (Taiwan) =====
  '台灣': [
    { name: { zh: '台北 101 觀景台門票', en: 'Taipei 101 Observatory Ticket' }, category: 'ticket' },
    { name: { zh: '國立故宮博物院門票', en: 'National Palace Museum Ticket' }, category: 'ticket' },
    { name: { zh: '九份、十分與野柳地質公園一日遊', en: 'Jiufen, Shifen & Yehliu Day Tour' }, category: 'tour' },
    { name: { zh: '台灣高鐵單程乘車券 (外國人限定 8 折)', en: 'THSR One-Way Ticket (20% Off)' }, category: 'pass' },
  ],

  // ===== 美國 (USA) =====
  '美國': [
    { name: { zh: '紐約帝國大廈觀景台門票', en: 'Empire State Building Observatory Ticket' }, category: 'ticket' },
    { name: { zh: '加州好萊塢環球影城門票', en: 'Universal Studios Hollywood Ticket' }, category: 'ticket' },
    { name: { zh: '大峽谷南緣一日遊 (拉斯維加斯出發)', en: 'Grand Canyon South Rim Day Tour from Las Vegas' }, category: 'tour' },
    { name: { zh: '舊金山惡魔島遊船與舊金山大橋', en: 'Alcatraz Island & Golden Gate Cruise' }, category: 'tour' },
  ],

  // ===== 新加坡 (Singapore) =====
  '新加坡': [
    { name: { zh: '新加坡濱海灣花園門票 (花穹與雲霧林)', en: 'Gardens by the Bay Ticket (Flower Dome & Cloud Forest)' }, category: 'ticket' },
    { name: { zh: '新加坡環球影城門票 (USS)', en: 'Universal Studios Singapore (USS) Ticket' }, category: 'ticket' },
    { name: { zh: '新加坡夜間野生動物園門票含遊園車', en: 'Night Safari Ticket with Tram Ride' }, category: 'ticket' },
  ],
}

/**
 * Normalizes destination query string for fuzzy dictionary lookup.
 */
function normalizeDestinationKey(dest?: string): string {
  if (!dest) return ''
  return dest.toLowerCase().trim()
}

/**
 * Finds preset activities by searching destination substrings.
 */
export function findPresetActivities(destination?: string): PresetActivityDef[] {
  if (!destination) return []
  const norm = normalizeDestinationKey(destination)

  // 1. Exact match
  if (DESTINATION_POPULAR_ACTIVITIES[norm]) {
    return DESTINATION_POPULAR_ACTIVITIES[norm]
  }

  // 2. Contains match (e.g. "義大利羅馬自由行" -> matches "羅馬" or "義大利")
  for (const [key, activities] of Object.entries(DESTINATION_POPULAR_ACTIVITIES)) {
    const normKey = key.toLowerCase()
    if (norm.includes(normKey) || normKey.includes(norm)) {
      return activities
    }
  }

  return []
}

/**
 * 🛡️ 雙軌智慧融合活動解析器 (Hybrid 2-Tier Activity Resolver)
 * 1. 優先層：提取行程內景點 (itinerarySpots)，標註 source: 'itinerary'
 * 2. 補位層：目的地精選熱門票券 (Preset Dictionary)，標註 source: 'preset'
 * 3. 確保無重複、長度上限 6 項，並保證絕對不留白。
 */
export function resolveRecommendedActivities(
  destination?: string,
  itinerarySpots?: string[],
  lang: 'zh' | 'en' = 'zh'
): TripActivityItem[] {
  const result: TripActivityItem[] = []
  const seenNames = new Set<string>()

  // 1. 優先層：萃取當前行程景點 (最多 4 項，保留使用者個人化景點)
  if (Array.isArray(itinerarySpots)) {
    for (const spot of itinerarySpots) {
      if (!spot || typeof spot !== 'string') continue
      const cleanSpot = spot.trim()
      if (cleanSpot.length < 2) continue
      const lower = cleanSpot.toLowerCase()
      if (!seenNames.has(lower)) {
        seenNames.add(lower)
        result.push({
          name: cleanSpot,
          category: 'spot',
          source: 'itinerary',
          city: destination,
        })
      }
      if (result.length >= 4) break
    }
  }

  // 2. 補位層：依目的地精選字典補足至 5~6 項
  const presets = findPresetActivities(destination)
  for (const preset of presets) {
    const presetName = lang === 'en' ? preset.name.en : preset.name.zh
    const lower = presetName.toLowerCase()
    // 檢查是否已存在類似項目 (例如行程已有「羅馬競技場」，字典的「羅馬競技場免排隊門票」應避免重複)
    const isDuplicate = Array.from(seenNames).some(
      seen => lower.includes(seen) || seen.includes(lower)
    )

    if (!isDuplicate && !seenNames.has(lower)) {
      seenNames.add(lower)
      result.push({
        name: presetName,
        category: preset.category,
        source: 'preset',
        city: destination,
      })
    }

    if (result.length >= 6) break
  }

  // 3. 保底層：若結果仍為空 (如無行程景點且為未錄入小城市)
  if (result.length === 0) {
    const fallbackBase = destination ? destination.trim() : (lang === 'zh' ? '當地' : 'Local')
    result.push(
      {
        name: lang === 'zh' ? `${fallbackBase}熱門景點門票` : `${fallbackBase} Top Attractions`,
        category: 'ticket',
        source: 'preset',
        city: destination,
      },
      {
        name: lang === 'zh' ? `${fallbackBase}經典一日遊體驗` : `${fallbackBase} Classic Day Tour`,
        category: 'tour',
        source: 'preset',
        city: destination,
      },
      {
        name: lang === 'zh' ? `${fallbackBase}交通觀光通行證` : `${fallbackBase} Sightseeing Pass`,
        category: 'pass',
        source: 'preset',
        city: destination,
      }
    )
  }

  return result
}

// ============================================================
// ===== TRANSPORT ROUTES (Kiwitaxi + Welcome + 12Go) =====
// ============================================================

export interface TransportRouteItem {
  id: string
  name: { zh: string; en: string }
  origin: string
  destination: string
  type: 'airport_transfer' | 'intercity_train' | 'ferry'
  badge?: { zh: string; en: string }
  duration?: string
}

export const DESTINATION_TRANSPORT_ROUTES: Record<string, TransportRouteItem[]> = {
  // ===== 義大利 (Italy) =====
  '義大利': [
    {
      id: 'it-fco-rome',
      name: { zh: '羅馬菲烏米奇諾機場 (FCO) ⇄ 羅馬特米尼中央車站 / 市中心', en: 'Rome FCO Airport ⇄ Rome Termini / City Centre' },
      origin: 'Rome Fiumicino Airport (FCO)',
      destination: 'Rome City Centre',
      type: 'airport_transfer',
      badge: { zh: '機場接送', en: 'Airport Transfer' },
      duration: '40-50 min',
    },
    {
      id: 'it-cia-rome',
      name: { zh: '羅馬錢皮諾機場 (CIA) ⇄ 羅馬市中心', en: 'Rome Ciampino Airport (CIA) ⇄ Rome City Centre' },
      origin: 'Rome Ciampino Airport (CIA)',
      destination: 'Rome City Centre',
      type: 'airport_transfer',
      badge: { zh: '機場接送', en: 'Airport Transfer' },
      duration: '35 min',
    },
    {
      id: 'it-mxp-milan',
      name: { zh: '米蘭馬爾彭薩機場 (MXP) ⇄ 米蘭中央車站 / 市區', en: 'Milan Malpensa Airport (MXP) ⇄ Milano Centrale' },
      origin: 'Milan Malpensa Airport (MXP)',
      destination: 'Milan City Centre',
      type: 'airport_transfer',
      badge: { zh: '機場接送', en: 'Airport Transfer' },
      duration: '45-55 min',
    },
    {
      id: 'it-vce-venice',
      name: { zh: '威尼斯馬可波羅機場 (VCE) ⇄ 威尼斯羅馬廣場 / 水上專車', en: 'Venice Marco Polo Airport (VCE) ⇄ Piazzale Roma / Water Taxi' },
      origin: 'Venice Marco Polo Airport (VCE)',
      destination: 'Venice Piazzale Roma',
      type: 'airport_transfer',
      badge: { zh: '水陸接駁', en: 'Transfer' },
      duration: '25 min',
    },
    {
      id: 'it-rome-florence',
      name: { zh: '羅馬特米尼 ⇄ 佛羅倫斯 SMN (義大利國鐵 Frecciarossa 高鐵)', en: 'Rome Termini ⇄ Florence SMN (Frecciarossa High-Speed Train)' },
      origin: 'Rome Termini',
      destination: 'Florence Santa Maria Novella',
      type: 'intercity_train',
      badge: { zh: '跨城高鐵', en: 'Fast Train' },
      duration: '1h 36m',
    },
  ],
  '羅馬': [
    {
      id: 'rome-fco-city',
      name: { zh: '羅馬菲烏米奇諾機場 (FCO) ⇄ 羅馬市區飯店 (專車舉牌迎接)', en: 'Rome FCO Airport ⇄ Rome Hotels (Meet & Greet)' },
      origin: 'Rome Fiumicino Airport (FCO)',
      destination: 'Rome City Centre',
      type: 'airport_transfer',
      badge: { zh: '舉牌專車', en: 'Meet & Greet' },
      duration: '45 min',
    },
    {
      id: 'rome-cia-city',
      name: { zh: '羅馬錢皮諾機場 (CIA) ⇄ 羅馬特米尼車站', en: 'Rome Ciampino Airport (CIA) ⇄ Roma Termini' },
      origin: 'Rome Ciampino Airport (CIA)',
      destination: 'Roma Termini',
      type: 'airport_transfer',
      badge: { zh: '專車接送', en: 'Transfer' },
      duration: '35 min',
    },
    {
      id: 'rome-train-florence',
      name: { zh: '羅馬 ⇄ 佛羅倫斯 (義鐵高鐵特快車)', en: 'Rome ⇄ Florence (Trenitalia Frecciarossa)' },
      origin: 'Roma Termini',
      destination: 'Firenze Santa Maria Novella',
      type: 'intercity_train',
      badge: { zh: '城際高鐵', en: 'High-Speed' },
      duration: '1h 36m',
    },
  ],
  '米蘭': [
    {
      id: 'milan-mxp-city',
      name: { zh: '米蘭馬爾彭薩機場 (MXP) ⇄ 米蘭中央車站 / 市中心', en: 'Milan Malpensa Airport (MXP) ⇄ Milano Centrale' },
      origin: 'Milan Malpensa Airport (MXP)',
      destination: 'Milan City Centre',
      type: 'airport_transfer',
      badge: { zh: '機場接送', en: 'Airport Transfer' },
      duration: '50 min',
    },
    {
      id: 'milan-lin-city',
      name: { zh: '米蘭利納特機場 (LIN) ⇄ 米蘭市中心', en: 'Milan Linate Airport (LIN) ⇄ Milan Duomo' },
      origin: 'Milan Linate Airport (LIN)',
      destination: 'Milan City Centre',
      type: 'airport_transfer',
      badge: { zh: '專車接送', en: 'Transfer' },
      duration: '25 min',
    },
  ],
  // ===== 日本 (Japan) =====
  '日本': [
    {
      id: 'jp-nrt-tokyo',
      name: { zh: '成田機場 (NRT) ⇄ 東京車站 / 新宿 (Skyliner / 專車接送)', en: 'Narita Airport (NRT) ⇄ Tokyo Station / Shinjuku' },
      origin: 'Narita International Airport (NRT)',
      destination: 'Tokyo Station',
      type: 'airport_transfer',
      badge: { zh: '機場接送', en: 'Airport Transfer' },
      duration: '50-60 min',
    },
    {
      id: 'jp-hnd-tokyo',
      name: { zh: '羽田機場 (HND) ⇄ 東京市區飯店 (專車舉牌迎接)', en: 'Haneda Airport (HND) ⇄ Tokyo Hotels' },
      origin: 'Haneda Airport (HND)',
      destination: 'Tokyo Shinjuku / Shibuya',
      type: 'airport_transfer',
      badge: { zh: '市區專車', en: 'Transfer' },
      duration: '30 min',
    },
    {
      id: 'jp-kix-osaka',
      name: { zh: '關西國際機場 (KIX) ⇄ 難波 / 梅田 / 京都 (Haruka / 專車)', en: 'Kansai Airport (KIX) ⇄ Namba / Osaka Umeda / Kyoto' },
      origin: 'Kansai International Airport (KIX)',
      destination: 'Osaka Namba',
      type: 'airport_transfer',
      badge: { zh: '關西接駁', en: 'Transfer' },
      duration: '45-60 min',
    },
    {
      id: 'jp-tokyo-kyoto',
      name: { zh: '東京車站 ⇄ 京都車站 (東海道新幹線 Nozomi / 12Go)', en: 'Tokyo Station ⇄ Kyoto Station (Tokaido Shinkansen)' },
      origin: 'Tokyo',
      destination: 'Kyoto',
      type: 'intercity_train',
      badge: { zh: '新幹線', en: 'Bullet Train' },
      duration: '2h 15m',
    },
  ],
  // ===== 泰國 (Thailand) =====
  '泰國': [
    {
      id: 'th-bkk-city',
      name: { zh: '曼谷蘇凡納布機場 (BKK) ⇄ 曼谷市中心飯店專車', en: 'Bangkok Suvarnabhumi (BKK) ⇄ Bangkok City Hotels' },
      origin: 'Bangkok Suvarnabhumi Airport (BKK)',
      destination: 'Bangkok City Centre',
      type: 'airport_transfer',
      badge: { zh: '舉牌專車', en: 'Meet & Greet' },
      duration: '40 min',
    },
    {
      id: 'th-dmk-city',
      name: { zh: '曼谷廊曼機場 (DMK) ⇄ 曼谷市區接送', en: 'Don Mueang Airport (DMK) ⇄ Bangkok Hotels' },
      origin: 'Don Mueang Airport (DMK)',
      destination: 'Bangkok City Centre',
      type: 'airport_transfer',
      badge: { zh: '機場接送', en: 'Transfer' },
      duration: '35 min',
    },
    {
      id: 'th-bkk-chiangmai',
      name: { zh: '曼谷 ⇄ 清邁 (12Go 豪華臥鋪夜車 / VIP巴士)', en: 'Bangkok ⇄ Chiang Mai (12Go Sleeper Train / VIP Bus)' },
      origin: 'Bangkok',
      destination: 'Chiang Mai',
      type: 'intercity_train',
      badge: { zh: '跨城夜車', en: 'Sleeper Train' },
      duration: '11h',
    },
    {
      id: 'th-bkk-pattaya',
      name: { zh: '曼谷市區 / 機場 ⇄ 芭達雅 (包車直達)', en: 'Bangkok ⇄ Pattaya Private Transfer' },
      origin: 'Bangkok',
      destination: 'Pattaya',
      type: 'airport_transfer',
      badge: { zh: '熱門包車', en: 'Charter' },
      duration: '1h 50m',
    },
  ],
}

/**
 * 取得指定目的地的推薦接駁與交通路線
 */
export function getDestinationTransportRoutes(destination?: string, arrivalAirport?: string): TransportRouteItem[] {
  if (!destination) {
    return [
      {
        id: 'default-airport-transfer',
        name: { zh: '機場 ⇄ 市中心飯店 (專人舉牌接駁專車)', en: 'Airport ⇄ Hotel Transfer (Meet & Greet)' },
        origin: arrivalAirport || 'Airport',
        destination: 'City Centre Hotel',
        type: 'airport_transfer',
        badge: { zh: '機場接送', en: 'Airport Transfer' },
        duration: '35-50 min',
      },
    ]
  }

  const clean = destination.trim().toLowerCase()
  for (const [key, routes] of Object.entries(DESTINATION_TRANSPORT_ROUTES)) {
    if (clean.includes(key.toLowerCase()) || key.toLowerCase().includes(clean)) {
      return routes
    }
  }

  // 若無直接對照，依抵達機場動態生成高品質路線
  const airportLabel = arrivalAirport ? `${arrivalAirport} 機場` : `${destination} 當地機場`
  const airportLabelEn = arrivalAirport ? `${arrivalAirport} Airport` : `${destination} Airport`
  return [
    {
      id: `dyn-transfer-1`,
      name: {
        zh: `${airportLabel} ⇄ ${destination} 市中心飯店 (專車直達)`,
        en: `${airportLabelEn} ⇄ ${destination} City Centre Hotel`,
      },
      origin: arrivalAirport || `${destination} Airport`,
      destination: `${destination} City Centre`,
      type: 'airport_transfer',
      badge: { zh: '機場接送', en: 'Airport Transfer' },
      duration: '40 min',
    },
    {
      id: `dyn-transfer-2`,
      name: {
        zh: `${destination} ⇄ 鄰近熱門城市 (跨城火車 / 專車接送)`,
        en: `${destination} ⇄ Nearby City Transfer / Train`,
      },
      origin: `${destination}`,
      destination: `${destination} Region`,
      type: 'intercity_train',
      badge: { zh: '跨城交通', en: 'Intercity' },
      duration: '1-2h',
    },
  ]
}

// ============================================================
// ===== 亞洲地理判斷 (12Go Asia 智慧過濾) =====
// ============================================================

const ASIA_COUNTRY_CODES = new Set([
  'JP', 'TH', 'VN', 'TW', 'MY', 'SG', 'ID', 'PH', 'KR', 'CN', 'HK', 'MO', 'KH', 'LA', 'MM', 'IN', 'NP', 'LK'
])

const ASIA_KEYWORDS = [
  '日本', '東京', '大阪', '京都', '北海道', '沖繩', '福岡', '名古屋',
  '泰國', '曼谷', '清邁', '普吉島', '芭達雅',
  '越南', '河內', '峴港', '胡志明', '會安',
  '馬來西亞', '吉隆坡', '檳城', '沙巴',
  '新加坡', '印尼', '峇里島', '雅加達',
  '菲律賓', '宿霧', '長灘島', '馬尼拉',
  '韓國', '首爾', '釜山', '濟州島',
  '台灣', '台北', '台中', '高雄', '台南',
  '香港', '澳門', '中國', '北京', '上海',
  'Japan', 'Tokyo', 'Osaka', 'Kyoto', 'Thailand', 'Bangkok', 'Phuket',
  'Vietnam', 'Hanoi', 'Danang', 'Malaysia', 'Singapore', 'Indonesia', 'Bali',
  'Philippines', 'Korea', 'Seoul', 'Taiwan', 'Taipei', 'Hong Kong'
]

/**
 * 判斷當前行程是否為亞洲目的地 (供 12Go Asia 等亞洲專精服務智慧過濾)
 */
export function isAsianTrip(ctx?: { destination?: string; countryCode?: string } | null): boolean {
  if (!ctx) return false
  if (ctx.countryCode && ASIA_COUNTRY_CODES.has(ctx.countryCode.toUpperCase())) {
    return true
  }
  if (ctx.destination) {
    const dest = ctx.destination.toLowerCase()
    return ASIA_KEYWORDS.some(keyword => dest.includes(keyword.toLowerCase()))
  }
  return false
}

