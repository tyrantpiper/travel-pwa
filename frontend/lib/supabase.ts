/**
 * Supabase Client Singleton
 * 
 * 避免重複創建 GoTrueClient 實例，解決 "Multiple GoTrueClient instances" 警告
 * 
 * 使用方式：
 * import { getSupabaseClient } from '@/lib/supabase'
 * const supabase = getSupabaseClient()
 * if (supabase) { ... }
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// 使用 globalThis 確保 Hot Reload 也共用同一實例
const globalForSupabase = globalThis as unknown as {
    supabaseClient: SupabaseClient | undefined
}

/**
 * 取得 Supabase Client 單例
 * 
 * 特性：
 * - SSR 安全：在 server-side 回傳 null
 * - Hot Reload 安全：使用 globalThis 確保跨 reload 共用
 * - ENV 安全：環境變數缺失時回傳 null，不會 crash
 * 
 * @returns SupabaseClient 或 null (如果 SSR 或 ENV 缺失)
 */
export function getSupabaseClient(): SupabaseClient | null {
    // 只在 client-side 執行
    if (typeof window === 'undefined') {
        return null
    }

    // 已有實例，直接回傳
    if (globalForSupabase.supabaseClient) {
        return globalForSupabase.supabaseClient
    }

    // 檢查環境變數
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
        // 不 crash，只 log 警告
        if (process.env.NODE_ENV === 'development') {
            console.warn('[Supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set')
        }
        return null
    }

    // 創建並存儲單例
    globalForSupabase.supabaseClient = createClient(supabaseUrl, supabaseKey)
    return globalForSupabase.supabaseClient
}
