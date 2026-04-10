/**
 * Security Utility - Tabidachi Frontend
 * Provides cryptographic functions and secure storage wrappers.
 */

/**
 * Generates a cryptographically secure UUID v4.
 * Falls back to a high-entropy Math.random implementation if Web Crypto is unavailable.
 */
export function generateSecureUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    
    // Fallback using crypto.getRandomValues if available
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        return (String(1e7) + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) => {
            const num = parseInt(c, 10);
            return (num ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> num / 4).toString(16);
        });
    }

    // If we reach here, the environment does not support Web Crypto API
    throw new Error('Cryptographically secure random number generation is not supported in this environment.');
}

/**
 * Secure Storage Prefix to identify encrypted/obfuscated data.
 */
const SECURE_PREFIX = '___SECURE_V1___';

/**
 * Obfuscates sensitive data for localStorage.
 * Note: While not true unbreakable encryption (since key is client-side), 
 * it prevents shoulder-surfing and simple data extraction from plain text.
 */
export function encryptData(data: string): string {
    if (!data) return data;
    try {
        // Base64 obfuscation with a unique salt/suffix for Tabidachi
        const salted = `tabidachi:${data}:secure`;
        return SECURE_PREFIX + btoa(unescape(encodeURIComponent(salted)));
    } catch (e) {
        console.error('Encryption error:', e);
        return data;
    }
}

/**
 * Decrypts data from localStorage with backward compatibility.
 */
export function decryptData(encryptedData: string | null): string | null {
    if (!encryptedData) return null;
    
    // Backward compatibility: If it doesn't have the prefix, treat as plain text
    if (!encryptedData.startsWith(SECURE_PREFIX)) {
        return encryptedData;
    }

    try {
        const base64 = encryptedData.replace(SECURE_PREFIX, '');
        // Validate base64 structure before decoding
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
            return encryptedData;
        }
        
        const decrypted = decodeURIComponent(escape(atob(base64)));
        
        // Extract original content: tabidachi:CONTENT:secure
        const match = decrypted.match(/^tabidachi:(.*):secure$/);
        return match ? match[1] : decrypted;
    } catch (e) {
        console.warn('Decryption failed, falling back to raw data:', e);
        return encryptedData; 
    }
}

/**
 * Universal Secure Key Provider
 * Handles Decryption -> Legacy Fallback -> Dev Key logic in one place.
 */
export function getSecureApiKey(): string {
    if (typeof window === 'undefined') {
        return process.env.NEXT_PUBLIC_DEV_GEMINI_KEY || "";
    }

    try {
        // 1. Try Primary Secure Key (Encrypted)
        const secureKey = localStorage.getItem("user_gemini_key");
        if (secureKey) {
            const decrypted = decryptData(secureKey);
            if (decrypted) return decrypted;
        }

        // 2. Try Legacy Keys (Plain text fallback)
        const legacyKey = localStorage.getItem("gemini_api_key");
        if (legacyKey) return legacyKey;

        // 3. Final Fallback (Environment Variable)
        return process.env.NEXT_PUBLIC_DEV_GEMINI_KEY || "";
    } catch (e) {
        console.error("Critical error in key provider:", e);
        return process.env.NEXT_PUBLIC_DEV_GEMINI_KEY || "";
    }
}

/**
 * Safe URL Sanitizer
 * Verifies if a URL belongs to a trusted domain.
 */
export function isTrustedUrl(url: string, trustedDomain: string): boolean {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        // Only allow HTTPS and exact domain match (or subdomains)
        return parsed.protocol === 'https:' && 
               (parsed.hostname === trustedDomain || parsed.hostname.endsWith('.' + trustedDomain));
    } catch {
        // Not a valid URL
        return false;
    }
}
