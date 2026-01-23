/**
 * 🛠️ Safe data formatting utilities
 * Prevents crashes from null/undefined values and provides consistent fallbacks.
 */

/**
 * Safely format a number using toLocaleString.
 * @param val The value to format
 * @param fallback Fallback string if value is null/undefined
 * @param options Intl.NumberFormatOptions
 */
export function formatNumberSafe(
    val: number | string | null | undefined,
    fallback: string = "0",
    options?: Intl.NumberFormatOptions
): string {
    if (val === null || val === undefined || val === "") return fallback;

    const num = typeof val === "string" ? parseFloat(val) : val;

    if (isNaN(num)) return fallback;

    try {
        return num.toLocaleString(undefined, options);
    } catch (e) {
        console.warn("formatNumberSafe failed:", e);
        return String(num);
    }
}
