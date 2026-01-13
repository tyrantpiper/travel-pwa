/**
 * Debug Logger Utility
 * Only logs in development mode or when DEBUG env var is set
 * 
 * Usage:
 *   import { debugLog, debugWarn, debugError } from '@/lib/debug'
 *   debugLog('🔍', 'Some debug message', { data: value })
 */

const isDev = process.env.NODE_ENV === 'development'
const isDebug = process.env.NEXT_PUBLIC_DEBUG === 'true'

const shouldLog = isDev || isDebug

export const debugLog = (...args: unknown[]) => {
    if (shouldLog) console.log(...args)
}

export const debugWarn = (...args: unknown[]) => {
    if (shouldLog) console.warn(...args)
}

export const debugError = (...args: unknown[]) => {
    // Always log errors
    console.error(...args)
}

export const debugGroup = (label: string) => {
    if (shouldLog) console.group(label)
}

export const debugGroupEnd = () => {
    if (shouldLog) console.groupEnd()
}
