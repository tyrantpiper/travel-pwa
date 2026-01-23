import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatNumberSafe } from "./format"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 💰 Safe currency formatting
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  fallback: string = "0"
) {
  return formatNumberSafe(amount, fallback);
}

export { formatNumberSafe } from "./format"
