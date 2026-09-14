import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpError, fetcherWithUserId } from '@/lib/hooks'
import { toast } from 'sonner'

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    }
}))

describe('Self-Healing 404 Guard & HttpError Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('TC-1: HttpError stores status, message, and optional data payload', () => {
        const err = new HttpError(404, 'Trip not found', { detail: 'Trip not found' })
        expect(err.name).toBe('HttpError')
        expect(err.status).toBe(404)
        expect(err.message).toBe('Trip not found')
        expect(err.data).toEqual({ detail: 'Trip not found' })
    })

    it('TC-2: fetcherWithUserId throws HttpError(404) without triggering generic error toast', async () => {
        // Mock global fetch returning 404
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            json: async () => ({ detail: 'Trip not found' })
        })

        await expect(fetcherWithUserId(['/api/trips/dead-uuid', 'user-123'])).rejects.toThrow(HttpError)
        
        // Ensure toast.error was NOT called for 404 (silent healing)
        expect(toast.error).not.toHaveBeenCalled()
    })

    it('TC-3: fetcherWithUserId throws HttpError(500) and displays server connection error toast', async () => {
        // Mock global fetch returning 500
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ detail: 'Internal Server Error' })
        })

        await expect(fetcherWithUserId(['/api/trips/crash-uuid', 'user-123'])).rejects.toThrow(HttpError)
        
        // Ensure toast.error WAS called for 500
        expect(toast.error).toHaveBeenCalledWith('伺服器連線失敗，請稍後再試 (Server connection failed)')
    })

    it('TC-4: fetcherWithUserId gracefully wraps TypeError("Failed to fetch") into HttpError(0) without console.error fatal blast', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        // Mock global fetch rejecting with network TypeError
        global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

        await expect(fetcherWithUserId(['/api/trips', 'user-123'])).rejects.toMatchObject({
            name: 'HttpError',
            status: 0,
            message: 'Failed to fetch',
            data: { offline: true }
        })

        // Ensure console.error was NOT called (preventing Turbopack fatal overlay)
        expect(consoleErrorSpy).not.toHaveBeenCalled()
        // Ensure graceful warn was recorded
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[Fetcher] Network degradation or offline:'),
            'Failed to fetch'
        )

        consoleErrorSpy.mockRestore()
        consoleWarnSpy.mockRestore()
    })
})
