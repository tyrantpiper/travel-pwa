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

/**
 * 🌍 Safe PWA External Link Opener
 * 解決 iOS 17.4+ PWA (Standalone WebKit) 環境下，直接使用 window.open 
 * 觸發 Universal Link (如 Google Maps) 會跳出「不支援的連結無法開啟」的問題。
 */
export function openExternalLink(url?: string | null) {
    if (!url) return;
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    const nav = window.navigator as unknown as { standalone?: boolean };
    
    if (isIOS && nav.standalone) {
        // iOS PWA 專用降級解法：動態建立 <a> 標籤，模擬實體點擊
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } else {
        // Android, Web, 與非 PWA 環境：維持原生呼叫
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}
