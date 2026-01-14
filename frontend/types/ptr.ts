/**
 * 🆕 PTR Visual Feedback Engine - Phase 4 of Project Silk Touch
 * 
 * State Machine Types and Configuration
 */

export enum PTRStatus {
    IDLE = 'idle',
    PULLING = 'pulling',
    READY = 'ready',
    REFRESHING = 'refreshing',
    SUCCESS = 'success',
    ERROR = 'error'
}

export interface PTRState {
    status: PTRStatus
    pullDistance: number
}

// 狀態配置（簡化版，不含複雜動畫）
export const PTR_STATUS_CONFIG = {
    [PTRStatus.IDLE]: {
        text: '',
        icon: 'chevron-down' as const,
        color: 'text-slate-400',
        spin: false
    },
    [PTRStatus.PULLING]: {
        text: '下拉刷新',
        icon: 'arrow-down' as const,
        color: 'text-slate-600',
        spin: false
    },
    [PTRStatus.READY]: {
        text: '釋放立即刷新',
        icon: 'refresh-ccw' as const,
        color: 'text-blue-600',
        spin: false
    },
    [PTRStatus.REFRESHING]: {
        text: '刷新中...',
        icon: 'loader-2' as const,
        color: 'text-blue-600',
        spin: true  // 🔑 唯一需要旋轉的
    },
    [PTRStatus.SUCCESS]: {
        text: '資料已更新',
        icon: 'check-circle-2' as const,
        color: 'text-green-600',
        spin: false
    },
    [PTRStatus.ERROR]: {
        text: '刷新失敗',
        icon: 'alert-circle' as const,
        color: 'text-red-600',
        spin: false
    }
} as const

export type PTRIconName = typeof PTR_STATUS_CONFIG[PTRStatus]['icon']
