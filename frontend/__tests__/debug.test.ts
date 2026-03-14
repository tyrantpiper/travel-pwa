import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We need to test debug functions with different NODE_ENV values
describe('debug utilities', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    // vi.unstubAllEnvs() automatically restores original env values
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    describe('debugLog', () => {
        it('should call console.log in development', async () => {
            vi.stubEnv('NODE_ENV', 'development')
            // Re-import to pick up new env
            const spy = vi.spyOn(console, 'log').mockImplementation(() => { })
            const { debugLog } = await import('@/lib/debug')
            debugLog('test message')
            expect(spy).toHaveBeenCalledWith('test message')
        })

        it('should NOT call console.log in production', async () => {
            vi.stubEnv('NODE_ENV', 'production')
            const spy = vi.spyOn(console, 'log').mockImplementation(() => { })
            // debugLog checks NODE_ENV at call time
            const { debugLog } = await import('@/lib/debug')
            debugLog('secret')
            
            // In production, debugLog should suppress output
            expect(spy).not.toHaveBeenCalled()
        })
    })

    describe('debugWarn', () => {
        it('should call console.warn in development', async () => {
            vi.stubEnv('NODE_ENV', 'development')
            const spy = vi.spyOn(console, 'warn').mockImplementation(() => { })
            const { debugWarn } = await import('@/lib/debug')
            debugWarn('warning!')
            expect(spy).toHaveBeenCalledWith('warning!')
        })
    })

    describe('debugError', () => {
        it('should ALWAYS call console.error regardless of environment', async () => {
            vi.stubEnv('NODE_ENV', 'production')
            const spy = vi.spyOn(console, 'error').mockImplementation(() => { })
            const { debugError } = await import('@/lib/debug')
            debugError('critical error')
            expect(spy).toHaveBeenCalledWith('critical error')
        })
    })
})
