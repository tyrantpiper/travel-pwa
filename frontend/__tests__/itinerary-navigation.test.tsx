/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { useTripStore } from '@/lib/stores/tripStore'

// Clean unified component using single source of truth (the fix)
function CleanItineraryDaySync() {
    const day = useTripStore((s) => s.focusedDay)
    const setDay = useTripStore((s) => s.setFocusedDay)

    return (
        <div>
            <div data-testid="clean-day">{day}</div>
            <button data-testid="clean-btn-day-0" onClick={() => setDay(0)}>Overview</button>
            <button data-testid="clean-btn-day-2" onClick={() => setDay(2)}>Day 2</button>
        </div>
    )
}

describe('Itinerary Day Switching Deadlock vs Clean Architecture', () => {
    beforeEach(() => {
        useTripStore.setState({
            activeTripId: 'trip-1',
            focusedDay: 1,
            targetExpenseId: null,
        })
    })

    it('CleanItineraryDaySync correctly switches to Day 2 and Day 0 without deadlock', () => {
        render(<CleanItineraryDaySync />)
        expect(screen.getByTestId('clean-day').textContent).toBe('1')

        act(() => {
            screen.getByTestId('clean-btn-day-2').click()
        })
        expect(screen.getByTestId('clean-day').textContent).toBe('2')
        expect(useTripStore.getState().focusedDay).toBe(2)

        act(() => {
            screen.getByTestId('clean-btn-day-0').click()
        })
        expect(screen.getByTestId('clean-day').textContent).toBe('0')
        expect(useTripStore.getState().focusedDay).toBe(0)
    })
})
