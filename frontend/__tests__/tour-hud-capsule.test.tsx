import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TourHudCapsule } from '@/components/TourHudCapsule'
import React from 'react'

// Mock LanguageContext
vi.mock('@/lib/LanguageContext', () => ({
    useLanguage: () => ({
        t: (key: string) => {
            const map: Record<string, string> = {
                flyover_paused: '⏸️ 導覽已暫停 (可自由瀏覽周邊)',
                flyover_orbiting: '🔄 360° 環繞盤旋中',
                flyover_flying: '✈️ 飛往此站中...',
                mapillary_streetview: '實景',
                flyover_resume: '繼續',
                flyover_pause: '暫停',
                flyover_next: '下一站',
                flyover_stop: '結束導覽',
            }
            return map[key] || key
        },
        language: 'zh-TW',
    }),
}))

describe('TourHudCapsule Component', () => {
    const defaultPOI = {
        name: '台北 101 觀景台',
        lat: 25.0339,
        lng: 121.5644,
        day: 1,
        sequence: 1,
    }

    it('returns null when isTouring is false', () => {
        const { container } = render(
            <TourHudCapsule
                isTouring={false}
                isOrbiting={false}
                isPaused={false}
                currentIndex={0}
                currentPOI={defaultPOI}
                onTogglePause={vi.fn()}
                onSkipNext={vi.fn()}
                onCancel={vi.fn()}
            />
        )
        expect(container.firstChild).toBeNull()
    })

    it('renders POI details and status when touring', () => {
        render(
            <TourHudCapsule
                isTouring={true}
                isOrbiting={true}
                isPaused={false}
                currentIndex={0}
                currentPOI={defaultPOI}
                onTogglePause={vi.fn()}
                onSkipNext={vi.fn()}
                onCancel={vi.fn()}
            />
        )

        expect(screen.getByText('D1-1')).toBeDefined()
        expect(screen.getByText('台北 101 觀景台')).toBeDefined()
        expect(screen.getByText('🔄 360° 環繞盤旋中')).toBeDefined()
        expect(screen.getByText('暫停')).toBeDefined()
        expect(screen.getByText('下一站')).toBeDefined()
        expect(screen.getByTitle('結束導覽')).toBeDefined()
    })

    it('displays paused status and resume button when isPaused is true', () => {
        const onTogglePause = vi.fn()
        render(
            <TourHudCapsule
                isTouring={true}
                isOrbiting={false}
                isPaused={true}
                currentIndex={0}
                currentPOI={defaultPOI}
                onTogglePause={onTogglePause}
                onSkipNext={vi.fn()}
                onCancel={vi.fn()}
            />
        )

        expect(screen.getByText('⏸️ 導覽已暫停 (可自由瀏覽周邊)')).toBeDefined()
        const resumeBtn = screen.getByText('繼續')
        expect(resumeBtn).toBeDefined()

        fireEvent.click(resumeBtn)
        expect(onTogglePause).toHaveBeenCalledTimes(1)
    })

    it('handles Street View button correctly based on hasStreetView prop', () => {
        const onOpenStreetView = vi.fn()
        const { rerender } = render(
            <TourHudCapsule
                isTouring={true}
                isOrbiting={false}
                isPaused={false}
                currentIndex={0}
                currentPOI={defaultPOI}
                onTogglePause={vi.fn()}
                onSkipNext={vi.fn()}
                onCancel={vi.fn()}
                hasStreetView={false}
                onOpenStreetView={onOpenStreetView}
            />
        )

        expect(screen.queryByText('實景')).toBeNull()

        rerender(
            <TourHudCapsule
                isTouring={true}
                isOrbiting={false}
                isPaused={false}
                currentIndex={0}
                currentPOI={defaultPOI}
                onTogglePause={vi.fn()}
                onSkipNext={vi.fn()}
                onCancel={vi.fn()}
                hasStreetView={true}
                onOpenStreetView={onOpenStreetView}
            />
        )

        const streetViewBtn = screen.getByText('實景')
        expect(streetViewBtn).toBeDefined()
        fireEvent.click(streetViewBtn)
        expect(onOpenStreetView).toHaveBeenCalledWith(25.0339, 121.5644)
    })

    it('triggers onSkipNext and onCancel when action buttons are clicked', () => {
        const onSkipNext = vi.fn()
        const onCancel = vi.fn()

        render(
            <TourHudCapsule
                isTouring={true}
                isOrbiting={false}
                isPaused={false}
                currentIndex={0}
                currentPOI={defaultPOI}
                onTogglePause={vi.fn()}
                onSkipNext={onSkipNext}
                onCancel={onCancel}
            />
        )

        fireEvent.click(screen.getByText('下一站'))
        expect(onSkipNext).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByTitle('結束導覽'))
        expect(onCancel).toHaveBeenCalledTimes(1)
    })
})
