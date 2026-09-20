// 📍 frontend/lib/airport-mapping.ts
// Intelligent destination to IATA airport inference, Global Multi-Hubs & Airline dictionary

export interface AirportHub {
  code: string
  labelZh: string
  labelEn: string
}

/**
 * Common tourist destinations & countries to primary international airport IATA codes
 */
const DESTINATION_AIRPORT_MAP: Record<string, string> = {
  // === Italy & Western/Southern Europe ===
  '義大利': 'FCO', 'italy': 'FCO', 'italia': 'FCO',
  '羅馬': 'FCO', 'rome': 'FCO', 'roma': 'FCO',
  '米蘭': 'MXP', 'milan': 'MXP', 'milano': 'MXP',
  '威尼斯': 'VCE', 'venice': 'VCE', 'venezia': 'VCE',
  '佛羅倫斯': 'FLR', 'florence': 'FLR', 'firenze': 'FLR',
  '波隆那': 'BLQ', 'bologna': 'BLQ',
  '拿坡里': 'NAP', '那不勒斯': 'NAP', 'napoli': 'NAP', 'naples': 'NAP',
  '西西里': 'CTA', 'sicily': 'CTA', '卡塔尼亞': 'CTA',
  '比薩': 'PSA', 'pisa': 'PSA',
  '瑞士': 'ZRH', 'switzerland': 'ZRH', '蘇黎世': 'ZRH', 'zurich': 'ZRH',
  '日內瓦': 'GVA', 'geneva': 'GVA',
  '法國': 'CDG', 'france': 'CDG', '巴黎': 'CDG', 'paris': 'CDG',
  '尼斯': 'NCE', 'nice': 'NCE', '里昂': 'LYS', 'lyon': 'LYS',
  '英國': 'LHR', 'uk': 'LHR', 'united kingdom': 'LHR', '大不列顛': 'LHR',
  '倫敦': 'LHR', 'london': 'LHR', '曼徹斯特': 'MAN', 'manchester': 'MAN',
  '愛丁堡': 'EDI', 'edinburgh': 'EDI',
  '西班牙': 'MAD', 'spain': 'MAD', 'españa': 'MAD',
  '馬德里': 'MAD', 'madrid': 'MAD',
  '巴塞隆納': 'BCN', 'barcelona': 'BCN',
  '塞維亞': 'SVQ', 'seville': 'SVQ',
  '德國': 'FRA', 'germany': 'FRA', 'deutschland': 'FRA',
  '法蘭克福': 'FRA', 'frankfurt': 'FRA', '慕尼黑': 'MUC', 'munich': 'MUC',
  '柏林': 'BER', 'berlin': 'BER',
  '荷蘭': 'AMS', 'netherlands': 'AMS', '阿姆斯特丹': 'AMS', 'amsterdam': 'AMS',
  '比利時': 'BRU', 'belgium': 'BRU', '布魯塞爾': 'BRU', 'brussels': 'BRU',
  '奧地利': 'VIE', 'austria': 'VIE', '維也納': 'VIE', 'vienna': 'VIE',
  '葡萄牙': 'LIS', 'portugal': 'LIS', '里斯本': 'LIS', 'lisbon': 'LIS',
  '波多': 'OPO', 'porto': 'OPO',
  '希臘': 'ATH', 'greece': 'ATH', '雅典': 'ATH', 'athens': 'ATH',
  '聖托里尼': 'JTR', 'santorini': 'JTR', '米克諾斯': 'JMK', 'mykonos': 'JMK',
  '捷克': 'PRG', 'czech': 'PRG', '布拉格': 'PRG', 'prague': 'PRG',
  '匈牙利': 'BUD', 'hungary': 'BUD', '布達佩斯': 'BUD', 'budapest': 'BUD',
  '波蘭': 'WAW', 'poland': 'WAW', '華沙': 'WAW', 'warsaw': 'WAW',
  '冰島': 'KEF', 'iceland': 'KEF', '雷克雅維克': 'KEF', 'reykjavik': 'KEF',
  '挪威': 'OSL', 'norway': 'OSL', '奧斯陸': 'OSL', 'oslo': 'OSL',
  '瑞典': 'ARN', 'sweden': 'ARN', '斯德哥爾摩': 'ARN', 'stockholm': 'ARN',
  '丹麥': 'CPH', 'denmark': 'CPH', '哥本哈根': 'CPH', 'copenhagen': 'CPH',
  '芬蘭': 'HEL', 'finland': 'HEL', '赫爾辛基': 'HEL', 'helsinki': 'HEL',
  '愛爾蘭': 'DUB', 'ireland': 'DUB', '都柏林': 'DUB', 'dublin': 'DUB',
  '克羅埃西亞': 'ZAG', 'croatia': 'ZAG', '杜布羅夫尼克': 'DBV', 'dubrovnik': 'DBV',

  // === Japan ===
  '日本': 'NRT', 'japan': 'NRT',
  '東京': 'NRT', 'tokyo': 'NRT', '成田': 'NRT', '羽田': 'HND',
  '大阪': 'KIX', 'osaka': 'KIX', '關西': 'KIX', '京都': 'KIX', 'kyoto': 'KIX',
  '沖繩': 'OKA', 'okinawa': 'OKA', '那霸': 'OKA', 'naha': 'OKA',
  '北海道': 'CTS', 'hokkaido': 'CTS', '札幌': 'CTS', 'sapporo': 'CTS',
  '福岡': 'FUK', 'fukuoka': 'FUK',
  '名古屋': 'NGO', 'nagoya': 'NGO',
  '廣島': 'HIJ', 'hiroshima': 'HIJ',
  '仙台': 'SDJ', 'sendai': 'SDJ',
  '熊本': 'KMJ', 'kumamoto': 'KMJ',
  '鹿兒島': 'KOJ', 'kagoshima': 'KOJ',
  '高松': 'TAK', 'takamatsu': 'TAK',

  // === South Korea ===
  '韓國': 'ICN', 'korea': 'ICN', '南韓': 'ICN',
  '首爾': 'ICN', 'seoul': 'ICN', '仁川': 'ICN', '金浦': 'GMP',
  '釜山': 'PUS', 'busan': 'PUS',
  '濟州': 'CJU', 'jeju': 'CJU',
  '大邱': 'TAE', 'daegu': 'TAE',

  // === Southeast Asia ===
  '泰國': 'BKK', 'thailand': 'BKK',
  '曼谷': 'BKK', 'bangkok': 'BKK',
  '清邁': 'CNX', 'chiang mai': 'CNX',
  '普吉': 'HKT', 'phuket': 'HKT',
  '芭達雅': 'BKK', 'pattaya': 'BKK',
  '新加坡': 'SIN', 'singapore': 'SIN',
  '馬來西亞': 'KUL', 'malaysia': 'KUL',
  '吉隆坡': 'KUL', 'kuala lumpur': 'KUL',
  '檳城': 'PEN', 'penang': 'PEN',
  '沙巴': 'BKI', 'sabah': 'BKI', '亞庇': 'BKI',
  '越南': 'SGN', 'vietnam': 'SGN',
  '胡志明': 'SGN', 'ho chi minh': 'SGN',
  '河內': 'HAN', 'hanoi': 'HAN',
  '峴港': 'DAD', 'danang': 'DAD',
  '富國島': 'PQC', 'phu quoc': 'PQC',
  '印尼': 'DPS', 'indonesia': 'DPS',
  '峇里島': 'DPS', 'bali': 'DPS',
  '雅加達': 'CGK', 'jakarta': 'CGK',
  '菲律賓': 'MNL', 'philippines': 'MNL',
  '長灘島': 'KLO', 'boracay': 'KLO',
  '馬尼拉': 'MNL', 'manila': 'MNL',
  '宿霧': 'CEB', 'cebu': 'CEB',

  // === Greater China ===
  '香港': 'HKG', 'hong kong': 'HKG',
  '澳門': 'MFM', 'macau': 'MFM',
  '上海': 'PVG', 'shanghai': 'PVG',
  '北京': 'PEK', 'beijing': 'PEK',
  '廣州': 'CAN', 'guangzhou': 'CAN',
  '深圳': 'SZX', 'shenzhen': 'SZX',
  '成都': 'TFU', 'chengdu': 'TFU',

  // === Americas ===
  '美國': 'LAX', 'usa': 'LAX', 'united states': 'LAX',
  '紐約': 'JFK', 'new york': 'JFK',
  '洛杉磯': 'LAX', 'los angeles': 'LAX',
  '舊金山': 'SFO', 'san francisco': 'SFO',
  '西雅圖': 'SEA', 'seattle': 'SEA',
  '芝加哥': 'ORD', 'chicago': 'ORD',
  '拉斯維加斯': 'LAS', 'las vegas': 'LAS',
  '夏威夷': 'HNL', 'hawaii': 'HNL', '檀香山': 'HNL', 'honolulu': 'HNL',
  '加拿大': 'YVR', 'canada': 'YVR',
  '溫哥華': 'YVR', 'vancouver': 'YVR',
  '多倫多': 'YYZ', 'toronto': 'YYZ',

  // === Oceania ===
  '澳洲': 'SYD', 'australia': 'SYD',
  '雪梨': 'SYD', 'sydney': 'SYD',
  '墨爾本': 'MEL', 'melbourne': 'MEL',
  '布里斯本': 'BNE', 'brisbane': 'BNE',
  '黃金海岸': 'OOL', 'gold coast': 'OOL',
  '紐西蘭': 'AKL', 'new zealand': 'AKL',
  '奧克蘭': 'AKL', 'auckland': 'AKL',
  '基督城': 'CHC', 'christchurch': 'CHC',

  // === Middle East & Africa ===
  '土耳其': 'IST', 'turkey': 'IST', 'türkiye': 'IST',
  '伊斯坦堡': 'IST', 'istanbul': 'IST',
  '埃及': 'CAI', 'egypt': 'CAI', '開羅': 'CAI', 'cairo': 'CAI',
  '阿聯酋': 'DXB', 'uae': 'DXB', '阿拉伯聯合大公國': 'DXB',
  '杜拜': 'DXB', 'dubai': 'DXB',
  '阿布達比': 'AUH', 'abu dhabi': 'AUH',
  '卡達': 'DOH', 'qatar': 'DOH', '杜哈': 'DOH', 'doha': 'DOH',
}

