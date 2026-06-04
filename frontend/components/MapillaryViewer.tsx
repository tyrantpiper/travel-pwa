'use client'

/**
 * MapillaryViewer — 360° 街景 Drawer 元件
 * 
 * 核心防護措施：
 * A. React Portal — 脫離所有祖先 stacking context，確保 fixed 定位正確
 * B. 動畫完成後初始化 — 等 Drawer 動畫結束才建立 WebGL context
 * C. WebGL Context 釋放 — viewer.remove() 在 useEffect cleanup
 * D. Drawer 手勢隔離 — touch-action: none + stopPropagation
 * E. WebGL 不支援偵測 — canvas.getContext fallback
 * 
 * @see https://github.com/mapillary/mapillary-js
 * @see NLM Deep Research Report (2026-06-02)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Camera, Eye, Loader2, AlertTriangle, Minimize2, Maximize2 } from 'lucide-react'
import { searchNearbyImage, getImageEntity, isMapillaryAvailable } from '@/lib/mapillary'
import type { MapillaryImageEntity } from '@/lib/mapillary'
import { MAPILLARY } from '@/lib/constants'
import { useLanguage } from '@/lib/LanguageContext'

// CSS — 必須確保 mapillary-js 的樣式被載入
import 'mapillary-js/dist/mapillary.css'

interface MapillaryViewerProps {
    isOpen: boolean
    onClose: () => void
    imageId?: string
    lat?: number
    lng?: number
    onPositionChange?: (lat: number, lng: number, bearing: number) => void
}

export default function MapillaryViewer({
    isOpen,
    onClose,
    imageId,
    lat,
    lng,
    onPositionChange,
}: MapillaryViewerProps) {
    const { t } = useLanguage()
    const containerRef = useRef<HTMLDivElement>(null)
    const viewerRef = useRef<InstanceType<typeof import('mapillary-js').Viewer> | null>(null)

    const [status, setStatus] = useState<'loading' | 'ready' | 'no-coverage' | 'error' | 'unsupported'>('loading')
    const [metadata, setMetadata] = useState<MapillaryImageEntity | null>(null)
    const [resolvedImageId, setResolvedImageId] = useState<string | null>(null)
    const [isMinimized, setIsMinimized] = useState(false)
    // 追蹤 Drawer 動畫是否完成
    const [animationComplete, setAnimationComplete] = useState(false)
    // Portal 掛載點
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)

    // ================================================================
    // Portal 掛載（確保 SSR 安全）
    // ================================================================
    useEffect(() => {
        setPortalContainer(document.body)
    }, [])

    // ================================================================
    // 最新 Callback 參考 (防止 Infinite Render Loop)
    // ================================================================
    const onPositionChangeRef = useRef(onPositionChange)
    useEffect(() => {
        onPositionChangeRef.current = onPositionChange
    }, [onPositionChange])

    // ================================================================
    // WebGL 可用性檢查
    // ================================================================
    const checkWebGLSupport = useCallback((): boolean => {
        try {
            const canvas = document.createElement('canvas')
            return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
        } catch {
            return false
        }
    }, [])

    // ================================================================
    // Viewer 生命週期管理 — 等動畫完成後再初始化
    // ================================================================
    useEffect(() => {
        // 必須同時滿足: isOpen + 動畫完成
        if (!isOpen || !animationComplete) return

        // Token 檢查
        if (!isMapillaryAvailable()) {
            console.error('[MapillaryViewer] Token not available')
            setStatus('error')
            return
        }

        // WebGL 檢查
        if (!checkWebGLSupport()) {
            console.error('[MapillaryViewer] WebGL not supported')
            setStatus('unsupported')
            return
        }

        let cancelled = false
        setStatus('loading')
        setMetadata(null)

        const initViewer = async () => {
            console.log('[MapillaryViewer] Starting init...', { imageId, lat, lng })

            // ① 動態載入 mapillary-js
            let ViewerClass: typeof import('mapillary-js').Viewer
            try {
                const mod = await import('mapillary-js')
                ViewerClass = mod.Viewer
                console.log('[MapillaryViewer] mapillary-js loaded')
            } catch (err) {
                console.error('[MapillaryViewer] Failed to load mapillary-js:', err)
                if (!cancelled) setStatus('error')
                return
            }

            if (cancelled) return

            // ② 確認容器可用且有尺寸
            const container = containerRef.current
            if (!container) {
                console.error('[MapillaryViewer] Container ref is null')
                if (!cancelled) setStatus('error')
                return
            }

            const rect = container.getBoundingClientRect()
            console.log('[MapillaryViewer] Container dimensions:', { w: rect.width, h: rect.height })
            if (rect.width === 0 || rect.height === 0) {
                console.warn('[MapillaryViewer] Container has 0 dimensions, waiting 300ms...')
                await new Promise(r => setTimeout(r, 300))
                const retryRect = container.getBoundingClientRect()
                if (retryRect.width === 0 || retryRect.height === 0) {
                    console.error('[MapillaryViewer] Container still has 0 dimensions after wait')
                    if (!cancelled) setStatus('error')
                    return
                }
            }

            // ③ 解析目標影像 ID
            let targetId = imageId || null

            if (!targetId && lat != null && lng != null) {
                console.log('[MapillaryViewer] Searching nearby image at:', { lat, lng })
                const image = await searchNearbyImage(lat, lng)
                if (cancelled) return
                if (!image) {
                    console.warn('[MapillaryViewer] No nearby image found')
                    setStatus('no-coverage')
                    return
                }
                targetId = image.id
                console.log('[MapillaryViewer] Found nearby image:', targetId)
            }

            if (!targetId) {
                console.warn('[MapillaryViewer] No target image ID available')
                setStatus('no-coverage')
                return
            }

            if (cancelled) return
            setResolvedImageId(targetId)

            // ④ 建立 Viewer 實例
            try {
                console.log('[MapillaryViewer] Creating viewer with imageId:', targetId)

                const viewer = new ViewerClass({
                    accessToken: MAPILLARY.TOKEN,
                    container: container,
                    component: { 
                        cover: false,
                    },
                })

                viewerRef.current = viewer

                // ⑤ 使用 moveTo 導航到目標影像（比 constructor imageId 更可靠）
                viewer.moveTo(targetId).then(() => {
                    console.log('[MapillaryViewer] moveTo succeeded')
                }).catch((err: unknown) => {
                    console.error('[MapillaryViewer] moveTo failed:', err)
                    if (!cancelled) setStatus('error')
                })

                // ⑥ ResizeObserver — 確保 Canvas 尺寸同步
                const resizeObserver = new ResizeObserver(() => {
                    if (viewerRef.current) {
                        viewerRef.current.resize()
                    }
                })
                resizeObserver.observe(container)
                
                // 擴充 cleanup 邏輯
                const originalRemove = viewer.remove.bind(viewer)
                viewer.remove = () => {
                    resizeObserver.disconnect()
                    originalRemove()
                }

                // ⑦ 位置與視角同步事件
                const syncPosition = async () => {
                    if (cancelled) return
                    try {
                        const pos = await viewer.getPosition()
                        const bearing = await viewer.getBearing()
                        onPositionChangeRef.current?.(pos.lat, pos.lng, bearing)
                    } catch { /* viewer 可能已被移除 */ }
                }

                viewer.on('position', syncPosition)
                viewer.on('bearing', syncPosition)

                // ⑧ 影像切換事件 → 更新 metadata
                viewer.on('image', async (event: { image: { id: string } }) => {
                    if (cancelled) return
                    console.log('[MapillaryViewer] Image changed:', event.image.id)
                    const entity = await getImageEntity(event.image.id)
                    if (!cancelled && entity) {
                        setMetadata(entity)
                    }
                })

                // ⑨ 載入完成事件
                viewer.on('load', () => {
                    console.log('[MapillaryViewer] Viewer loaded successfully')
                    if (!cancelled) setStatus('ready')
                })

                // ⑩ 取得初始 metadata
                const entity = await getImageEntity(targetId)
                if (!cancelled && entity) {
                    setMetadata(entity)
                }

            } catch (err) {
                console.error('[MapillaryViewer] Viewer init error:', err)
                if (!cancelled) setStatus('error')
            }
        }

        initViewer()

        // ⚠️ Cleanup: 釋放 WebGL Context 防止記憶體洩漏
        return () => {
            cancelled = true
            if (viewerRef.current) {
                try {
                    viewerRef.current.remove()
                    console.log('[MapillaryViewer] Viewer removed (cleanup)')
                } catch { /* 可能已被移除 */ }
                viewerRef.current = null
            }
        }
    }, [isOpen, animationComplete, imageId, lat, lng, checkWebGLSupport])

    // 當 drawer 關閉時重置動畫狀態
    useEffect(() => {
        if (!isOpen) {
            setAnimationComplete(false)
            setStatus('loading')
            setMetadata(null)
            setResolvedImageId(null)
            setIsMinimized(false)
        }
    }, [isOpen])

    // ================================================================
    // Metadata 格式化
    // ================================================================
    const formatDate = (timestamp: number): string => {
        try {
            return new Date(timestamp).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            })
        } catch {
            return ''
        }
    }

    // ================================================================
    // Render — 使用 Portal 脫離所有祖先 stacking context
    // ================================================================
    if (!portalContainer) return null

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop — 縮小時隱藏並釋放地圖互動權 */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isMinimized ? 0 : 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] ${
                            isMinimized ? 'pointer-events-none' : ''
                        }`}
                        onClick={() => { if (!isMinimized) onClose() }}
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        onAnimationComplete={(definition) => {
                            // 只在 animate（進場）完成時觸發，不在 exit 時觸發
                            if (typeof definition === 'object' && 'y' in definition && definition.y === 0) {
                                console.log('[MapillaryViewer] Drawer animation complete')
                                setAnimationComplete(true)
                            }
                        }}
                        className={`fixed bottom-0 left-0 right-0 z-[9999] bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-in-out
                            ${isMinimized ? 'h-[50vh] rounded-t-xl' : 'h-[80vh] rounded-t-2xl'}`}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                                <Eye className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                    {t('mapillary_streetview')}
                                </h3>
                                {metadata?.is_pano && (
                                    <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                                        360°
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setIsMinimized(!isMinimized)}
                                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    aria-label={isMinimized ? "Expand view" : "Minimize view"}
                                >
                                    {isMinimized ? (
                                        <Maximize2 className="w-4 h-4 text-slate-500" />
                                    ) : (
                                        <Minimize2 className="w-4 h-4 text-slate-500" />
                                    )}
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    aria-label="Close street view"
                                >
                                    <X className="w-4 h-4 text-slate-500" />
                                </button>
                            </div>
                        </div>

                        {/* Viewer Container — Flexbox 自然伸縮，min-h-0 打破預設撐開限制 */}
                        <div className="relative flex-1 min-h-0">
                            {/* 360° Viewer 容器 — 手勢隔離 + 明確尺寸 */}
                            {/* ⚠️ 必須用 inline style 強制 position/sizing，因為 mapillary.css 的
                                .mapillary-viewer { position: relative } 會覆蓋 Tailwind 的 absolute class */}
                            <div
                                ref={containerRef}
                                className="touch-none"
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                }}
                                onPointerDown={e => e.stopPropagation()}
                                onTouchStart={e => e.stopPropagation()}
                                onTouchMove={e => e.stopPropagation()}
                            />

                            {/* Loading Overlay */}
                            {status === 'loading' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 dark:bg-slate-900/80">
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                                        <span className="text-sm text-slate-600 dark:text-slate-400">
                                            {t('mapillary_loading')}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* No Coverage */}
                            {status === 'no-coverage' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                                    <div className="flex flex-col items-center gap-3 text-center px-6">
                                        <Camera className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {t('mapillary_no_coverage')}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Error */}
                            {status === 'error' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                                    <div className="flex flex-col items-center gap-3 text-center px-6">
                                        <AlertTriangle className="w-12 h-12 text-amber-400" />
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            Failed to load street view
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* WebGL Unsupported */}
                            {status === 'unsupported' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                                    <div className="flex flex-col items-center gap-3 text-center px-6">
                                        <AlertTriangle className="w-12 h-12 text-red-400" />
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {t('mapillary_webgl_unsupported')}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Metadata Footer */}
                        {metadata && status === 'ready' && (
                            <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                    <div className="flex items-center gap-3">
                                        {metadata.captured_at && (
                                            <span className="flex items-center gap-1">
                                                <Camera className="w-3 h-3" />
                                                {t('mapillary_captured')} {formatDate(metadata.captured_at)}
                                            </span>
                                        )}
                                        {metadata.creator?.username && (
                                            <span className="text-emerald-600 dark:text-emerald-400">
                                                @{metadata.creator.username}
                                            </span>
                                        )}
                                    </div>
                                    {resolvedImageId && (
                                        <span className="font-mono text-[10px] text-slate-400">
                                            #{resolvedImageId.slice(-6)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        portalContainer
    )
}
