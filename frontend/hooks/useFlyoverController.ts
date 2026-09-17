'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

export interface FlyoverPOI {
    lat: number
    lng: number
    name?: string
    [key: string]: unknown
}

export interface MapLike {
    getCenter: () => { lat: number; lng: number }
    getBearing: () => number
    getPitch: () => number
    flyTo: (options: Record<string, unknown>) => void
    easeTo: (options: Record<string, unknown>) => void
    jumpTo: (options: Record<string, unknown>) => void
    rotateTo: (bearing: number, options?: Record<string, unknown>) => void
    fitBounds?: (bounds: [[number, number], [number, number]], options?: Record<string, unknown>) => void
    stop: () => void
    on: (event: string, listener: (...args: unknown[]) => void) => void
    off: (event: string, listener: (...args: unknown[]) => void) => void
    once: (event: string, listener: (...args: unknown[]) => void) => void
    getMap?: () => MapLike
}

export const FLYOVER_CONFIG = {
    DEFAULT_ORBIT_DURATION_MS: 10000,
    PROXIMITY_THRESHOLD_DEG: 0.0002, // 約 20m 視為原地抵達，採用平滑貼地俯衝取代大幅度起降
    RECENTER_THRESHOLD_DEG: 0.0003,  // 暫停漫遊偏離約 30m 時回正中心
    CRUISE_ZOOM: 16.5,
    CRUISE_PITCH: 60,
    SPEED: 0.75,
    CURVE: 1.42,
    SETTLE_DURATION_MS: 600,
    RECENTER_DURATION_MS: 800,
    RECENTER_DWELL_MS: 850,
    RESUME_DWELL_MS: 2000,
} as const

const DEFAULT_ORBIT_DURATION_MS = FLYOVER_CONFIG.DEFAULT_ORBIT_DURATION_MS

/**
 * useFlyoverController
 * 
 * 3D 航線空拍機飛機視角 (Cinematic Flyover & 360° Orbit) 控制器
 * 核心架構：
 * 1. Macro Tour Session (tourIdRef) 與 Micro Leg Flight (flightIdRef) 隔離
 * 2. 拋物線高空飛越 (Cinematic Arc & Bearing)
 * 3. 抵達地標後 360° 空拍機低空環繞盤旋 (Cinematic Orbit)
 * 4. 嚴格解綁先行原則 (stopCurrentMovement)，阻斷 map.stop() 引爆 moveend 的競態事件
 * 5. 全日導覽自動巡航與平滑拉升高空俯瞰總覽
 */