/**
 * Multi-Airport clusters for countries and major metropolitan areas
 */
const DESTINATION_MULTI_HUBS: Record<string, AirportHub[]> = {
  // Italy
  '義大利': [
    { code: 'FCO', labelZh: '羅馬 FCO', labelEn: 'Rome FCO' },
    { code: 'MXP', labelZh: '米蘭 MXP', labelEn: 'Milan MXP' },
    { code: 'VCE', labelZh: '威尼斯 VCE', labelEn: 'Venice VCE' },
    { code: 'FLR', labelZh: '佛羅倫斯 FLR', labelEn: 'Florence FLR' },
  ],
  'italy': [
    { code: 'FCO', labelZh: '羅馬 FCO', labelEn: 'Rome FCO' },
    { code: 'MXP', labelZh: '米蘭 MXP', labelEn: 'Milan MXP' },
    { code: 'VCE', labelZh: '威尼斯 VCE', labelEn: 'Venice VCE' },
  ],
  // Japan
  '日本': [
    { code: 'NRT', labelZh: '東京成田 NRT', labelEn: 'Tokyo NRT' },
    { code: 'HND', labelZh: '東京羽田 HND', labelEn: 'Tokyo HND' },
    { code: 'KIX', labelZh: '大阪關西 KIX', labelEn: 'Osaka KIX' },
    { code: 'FUK', labelZh: '福岡 FUK', labelEn: 'Fukuoka FUK' },
  ],
  '東京': [
    { code: 'NRT', labelZh: '成田 NRT', labelEn: 'Narita NRT' },
    { code: 'HND', labelZh: '羽田 HND', labelEn: 'Haneda HND' },
  ],
  'tokyo': [
    { code: 'NRT', labelZh: 'Narita NRT', labelEn: 'Narita NRT' },
    { code: 'HND', labelZh: 'Haneda HND', labelEn: 'Haneda HND' },
  ],
  // UK
  '英國': [
    { code: 'LHR', labelZh: '倫敦希斯洛 LHR', labelEn: 'London LHR' },
    { code: 'LGW', labelZh: '倫敦蓋威克 LGW', labelEn: 'London LGW' },
    { code: 'EDI', labelZh: '愛丁堡 EDI', labelEn: 'Edinburgh EDI' },
  ],
  // France
  '法國': [
    { code: 'CDG', labelZh: '巴黎戴高樂 CDG', labelEn: 'Paris CDG' },
    { code: 'ORY', labelZh: '巴黎奧利 ORY', labelEn: 'Paris ORY' },
    { code: 'NCE', labelZh: '尼斯 NCE', labelEn: 'Nice NCE' },
  ],
  // Germany
  '德國': [
    { code: 'FRA', labelZh: '法蘭克福 FRA', labelEn: 'Frankfurt FRA' },
    { code: 'MUC', labelZh: '慕尼黑 MUC', labelEn: 'Munich MUC' },
    { code: 'BER', labelZh: '柏林 BER', labelEn: 'Berlin BER' },
  ],
  // Spain
  '西班牙': [
    { code: 'MAD', labelZh: '馬德里 MAD', labelEn: 'Madrid MAD' },
    { code: 'BCN', labelZh: '巴塞隆納 BCN', labelEn: 'Barcelona BCN' },
  ],
  // Switzerland
  '瑞士': [
    { code: 'ZRH', labelZh: '蘇黎世 ZRH', labelEn: 'Zurich ZRH' },
    { code: 'GVA', labelZh: '日內瓦 GVA', labelEn: 'Geneva GVA' },
  ],
  // USA
  '美國': [
    { code: 'LAX', labelZh: '洛杉磯 LAX', labelEn: 'Los Angeles LAX' },
    { code: 'SFO', labelZh: '舊金山 SFO', labelEn: 'San Francisco SFO' },
    { code: 'JFK', labelZh: '紐約 JFK', labelEn: 'New York JFK' },
    { code: 'SEA', labelZh: '西雅圖 SEA', labelEn: 'Seattle SEA' },
  ],
  // Thailand
  '泰國': [
    { code: 'BKK', labelZh: '曼谷素萬那普 BKK', labelEn: 'Bangkok BKK' },
    { code: 'DMK', labelZh: '曼谷廊曼 DMK', labelEn: 'Bangkok DMK' },
    { code: 'CNX', labelZh: '清邁 CNX', labelEn: 'Chiang Mai CNX' },
    { code: 'HKT', labelZh: '普吉島 HKT', labelEn: 'Phuket HKT' },
  ],
}

