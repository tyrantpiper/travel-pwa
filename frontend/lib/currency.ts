/**
 * Currency Exchange Helper
 * Fetches real-time exchange rates for target currency against TWD base.
 */

export const getExchangeRate = async (currency: string = 'JPY'): Promise<number> => {
    const targetCode = currency.toLowerCase()

    // Base case: TWD to TWD is always 1:1
    if (targetCode === 'twd') {
        return 1
    }

    try {
        // Primary source: fawazahmed0/currency-api (Unlimited, CDN cached)
        // Format: /currencies/{currency}.json -> { "{currency}": { "twd": 0.22 } }
        const res = await fetch(
            `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${targetCode}.json`
        )
        const data = await res.json()
        const rawRate = data[targetCode]?.twd
        if (rawRate) {
            return Math.round(rawRate * 100) / 100 // Precision to 2 decimal places
        }
    } catch (e) {
        console.warn(`Primary rate fetch failed for ${currency}:`, e)
    }

    // Fallback source: exchangerate-api
    try {
        const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${currency}`)
        const data = await res.json()
        if (data.rates?.TWD) {
            return Math.round(data.rates.TWD * 100) / 100
        }
    } catch (e) {
        console.warn(`Fallback rate fetch failed for ${currency}:`, e)
    }

    // Ultimate fallback defaults
    if (targetCode === 'jpy') return 0.22
    if (targetCode === 'usd') return 32.5
    if (targetCode === 'eur') return 35.0
    if (targetCode === 'krw') return 0.024

    return 0 // Failed to get rate
}

/**
 * Common Chinese name mappings for popular currencies beyond the hardcoded 9.
 */
export const ZH_CURRENCY_MAP: Record<string, string> = {
    // Top 10 + Common ones
    twd: "台幣", jpy: "日圓", usd: "美金", eur: "歐元", krw: "韓元",
    hkd: "港幣", cny: "人民幣", thb: "泰銖", sgd: "新幣", gbp: "英鎊",
    aud: "澳幣", cad: "加幣", chf: "瑞郎", vnd: "越南盾", php: "披索",
    idr: "印尼盾", myr: "馬幣", brl: "巴西里亞爾", try: "土耳其里拉"
}

export interface CurrencyInfo {
    code: string;
    name: string;
    zhName?: string;
    flag?: string;
    countryCode?: string;
}

let cachedCurrencyList: CurrencyInfo[] | null = null;

/**
 * Authoritative ISO 4217 fiat currency to ISO 3166-1 alpha-2 country code mapping.
 * Prevents cryptocurrencies (e.g. BTC, 1INCH, ETH) from generating bogus country codes or 404s.
 */
export const FIAT_TO_COUNTRY: Record<string, string> = {
    // 東亞與東南亞 (East & Southeast Asia)
    'TWD': 'tw', 'JPY': 'jp', 'KRW': 'kr', 'CNY': 'cn', 'HKD': 'hk',
    'MOP': 'mo', 'SGD': 'sg', 'MYR': 'my', 'THB': 'th', 'VND': 'vn',
    'PHP': 'ph', 'IDR': 'id', 'KHR': 'kh', 'LAK': 'la', 'MMK': 'mm',
    'BND': 'bn', 'MNT': 'mn',

    // 南亞與中亞 (South & Central Asia)
    'INR': 'in', 'PKR': 'pk', 'BDT': 'bd', 'LKR': 'lk', 'NPR': 'np',
    'MVR': 'mv', 'AFN': 'af', 'KZT': 'kz', 'UZS': 'uz', 'KGS': 'kg',
    'TJS': 'tj', 'TMT': 'tm',

    // 中東 (Middle East)
    'AED': 'ae', 'SAR': 'sa', 'QAR': 'qa', 'KWD': 'kw', 'BHD': 'bh',
    'OMR': 'om', 'JOD': 'jo', 'ILS': 'il', 'TRY': 'tr', 'LBP': 'lb',
    'IQD': 'iq',

    // 歐洲 (Europe)
    'EUR': 'eu', 'GBP': 'gb', 'CHF': 'ch', 'NOK': 'no', 'SEK': 'se',
    'DKK': 'dk', 'ISK': 'is', 'PLN': 'pl', 'CZK': 'cz', 'HUF': 'hu',
    'RON': 'ro', 'BGN': 'bg', 'RSD': 'rs', 'HRK': 'hr', 'BAM': 'ba',
    'MKD': 'mk', 'ALL': 'al', 'MDL': 'md', 'UAH': 'ua', 'GEL': 'ge',
    'AMD': 'am', 'AZN': 'az', 'RUB': 'ru',

    // 北美與中美加勒比 (North & Central America, Caribbean)
    'USD': 'us', 'CAD': 'ca', 'MXN': 'mx', 'CRC': 'cr', 'PAB': 'pa',
    'DOP': 'do', 'GTQ': 'gt', 'HNL': 'hn', 'NIO': 'ni', 'BZD': 'bz',
    'JMD': 'jm', 'TTD': 'tt', 'BBD': 'bb', 'BSD': 'bs', 'KYD': 'ky',
    'BMD': 'bm', 'AWG': 'aw', 'ANG': 'cw', 'HTG': 'ht',

    // 南美 (South America)
    'BRL': 'br', 'ARS': 'ar', 'CLP': 'cl', 'COP': 'co', 'PEN': 'pe',
    'UYU': 'uy', 'PYG': 'py', 'BOB': 'bo', 'GYD': 'gy', 'SRD': 'sr',

    // 大洋洲 (Oceania)
    'AUD': 'au', 'NZD': 'nz', 'FJD': 'fj', 'PGK': 'pg', 'WST': 'ws',
    'TOP': 'to', 'VUV': 'vu', 'SBD': 'sb',

    // 非洲 (Africa)
    'ZAR': 'za', 'EGP': 'eg', 'MAD': 'ma', 'DZD': 'dz', 'TND': 'tn',
    'LYD': 'ly', 'KES': 'ke', 'NGN': 'ng', 'GHS': 'gh', 'ETB': 'et',
    'TZS': 'tz', 'UGX': 'ug', 'RWF': 'rw', 'MUR': 'mu', 'SCR': 'sc',
    'BWP': 'bw', 'NAD': 'na', 'ZMW': 'zm', 'MZN': 'mz', 'AOA': 'ao'
};

/**
 * Helper to get ISO country code from currency code.
 * Strictly returns a verified ISO country code, or undefined for cryptos/non-fiat.
 */
export const getCountryCode = (currencyCode?: string | null): string | undefined => {
    if (!currencyCode || typeof currencyCode !== 'string') return undefined;
    const code = currencyCode.toUpperCase();
    return FIAT_TO_COUNTRY[code] || undefined;
}

/**
 * Helper to get flag emoji from currency code.
 * Safely guards against non-A-Z characters to avoid invalid Unicode code points.
 */
export const getFlagEmoji = (currencyCode?: string | null): string => {
    if (!currencyCode || typeof currencyCode !== 'string') return '🪙';
    const code = currencyCode.toUpperCase();
    const country = FIAT_TO_COUNTRY[code];

    if (!country || country === 'eu') {
        return country === 'eu' ? '🇪🇺' : '🪙';
    }

    const cc = country.toUpperCase();
    if (/^[A-Z]{2}$/.test(cc)) {
        return cc.replace(/./g, char => 
            String.fromCodePoint(char.charCodeAt(0) + 127397)
        );
    }
    return '🪙';
}

/**
 * Fetches all available currencies from open-source API, strictly filtered to official fiat currencies.
 */
export const getAllSupportedCurrencies = async (): Promise<CurrencyInfo[]> => {
    if (cachedCurrencyList) return cachedCurrencyList;

    try {
        const res = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies.json');
        const data = await res.json();
        
        // 🛡️ 嚴格白名單：僅保留經認證的法定主權貨幣 (Fiat)，徹底剔除加密貨幣與衍生資產
        const list = Object.entries(data)
            .filter(([code]) => Boolean(FIAT_TO_COUNTRY[code.toUpperCase()]))
            .map(([code, name]) => {
                const upperCode = code.toUpperCase();
                return {
                    code: upperCode,
                    name: String(name),
                    zhName: ZH_CURRENCY_MAP[code.toLowerCase()],
                    flag: getFlagEmoji(upperCode),
                    countryCode: getCountryCode(upperCode)
                }
            });

        // 依貨幣代碼字母順序排序
        list.sort((a, b) => a.code.localeCompare(b.code));

        cachedCurrencyList = list;
        return list;
    } catch (e) {
        console.error("Failed to fetch full currency list:", e);
        return []; 
    }
}
