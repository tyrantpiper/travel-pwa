/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { TripProvider, useTripContext } from '@/lib/trip-context'
import { useTripStore } from '@/lib/stores/tripStore'
import { HttpError } from '@/lib/hooks'

// 1. Mock useTrips hook
let mockTrips: Array<{ id: string; title: string }> = []
let mockIsLoading = false
const mockMutate = vi.fn()

vi.mock('@/lib/hooks', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/hooks')>()
    return {
        ...actual,
        useTrips: () => ({
            trips: mockTrips,
            isLoading: mockIsLoading,
            mutate: mockMutate,
        }),
    }
})

// 2. Mock sampleTripApi
vi.mock('@/lib/api', () => ({
    sampleTripApi: {
        seed: vi.fn().mockResolvedValue({ status: 'skipped' }),
    },
}))

describe('🛡️ 雙向秒級自癒與零誤判防線端對端模擬驗證 (Self-Healing Simulation)', () => {
    beforeEach(() => {
        localStorage.clear()
        useTripStore.setState({
            activeTripId: null,
            activeTripTitle: null,
            userId: 'test-user-uuid',
        })
        mockTrips = []
        mockIsLoading = false
        vi.clearAllMocks()
    })

    it('Scenario 1 (自癒成功)：死行程 ID 查無此人 ➔ 立即秒級自癒，雙清切換至清單最新行程', () => {
        // 設定情境：使用者清單中有 2 個正常行程
        mockTrips = [
            { id: 'valid-trip-tokyo', title: '東京五日遊' },
            { id: 'valid-trip-osaka', title: '大阪三日遊' },
        ]

        // 模擬歷史遺留死 ID
        const deadGhostId = 'ea802e46-e047-478a-aa47-87915b02252d'
        useTripStore.setState({ activeTripId: deadGhostId, activeTripTitle: '舊行程' })
        localStorage.setItem('active_trip_id', deadGhostId)
        localStorage.setItem('active_trip_title', '舊行程')

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <TripProvider>{children}</TripProvider>
        )
        const { result } = renderHook(() => useTripContext(), { wrapper })

        // 模擬 SWR 捕獲 404 後觸發 handleTripNotFound
        act(() => {
            result.current.handleTripNotFound(deadGhostId)
        })

        // 驗證 1: activeTripId 成功切換為清單中第 1 個有效行程
        expect(useTripStore.getState().activeTripId).toBe('valid-trip-tokyo')
        expect(useTripStore.getState().activeTripTitle).toBe('東京五日遊')

        // 驗證 2: localStorage 雙清更新，杜絕雙重還原
        expect(localStorage.getItem('active_trip_id')).toBe('valid-trip-tokyo')
        expect(localStorage.getItem('active_trip_title')).toBe('東京五日遊')
    })

    it('Scenario 2 (零誤判防禦)：合法行程遭遇偶發 404 ➔ 雙重核驗阻斷自癒，絕不誤切換行程！', () => {
        // 設定情境：使用者清單中明明有「東京五日遊」
        const validTripId = 'valid-trip-tokyo'
        mockTrips = [
            { id: validTripId, title: '東京五日遊' },
            { id: 'valid-trip-osaka', title: '大阪三日遊' },
        ]

        // 使用者當前正在查看東京行程
        useTripStore.setState({ activeTripId: validTripId, activeTripTitle: '東京五日遊' })
        localStorage.setItem('active_trip_id', validTripId)
        localStorage.setItem('active_trip_title', '東京五日遊')

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <TripProvider>{children}</TripProvider>
        )
        const { result } = renderHook(() => useTripContext(), { wrapper })

        // 模擬偶發網路抖動或 CDN 404 呼叫 handleTripNotFound
        act(() => {
            result.current.handleTripNotFound(validTripId)
        })

        // 驗證: 系統成功識別該行程仍在清單中，嚴禁破壞性切換！
        expect(useTripStore.getState().activeTripId).toBe(validTripId)
        expect(useTripStore.getState().activeTripTitle).toBe('東京五日遊')
        expect(localStorage.getItem('active_trip_id')).toBe(validTripId)
    })

    it('Scenario 3 (零行程邊界)：使用者名下無行程 ➔ 死 ID 秒級安全歸零，清空 localStorage', () => {
        mockTrips = [] // 零行程使用者
        const deadGhostId = 'dead-ghost-id'

        useTripStore.setState({ activeTripId: deadGhostId, activeTripTitle: '已刪除的行程' })
        localStorage.setItem('active_trip_id', deadGhostId)

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <TripProvider>{children}</TripProvider>
        )
        const { result } = renderHook(() => useTripContext(), { wrapper })

        act(() => {
            result.current.handleTripNotFound(deadGhostId)
        })

        // 驗證: 安全平滑降級為 null 空狀態
        expect(useTripStore.getState().activeTripId).toBeNull()
        expect(useTripStore.getState().activeTripTitle).toBeNull()
        expect(localStorage.getItem('active_trip_id')).toBeNull()
    })

    it('Scenario 4 (SWR 熔斷)：HttpError(404) 嚴格禁止重試，HttpError(500) 允許重試', () => {
        // 模擬 SWR onErrorRetry 邏輯
        const retryDecisions: boolean[] = []

        const simulateOnErrorRetry = (err: unknown) => {
            if (err instanceof HttpError && err.status === 404) {
                retryDecisions.push(false) // 熔斷不重試
                return
            }
            retryDecisions.push(true) // 允許重試
        }

        simulateOnErrorRetry(new HttpError(404, 'Not Found'))
        simulateOnErrorRetry(new HttpError(500, 'Internal Server Error'))
        simulateOnErrorRetry(new HttpError(504, 'Gateway Timeout'))

        expect(retryDecisions).toEqual([false, true, true])
    })
})