/**
 * IATA 2-character Airline code to Traditional Chinese name
 */
const AIRLINE_NAME_MAP: Record<string, string> = {
  'BR': '長榮航空',
  'CI': '中華航空',
  'JX': '星宇航空',
  'IT': '台灣虎航',
  'MM': '樂桃航空',
  'GK': '捷星日本',
  'JL': '日本航空',
  'NH': '全日空',
  'TR': '酷航',
  'CX': '國泰航空',
  'VJ': '越捷航空',
  '7C': '濟州航空',
  'D7': '亞洲航空',
  'OZ': '韓亞航空',
  'KE': '大韓航空',
  'TG': '泰國航空',
  'SQ': '新加坡航空',
  'MH': '馬來西亞航空',
  'VN': '越南航空',
  'PR': '菲律賓航空',
  'HX': '香港航空',
  'UO': '香港快運',
  'DL': '達美航空',
  'UA': '聯合航空',
  'AA': '美國航空',
  'AF': '法國航空',
  'BA': '英國航空',
  'EK': '阿聯酋航空',
  'QR': '卡達航空',
  'LH': '漢莎航空',
  'KL': '荷蘭皇家航空',
  'LX': '瑞士國際航空',
  'AZ': 'ITA 義大利航空',
  'AY': '芬蘭航空',
  'TK': '土耳其航空',
  'EY': '阿提哈德航空',
  'QF': '澳洲航空',
  'NZ': '紐西蘭航空',
  'AC': '加拿大航空',
}

