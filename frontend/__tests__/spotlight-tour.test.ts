import { describe, it, expect, beforeEach } from 'vitest'
import { useOnboardingStore } from '@/lib/stores/onboardingStore'
import { translations } from '@/lib/i18n'

describe('Spotlight Tour & Onboarding Store', () => {
    beforeEach(() => {
        // Reset store state before each test
        useOnboardingStore.setState({
            isTourActive: false,
            currentTourStep: 0,
            isTourCompleted: false,
        })
    })

    it('should initialize with default tour state', () => {
        const state = useOnboardingStore.getState()
        expect(state.isTourActive).toBe(false)
        expect(state.currentTourStep).toBe(0)
        expect(state.isTourCompleted).toBe(false)
    })

    it('should start tour at step 0', () => {
        useOnboardingStore.getState().startTour()
        const state = useOnboardingStore.getState()
        expect(state.isTourActive).toBe(true)
        expect(state.currentTourStep).toBe(0)
    })

    it('should advance steps sequentially and complete upon finishing', () => {
        useOnboardingStore.getState().startTour()

        // Steps 0 -> 1 -> 2 -> 3 -> 4 -> 5
        for (let i = 1; i <= 5; i++) {
            useOnboardingStore.getState().nextTourStep()
            expect(useOnboardingStore.getState().currentTourStep).toBe(i)
            expect(useOnboardingStore.getState().isTourActive).toBe(true)
        }

        // Advance from last step (5) -> should complete
        useOnboardingStore.getState().nextTourStep()
        const state = useOnboardingStore.getState()
        expect(state.isTourActive).toBe(false)
        expect(state.isTourCompleted).toBe(true)
    })

    it('should allow stepping back without underflowing step 0', () => {
        useOnboardingStore.getState().startTour()
        useOnboardingStore.getState().nextTourStep() // to step 1
        expect(useOnboardingStore.getState().currentTourStep).toBe(1)

        useOnboardingStore.getState().prevTourStep() // to step 0
        expect(useOnboardingStore.getState().currentTourStep).toBe(0)

        useOnboardingStore.getState().prevTourStep() // clamped at 0
        expect(useOnboardingStore.getState().currentTourStep).toBe(0)
    })

    it('should skip tour and persist completion', () => {
        useOnboardingStore.getState().startTour()
        useOnboardingStore.getState().skipTour()

        const state = useOnboardingStore.getState()
        expect(state.isTourActive).toBe(false)
        expect(state.isTourCompleted).toBe(true)
    })

    it('should complete tour directly', () => {
        useOnboardingStore.getState().completeTour()

        const state = useOnboardingStore.getState()
        expect(state.isTourActive).toBe(false)
        expect(state.isTourCompleted).toBe(true)
    })

    it('should verify all required spotlight tour i18n keys in zh and en dictionaries', () => {
        const expectedTourKeys = [
            'tour_step',
            'tour_of',
            'tour_skip',
            'tour_prev',
            'tour_next',
            'tour_finish',
            'tour_restart',
            'tour_restart_desc',
            'tour_step1_title',
            'tour_step1_desc',
            'tour_step1_action',
            'tour_step2_title',
            'tour_step2_desc',
            'tour_step2_action',
            'tour_step3_title',
            'tour_step3_desc',
            'tour_step3_action',
            'tour_step4_title',
            'tour_step4_desc',
            'tour_step4_action',
            'tour_step5_title',
            'tour_step5_desc',
            'tour_step5_action',
            'tour_step6_title',
            'tour_step6_desc',
            'tour_step6_action',
        ]

        for (const key of expectedTourKeys) {
            expect(translations.zh).toHaveProperty(key)
            expect(translations.en).toHaveProperty(key)
            expect((translations.zh as Record<string, string>)[key]).toBeTruthy()
            expect((translations.en as Record<string, string>)[key]).toBeTruthy()
        }
    })
})
