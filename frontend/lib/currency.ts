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
