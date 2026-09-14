import { describe, it, expect, beforeEach } from 'vitest'
import { useTripStore } from '@/lib/stores/tripStore'
import { dispatchDeepLink } from '@/lib/hooks/useDeepLinkRouter'

describe('Deep Link Router & Store Integration', () => {
    beforeEach(() => {
        useTripStore.setState({
            activeTripId: null,
            focusedDay: 1,
            targetExpenseId: null,
        })
    })

    it('should set and clear targetExpenseId in tripStore', () => {
        expect(useTripStore.getState().targetExpenseId).toBeNull()

        useTripStore.getState().setTargetExpenseId('exp-uuid-123')
        expect(useTripStore.getState().targetExpenseId).toBe('exp-uuid-123')

        useTripStore.getState().setTargetExpenseId(null)
        expect(useTripStore.getState().targetExpenseId).toBeNull()
    })

    it('should allow setting focusedDay to 0 for Overview', () => {
        expect(useTripStore.getState().focusedDay).toBe(1)

        useTripStore.getState().setFocusedDay(0)
        expect(useTripStore.getState().focusedDay).toBe(0)
    })

    it('should dispatch custom tabidachi-deep-link event', () => {
        let receivedDetail: unknown = null
        const handler = (e: Event) => {
            const ce = e as CustomEvent<{ link?: string }>
            receivedDetail = ce.detail
        }
        window.addEventListener('tabidachi-deep-link', handler)

        dispatchDeepLink('/?trip=trip-abc&tab=tools&expense_id=exp-xyz')

        expect(receivedDetail).toEqual({ link: '/?trip=trip-abc&tab=tools&expense_id=exp-xyz' })
        window.removeEventListener('tabidachi-deep-link', handler)
    })
})