export function useFlyoverController(mapRef: React.RefObject<MapLike | null>) {
    const [isFlying, setIsFlying] = useState(false)
    const [isTouring, setIsTouring] = useState(false)
    const [isOrbiting, setIsOrbiting] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [currentTourIndex, setCurrentTourIndex] = useState<number>(-1)
    const [currentTourPOI, setCurrentTourPOI] = useState<FlyoverPOI | null>(null)

    const tourIdRef = useRef<number>(0)
    const flightIdRef = useRef<number>(0)
    const isCancelledRef = useRef<boolean>(false)
    const isPausedRef = useRef<boolean>(false)
    const tourTimerRef = useRef<NodeJS.Timeout | null>(null)
    const animFrameRef = useRef<number | null>(null)
    const nextStepCallbackRef = useRef<(() => void) | null>(null)
    const activeCleanupRef = useRef<(() => void) | null>(null)
    const poisRef = useRef<FlyoverPOI[]>([])
    const tourIndexRef = useRef<number>(-1)
    const runStepRef = useRef<((index: number) => void) | null>(null)

    const getMapInstance = useCallback((): MapLike | null => {
        if (!mapRef.current) return null
        if (typeof mapRef.current.getMap === 'function') {
            return mapRef.current.getMap()
        }
        return mapRef.current
    }, [mapRef])

    /**
     * 原子級相機動畫與監聽清理（嚴格解綁先行，阻斷 map.stop() 觸發 moveend 副作用）
     */
    const stopCurrentMovement = useCallback(() => {
        if (activeCleanupRef.current) {
            activeCleanupRef.current()
            activeCleanupRef.current = null
        }
        if (tourTimerRef.current) {
            clearTimeout(tourTimerRef.current)
            tourTimerRef.current = null
        }
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current)
            animFrameRef.current = null
        }
        const map = getMapInstance()
        if (map && typeof map.stop === 'function') {
            map.stop()
        }
    }, [getMapInstance])

    // 清理未完成的計時器與動畫訊框
    useEffect(() => {
        return () => {
            stopCurrentMovement()
        }
    }, [stopCurrentMovement])

    /** 最短角度旋轉演算法：保證在 355° -> 10° 時轉動 +15° 而非 -345° */
    const getShortestBearing = useCallback((current: number, target: number): number => {
        let diff = (target - current) % 360
        if (diff > 180) diff -= 360
        if (diff < -180) diff += 360
        return current + diff
    }, [])

    /** 球面大圓航向角計算 (Degrees 0-360) */
    const calculateBearing = useCallback((
        startLng: number,
        startLat: number,
        destLng: number,
        destLat: number
    ): number => {
        const toRad = (d: number) => (d * Math.PI) / 180
        const toDeg = (r: number) => (r * 180) / Math.PI

        const y = Math.sin(toRad(destLng - startLng)) * Math.cos(toRad(destLat))
        const x = Math.cos(toRad(startLat)) * Math.sin(toRad(destLat)) -
                  Math.sin(toRad(startLat)) * Math.cos(toRad(destLat)) * Math.cos(toRad(destLng - startLng))
        return (toDeg(Math.atan2(y, x)) + 360) % 360
    }, [])

    /** 取消當前所有飛行、盤旋與導覽佇列 */
    const cancelFlight = useCallback(() => {
        tourIdRef.current++
        flightIdRef.current++
        isCancelledRef.current = true
        isPausedRef.current = false
        setIsFlying(false)
        setIsTouring(false)
        setIsOrbiting(false)
        setIsPaused(false)
        setCurrentTourIndex(-1)
        setCurrentTourPOI(null)
        tourIndexRef.current = -1
        nextStepCallbackRef.current = null
        runStepRef.current = null

        stopCurrentMovement()
    }, [stopCurrentMovement])

    /**
     * 空拍機 360° 低空環繞盤旋動畫 (Cinematic Orbit)
     * 圍繞目標中心點順時針旋轉 360 度，展示地標周邊全貌 (預設 10 秒優雅漫遊)
     */
    const startOrbit = useCallback((
        target: { lat: number; lng: number },
        durationMs: number = DEFAULT_ORBIT_DURATION_MS,
        onComplete?: () => void
    ) => {
        const map = getMapInstance()
        if (!map) return

        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current)
            animFrameRef.current = null
        }

        setIsOrbiting(true)
        const currentFlightId = flightIdRef.current
        const currentTourId = tourIdRef.current
        const startBearing = map.getBearing() || 0
        let startTime: number | null = null

        const step = (timestamp: number) => {
            if (
                isCancelledRef.current ||
                isPausedRef.current ||
                flightIdRef.current !== currentFlightId ||
                tourIdRef.current !== currentTourId
            ) {
                setIsOrbiting(false)
                return
            }

            if (!startTime) startTime = timestamp
            const elapsed = timestamp - startTime
            const progress = Math.min(elapsed / durationMs, 1)

            const currentBearing = (startBearing + progress * 360) % 360
            if (typeof map.jumpTo === 'function') {
                map.jumpTo({
                    center: [target.lng, target.lat],
                    bearing: currentBearing,
                    pitch: 60
                })
            }

            if (progress < 1) {
                animFrameRef.current = requestAnimationFrame(step)
            } else {
                setIsOrbiting(false)
                animFrameRef.current = null
                onComplete?.()
            }
        }

        animFrameRef.current = requestAnimationFrame(step)
    }, [getMapInstance])

    /**
     * 單站 3D 飛機視角 (Flyover) + 落地 360° 空拍盤旋
     */
    const triggerFlyover = useCallback((
        target: { lat: number; lng: number; name?: string },
        onLand?: () => void,
        enableOrbit: boolean = true
    ) => {
        const map = getMapInstance()
        if (!map) return

        stopCurrentMovement()

        const currentFlightId = ++flightIdRef.current
        isCancelledRef.current = false
        setIsFlying(true)
        setIsOrbiting(false)
        setCurrentTourPOI(target)

        const center = map.getCenter()
        const currentBearing = map.getBearing() || 0

        const cleanupListeners = () => {
            map.off('dragstart', handleUserInterrupt)
            map.off('touchstart', handleUserInterrupt)
            map.off('wheel', handleUserInterrupt)
            map.off('moveend', handleMoveEnd)
            if (activeCleanupRef.current === cleanupListeners) {
                activeCleanupRef.current = null
            }
        }

        // 使用者主動手勢中斷監聽器（非暫停狀態下停止自動運鏡轉為手動自由視角）
        const handleUserInterrupt = () => {
            if (flightIdRef.current === currentFlightId && !isPausedRef.current) {
                isCancelledRef.current = true
                tourIdRef.current++
                setIsFlying(false)
                setIsOrbiting(false)
                setIsTouring(false)
                setCurrentTourIndex(-1)
                setCurrentTourPOI(null)
                nextStepCallbackRef.current = null
                if (tourTimerRef.current) {
                    clearTimeout(tourTimerRef.current)
                    tourTimerRef.current = null
                }
                if (animFrameRef.current) {
                    cancelAnimationFrame(animFrameRef.current)
                    animFrameRef.current = null
                }
                cleanupListeners()
            }
        }

        const handleMoveEnd = () => {
            cleanupListeners()
            // 只有未受使用者中斷且 ID 相符才確認落地
            if (!isCancelledRef.current && flightIdRef.current === currentFlightId) {
                setIsFlying(false)
                onLand?.()
                // 落地後平滑啟動 360° 空拍機環繞盤旋 (10 秒優雅漫遊)
                if (enableOrbit) {
                    startOrbit(target, DEFAULT_ORBIT_DURATION_MS)
                }
            }
        }

        // 距離防護：小於 20m 視為原地，不大幅度拉升
        const dist = Math.hypot(target.lng - center.lng, target.lat - center.lat)
        if (dist < FLYOVER_CONFIG.PROXIMITY_THRESHOLD_DEG) {
            activeCleanupRef.current = cleanupListeners
            map.on('dragstart', handleUserInterrupt)
            map.on('touchstart', handleUserInterrupt)
            map.on('wheel', handleUserInterrupt)

            map.easeTo({
                center: [target.lng, target.lat],
                zoom: FLYOVER_CONFIG.CRUISE_ZOOM,
                pitch: FLYOVER_CONFIG.CRUISE_PITCH,
                duration: FLYOVER_CONFIG.SETTLE_DURATION_MS
            })
            tourTimerRef.current = setTimeout(() => {
                cleanupListeners()
                if (flightIdRef.current === currentFlightId && !isCancelledRef.current) {
                    setIsFlying(false)
                    onLand?.()
                    if (enableOrbit) {
                        startOrbit(target, FLYOVER_CONFIG.DEFAULT_ORBIT_DURATION_MS)
                    }
                }
            }, FLYOVER_CONFIG.SETTLE_DURATION_MS)
            return
        }

        const rawBearing = calculateBearing(center.lng, center.lat, target.lng, target.lat)
        const optimalBearing = getShortestBearing(currentBearing, rawBearing)

        activeCleanupRef.current = cleanupListeners

        map.on('dragstart', handleUserInterrupt)
        map.on('touchstart', handleUserInterrupt)
        map.on('wheel', handleUserInterrupt)
        map.once('moveend', handleMoveEnd)

        // 電影級 3D 弧線飛越
        map.flyTo({
            center: [target.lng, target.lat],
            zoom: FLYOVER_CONFIG.CRUISE_ZOOM,
            pitch: FLYOVER_CONFIG.CRUISE_PITCH,
            bearing: optimalBearing,
            speed: FLYOVER_CONFIG.SPEED,
            curve: FLYOVER_CONFIG.CURVE,
            essential: true
        })
    }, [getMapInstance, calculateBearing, getShortestBearing, startOrbit, stopCurrentMovement])

    /**
     * 連續巡航導覽模式 (Tour Mode)
     * 依序巡航陣列中的每個景點：飛抵 ➔ 360° 空拍盤旋 10 秒 ➔ 自動起飛下一站
     * 完成全部站點後自動拉升相機回全日俯瞰總覽 (Full Overview)
     */
    const startTour = useCallback((
        pois: FlyoverPOI[],
        onStationArrive?: (poi: FlyoverPOI, index: number) => void,
        onTourComplete?: () => void
    ) => {
        if (!pois || pois.length === 0) return
        const map = getMapInstance()
        if (!map) return

        cancelFlight()
        const currentTourId = ++tourIdRef.current
        isCancelledRef.current = false
        isPausedRef.current = false
        poisRef.current = pois
        setIsTouring(true)
        setIsPaused(false)

        // 導覽完成：平滑拉升相機回全日總覽視角
        const finishTour = () => {
            if (tourIdRef.current !== currentTourId) return
            setIsTouring(false)
            setIsOrbiting(false)
            setIsFlying(false)
            setIsPaused(false)
            setCurrentTourIndex(-1)
            setCurrentTourPOI(null)
            tourIndexRef.current = -1
            nextStepCallbackRef.current = null
            runStepRef.current = null

            // 嚴格過濾有效有限座標，阻斷 NaN/Infinity 引爆 MapLibre fitBounds 崩潰
            const validPois = (pois || []).filter(
                p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0)
            )

            if (validPois.length > 0) {
                if (validPois.length === 1) {
                    map.easeTo({
                        center: [validPois[0].lng, validPois[0].lat],
                        zoom: 14,
                        pitch: 0,
                        bearing: 0,
                        duration: 1500
                    })
                } else {
                    const lngs = validPois.map(p => p.lng)
                    const lats = validPois.map(p => p.lat)
                    const bounds: [[number, number], [number, number]] = [
                        [Math.min(...lngs), Math.min(...lats)],
                        [Math.max(...lngs), Math.max(...lats)]
                    ]
                    if (typeof map.fitBounds === 'function') {
                        map.fitBounds(bounds, {
                            padding: 80,
                            duration: 1500,
                            pitch: 0,
                            bearing: 0
                        })
                    } else {
                        const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2
                        const midLat = (Math.min(...lats) + Math.max(...lats)) / 2
                        map.easeTo({
                            center: [midLng, midLat],
                            zoom: 12,
                            pitch: 0,
                            bearing: 0,
                            duration: 1500
                        })
                    }
                }
            }
            onTourComplete?.()
        }

        const runStep = (index: number) => {
            if (index >= pois.length) {
                finishTour()
                return
            }

            if (isCancelledRef.current || tourIdRef.current !== currentTourId) {
                setIsTouring(false)
                setIsPaused(false)
                setCurrentTourIndex(-1)
                setCurrentTourPOI(null)
                tourIndexRef.current = -1
                return
            }

            setCurrentTourIndex(index)
            tourIndexRef.current = index
            const poi = pois[index]
            setCurrentTourPOI(poi)

            // 註冊「下一站」快捷跳過回調（原子級清理先行 + 立即前進）
            nextStepCallbackRef.current = () => {
                isPausedRef.current = false
                setIsPaused(false)
                stopCurrentMovement()
                setIsOrbiting(false)
                setIsFlying(false)
                runStep(index + 1)
            }

            // 1. 飛向該站（此處不使用單次 triggerFlyover 內部 orbit，由 Tour Mode 統一調度）
            triggerFlyover(poi, () => {
                if (isCancelledRef.current || isPausedRef.current || tourIdRef.current !== currentTourId) return
                onStationArrive?.(poi, index)

                // 2. 落地後啟動 10 秒 360° 空拍環繞盤旋
                startOrbit(poi, DEFAULT_ORBIT_DURATION_MS, () => {
                    if (isCancelledRef.current || isPausedRef.current || tourIdRef.current !== currentTourId) return

                    // 3. 盤旋結束後，前進下一站或收尾
                    runStep(index + 1)
                })
            }, false)
        }

        runStepRef.current = runStep
        runStep(0)
    }, [getMapInstance, cancelFlight, triggerFlyover, startOrbit, stopCurrentMovement])

    /** 手動暫停導覽：定格並物理卸載手勢退出監聽，開放自由漫遊瀏覽 */
    const pauseTour = useCallback(() => {
        if (!isTouring || isPausedRef.current) return
        isPausedRef.current = true
        setIsPaused(true)
        setIsOrbiting(false)
        setIsFlying(false)
        stopCurrentMovement()
    }, [isTouring, stopCurrentMovement])

    /** 手動繼續導覽：平滑拉回當前站點中心，定焦 2 秒後推進下一站 */
    const resumeTour = useCallback(() => {
        if (!isTouring || !isPausedRef.current || tourIndexRef.current < 0) return
        isPausedRef.current = false
        setIsPaused(false)
        stopCurrentMovement()

        const map = getMapInstance()
        const currentPOI = poisRef.current[tourIndexRef.current]
        const currentTourId = tourIdRef.current
        if (!map || !currentPOI) return

        const center = map.getCenter()
        const dist = Math.hypot(currentPOI.lng - center.lng, currentPOI.lat - center.lat)

        const proceedToNext = () => {
            tourTimerRef.current = setTimeout(() => {
                if (!isCancelledRef.current && !isPausedRef.current && tourIdRef.current === currentTourId) {
                    if (runStepRef.current) {
                        runStepRef.current(tourIndexRef.current + 1)
                    }
                }
            }, FLYOVER_CONFIG.RESUME_DWELL_MS)
        }

        // 若使用者曾手動拖離 (>0.0003)，平滑拉回當前站點中心
        if (dist > FLYOVER_CONFIG.RECENTER_THRESHOLD_DEG) {
            map.easeTo({
                center: [currentPOI.lng, currentPOI.lat],
                zoom: FLYOVER_CONFIG.CRUISE_ZOOM,
                pitch: FLYOVER_CONFIG.CRUISE_PITCH,
                bearing: 0,
                duration: FLYOVER_CONFIG.RECENTER_DURATION_MS
            })
            tourTimerRef.current = setTimeout(proceedToNext, FLYOVER_CONFIG.RECENTER_DWELL_MS)
        } else {
            proceedToNext()
        }
    }, [isTouring, getMapInstance, stopCurrentMovement])

    /** 暫停 / 繼續 切換開關 */
    const togglePauseTour = useCallback(() => {
        if (isPausedRef.current) {
            resumeTour()
        } else {
            pauseTour()
        }
    }, [resumeTour, pauseTour])

    /** 手動跳過當前站，立即前往下一站（或在最後一站平滑收尾總覽） */
    const skipToNext = useCallback(() => {
        if (nextStepCallbackRef.current) {
            nextStepCallbackRef.current()
        }
    }, [])

    return {
        isFlying,
        isTouring,
        isOrbiting,
        isPaused,
        currentTourIndex,
        currentTourPOI,
        triggerFlyover,
        startTour,
        skipToNext,
        pauseTour,
        resumeTour,
        togglePauseTour,
        cancelFlight,
    }
}


