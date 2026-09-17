import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFlyoverController, FlyoverPOI, MapLike } from '@/hooks/useFlyoverController'

type MockableMap = MapLike & {
    flyTo: ReturnType<typeof vi.fn<(options: Record<string, unknown>) => void>>
    fitBounds: ReturnType<typeof vi.fn<(bounds: [[number, number], [number, number]], options?: Record<string, unknown>) => void>>
    stop: ReturnType<typeof vi.fn<() => void>>
}

describe('useFlyoverController Unit Test Suite', () => {
    let mockListeners: Record<string, ((...args: unknown[]) => void)[]> = {}
    let mockMap: MockableMap

    beforeEach(() => {
        vi.useFakeTimers()
        mockListeners = {}

        // Mock requestAnimationFrame using fake timers with advancing timestamps
        let rafTime = 1000
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
            return setTimeout(() => {
                rafTime += 500
                cb(rafTime)
            }, 16) as unknown as number
        })
        vi.stubGlobal('cancelAnimationFrame', (id: number) => {
            clearTimeout(id)
        })

        mockMap = {
            getCenter: vi.fn(() => ({ lat: 24.0, lng: 120.0 })), // Far enough from Taipei 101 to trigger flyTo
            getBearing: vi.fn(() => 0),
            getPitch: vi.fn(() => 0),
            flyTo: vi.fn(),
            easeTo: vi.fn(),
            jumpTo: vi.fn(),
            rotateTo: vi.fn(),
            fitBounds: vi.fn(),
            stop: vi.fn(),
            on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
                if (!mockListeners[event]) mockListeners[event] = []
                mockListeners[event].push(listener)
            }),
            off: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
                if (!mockListeners[event]) return
                mockListeners[event] = mockListeners[event].filter(l => l !== listener)
            }),
            once: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
                const wrapped = (...args: unknown[]) => {
                    mockMap.off(event, wrapped)
                    listener(...args)
                }
                mockMap.on(event, wrapped)
            })
        }
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    const triggerEvent = (event: string, ...args: unknown[]) => {
        const listeners = [...(mockListeners[event] || [])]
        listeners.forEach(l => l(...args))
    }

    const mockPois: FlyoverPOI[] = [
        { lat: 25.0339, lng: 121.5654, name: 'Taipei 101' },
        { lat: 25.0425, lng: 121.5766, name: 'Elephant Mountain' }
    ]

    it('TC-1: startTour sequentially navigates through all POIs and completes with overview pullback', () => {
        const mapRef = { current: mockMap }
        const { result } = renderHook(() => useFlyoverController(mapRef))

        const onStationArrive = vi.fn()
        const onTourComplete = vi.fn()

        act(() => {
            result.current.startTour(mockPois, onStationArrive, onTourComplete)
        })

        expect(result.current.isTouring).toBe(true)
        expect(result.current.currentTourIndex).toBe(0)
        expect(result.current.currentTourPOI?.name).toBe('Taipei 101')
        expect(mockMap.flyTo).toHaveBeenCalledTimes(1)

        // 1. 抵達第 1 站
        act(() => {
            triggerEvent('moveend')
        })

        expect(onStationArrive).toHaveBeenCalledWith(mockPois[0], 0)
        expect(result.current.isOrbiting).toBe(true)

        // 2. 模擬第 1 站盤旋 10 秒完成
        act(() => {
            vi.advanceTimersByTime(11000)
        })

        // 3. 自動起飛前往第 2 站
        expect(result.current.currentTourIndex).toBe(1)
        expect(result.current.currentTourPOI?.name).toBe('Elephant Mountain')
        expect(mockMap.flyTo).toHaveBeenCalledTimes(2)

        // 4. 抵達第 2 站並完成盤旋
        act(() => {
            triggerEvent('moveend')
        })

        expect(onStationArrive).toHaveBeenCalledWith(mockPois[1], 1)

        act(() => {
            vi.advanceTimersByTime(11000)
        })

        // 5. 全部導覽完成：平滑拉升高空俯瞰總覽
        expect(result.current.isTouring).toBe(false)
        expect(result.current.currentTourIndex).toBe(-1)
        expect(mockMap.fitBounds).toHaveBeenCalledTimes(1)
        expect(onTourComplete).toHaveBeenCalledTimes(1)
    })

    it('TC-2: skipToNext immediately advances to next station during flight or orbit', () => {
        const mapRef = { current: mockMap }
        const { result } = renderHook(() => useFlyoverController(mapRef))

        const onTourComplete = vi.fn()

        act(() => {
            result.current.startTour(mockPois, undefined, onTourComplete)
        })

        expect(result.current.currentTourIndex).toBe(0)

        // 在飛向第 1 站途中點擊「下一站」
        act(() => {
            result.current.skipToNext()
        })

        // 驗證立即停止舊相機並前進到第 2 站
        expect(mockMap.stop).toHaveBeenCalled()
        expect(result.current.currentTourIndex).toBe(1)
        expect(result.current.currentTourPOI?.name).toBe('Elephant Mountain')

        // 在第 2 站（最後一站）點擊「下一站」
        act(() => {
            result.current.skipToNext()
        })

        // 驗證直接拉升回全日總覽視角並觸發完成回調
        expect(result.current.isTouring).toBe(false)
        expect(mockMap.fitBounds).toHaveBeenCalledTimes(1)
        expect(onTourComplete).toHaveBeenCalledTimes(1)
    })

    it('TC-3: Gesture interruption (dragstart) cleanly halts Tour Mode without side effects', () => {
        const mapRef = { current: mockMap }
        const { result } = renderHook(() => useFlyoverController(mapRef))

        act(() => {
            result.current.startTour(mockPois)
        })

        expect(result.current.isTouring).toBe(true)

        // 模擬使用者在地圖上拖曳（手勢中斷）
        act(() => {
            triggerEvent('dragstart')
        })

        expect(result.current.isTouring).toBe(false)
        expect(result.current.currentTourIndex).toBe(-1)
        expect(result.current.currentTourPOI).toBeNull()
    })

    it('TC-4: pauseTour freezes motion and allows free exploration gestures without quitting Tour', () => {
        const mapRef = { current: mockMap }
        const { result } = renderHook(() => useFlyoverController(mapRef))

        act(() => {
            result.current.startTour(mockPois)
        })

        expect(result.current.isTouring).toBe(true)
        expect(result.current.isPaused).toBe(false)

        // 點擊暫停
        act(() => {
            result.current.pauseTour()
        })

        expect(result.current.isTouring).toBe(true)
        expect(result.current.isPaused).toBe(true)
        expect(mockMap.stop).toHaveBeenCalled()

        // 模擬使用者在暫停期間自由拖曳地圖查看周邊（不應中斷 Tour Mode）
        act(() => {
            triggerEvent('dragstart')
        })

        expect(result.current.isTouring).toBe(true)
        expect(result.current.isPaused).toBe(true)
        expect(result.current.currentTourIndex).toBe(0)
    })

    it('TC-5: resumeTour recenters to POI when user moved away and continues tour progression', () => {
        const mapRef = { current: mockMap }
        const { result } = renderHook(() => useFlyoverController(mapRef))

        act(() => {
            result.current.startTour(mockPois)
        })

        act(() => {
            result.current.pauseTour()
        })

        // 模擬使用者手動把地圖平移到了遠處
        mockMap.getCenter = vi.fn(() => ({ lat: 25.1000, lng: 121.6000 }))

        // 點擊繼續
        act(() => {
            result.current.resumeTour()
        })

        expect(result.current.isPaused).toBe(false)
        // 驗證相機平滑拉回當前站點
        expect(mockMap.easeTo).toHaveBeenCalledWith(expect.objectContaining({
            center: [mockPois[0].lng, mockPois[0].lat],
            duration: 800
        }))

        // 經過 850ms 拉回 + 2000ms 定焦後，自動起飛前往第 2 站
        act(() => {
            vi.advanceTimersByTime(3000)
        })

        expect(result.current.currentTourIndex).toBe(1)
        expect(result.current.currentTourPOI?.name).toBe('Elephant Mountain')
        expect(mockMap.flyTo).toHaveBeenCalledTimes(2)
    })
})