/**
 * Common departure origin hubs available for quick toggling
 */
export const DEFAULT_ORIGIN_HUBS = ['TPE', 'TSA', 'KHH', 'HKG'] as const
export type OriginHub = typeof DEFAULT_ORIGIN_HUBS[number]

/**
 * Resolve destination city/country to nearest main international airport IATA code
 */
export function resolveAirportFromDestination(destination?: string): string | undefined {
  if (!destination) return undefined
  const cleaned = destination.toLowerCase().trim()

  // 1. Exact match
  if (DESTINATION_AIRPORT_MAP[cleaned]) {
    return DESTINATION_AIRPORT_MAP[cleaned]
  }

  // 2. Substring match (e.g. "義大利蜜月" -> "義大利" -> FCO, "米蘭時尚" -> "米蘭" -> MXP)
  for (const [pattern, iata] of Object.entries(DESTINATION_AIRPORT_MAP)) {
    if (cleaned.includes(pattern) || pattern.includes(cleaned)) {
      return iata
    }
  }

  return undefined
}

/**
 * Get available multi-airport choices for countries or multi-airport cities
 */
export function getDestinationHubs(destination?: string): AirportHub[] {
  if (!destination) return []
  const cleaned = destination.toLowerCase().trim()

  // Exact match in multi-hub clusters
  if (DESTINATION_MULTI_HUBS[cleaned]) {
    return DESTINATION_MULTI_HUBS[cleaned]
  }

  // Substring match in multi-hub clusters
  for (const [pattern, hubs] of Object.entries(DESTINATION_MULTI_HUBS)) {
    if (cleaned.includes(pattern) || pattern.includes(cleaned)) {
      return hubs
    }
  }

  // Fallback to single primary airport if known
  const primary = resolveAirportFromDestination(destination)
  if (primary) {
    return [{ code: primary, labelZh: primary, labelEn: primary }]
  }

  return []
}

/**
 * Get friendly airline display name from IATA 2-letter code
 */
export function getAirlineName(iataCode?: string): string {
  if (!iataCode) return '航空公司'
  const code = iataCode.toUpperCase().trim()
  return AIRLINE_NAME_MAP[code] || code
}

