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
 * Helper to get ISO country code from currency code.
 * Most currencies use the first two letters as the ISO country code.
 */
export const getCountryCode = (currencyCode: string): string => {
    const code = currencyCode.toUpperCase();
    const overrides: Record<string, string> = {
        'EUR': 'eu', 'USD': 'us', 'TWD': 'tw', 'JPY': 'jp', 'KRW': 'kr',
        'CNY': 'cn', 'HKD': 'hk', 'THB': 'th', 'SGD': 'sg', 'GBP': 'gb',
        'AUD': 'au', 'CAD': 'ca', 'CHF': 'ch', 'VND': 'vn', 'PHP': 'ph',
        'IDR': 'id', 'MYR': 'my', 'BRL': 'br', 'TRY': 'tr', 'ANG': 'an'
    };

    if (overrides[code]) return overrides[code].toLowerCase();
    return currencyCode.substring(0, 2).toLowerCase();
}

/**
 * Helper to get flag emoji from currency code.
 * Most currencies use the first two letters as the ISO country code.
 */
export const getFlagEmoji = (currencyCode: string): string => {
    // Hardcoded overrides for common ones where the 2-letter rule might fail or needs specifics
    const overrides: Record<string, string> = {
        'TWD': '🇹🇼', 'JPY': '🇯🇵', 'USD': '🇺🇸', 'EUR': '🇪🇺', 'KRW': '🇰🇷',
        'HKD': '🇭🇰', 'CNY': '🇨🇳', 'THB': '🇹🇭', 'SGD': '🇸🇬', 'GBP': '🇬🇧',
        'AUD': '🇦🇺', 'CAD': '🇨🇦', 'CHF': '🇨🇭', 'VND': '🇻🇳', 'PHP': '🇵🇭',
        'IDR': '🇮🇩', 'MYR': '🇲🇾', 'BRL': '🇧🇷', 'TRY': '🇹🇷'
    };

    if (overrides[currencyCode.toUpperCase()]) return overrides[currencyCode.toUpperCase()];

    // Generic fallback: Use first two letters as country code
    // Example: ARS -> AR, JPY -> JP
    const countryCode = currencyCode.substring(0, 2).toUpperCase();
    return countryCode.replace(/./g, char => 
        String.fromCodePoint(char.charCodeAt(0) + 127397)
    );
}

/**
 * Fetches all available currencies from open-source API.
 */
export const getAllSupportedCurrencies = async (): Promise<CurrencyInfo[]> => {
    if (cachedCurrencyList) return cachedCurrencyList;

    try {
        const res = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies.json');
        const data = await res.json();
        
        const list = Object.entries(data).map(([code, name]) => {
            const upperCode = code.toUpperCase();
            return {
                code: upperCode,
                name: String(name),
                zhName: ZH_CURRENCY_MAP[code.toLowerCase()],
                flag: getFlagEmoji(upperCode),
                countryCode: getCountryCode(upperCode)
            }
        });

        cachedCurrencyList = list;
        return list;
    } catch (e) {
        console.error("Failed to fetch full currency list:", e);
        return []; 
    }
}
