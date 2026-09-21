/**
 * Onboarding Store - Zustand State Management
 * Manages onboarding state with localStorage persistence
 * 
 * 🆕 2026 Best Practice: Use persist middleware for key flags only
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OnboardingState {
    // Legacy Wizard State (Preserved for compatibility)
    isCompleted: boolean
    isFirstLogin: boolean
    currentStep: number

    // 🚀 Spotlight Tour State (Action-Gated Walkthrough)
    isTourActive: boolean
    currentTourStep: number
    isTourCompleted: boolean

    // Actions
    setStep: (step: number) => void
    nextStep: () => void
    prevStep: () => void
    completeOnboarding: () => void
    skipOnboarding: () => void
    resetOnboarding: () => void // For testing

    // 🚀 Tour Actions
    startTour: () => void
    setTourStep: (step: number) => void
    nextTourStep: (totalSteps?: number) => void
    prevTourStep: () => void
    completeTour: () => void
    skipTour: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
    persist(
        (set) => ({
            // Initial State
            isCompleted: false,
            isFirstLogin: true,
            currentStep: 0,

            isTourActive: false,
            currentTourStep: 0,
            isTourCompleted: false,

            // Actions
            setStep: (step) => set({ currentStep: step }),

            nextStep: () => set((state) => ({
                currentStep: Math.min(state.currentStep + 1, 2)
            })),

            prevStep: () => set((state) => ({
                currentStep: Math.max(state.currentStep - 1, 0)
            })),

            completeOnboarding: () => set({
                isCompleted: true,
                isFirstLogin: false,
                currentStep: 0
            }),

            skipOnboarding: () => set({
                isCompleted: true,
                isFirstLogin: false,
                currentStep: 0
            }),

            resetOnboarding: () => set({
                isCompleted: false,
                isFirstLogin: true,
                currentStep: 0,
                isTourActive: false,
                currentTourStep: 0,
                isTourCompleted: false,
            }),

            // 🚀 Tour Actions
            startTour: () => set({
                isTourActive: true,
                currentTourStep: 0,
            }),

            setTourStep: (step: number) => set({
                currentTourStep: step
            }),

            nextTourStep: (totalSteps = 6) => set((state) => {
                if (state.currentTourStep >= totalSteps - 1) {
                    return {
                        isTourActive: false,
                        isTourCompleted: true,
                        isCompleted: true,
                        currentTourStep: 0,
                    }
                }
                return {
                    currentTourStep: state.currentTourStep + 1,
                }
            }),

            prevTourStep: () => set((state) => ({
                currentTourStep: Math.max(state.currentTourStep - 1, 0)
            })),

            completeTour: () => set({
                isTourActive: false,
                isTourCompleted: true,
                isCompleted: true,
                currentTourStep: 0,
            }),

            skipTour: () => set({
                isTourActive: false,
                isTourCompleted: true,
                isCompleted: true,
                currentTourStep: 0,
            }),
        }),
        {
            name: 'onboarding-storage',
            // 🔧 Only persist key flags, not active step (avoid stale data)
            partialize: (state) => ({
                isCompleted: state.isCompleted,
                isFirstLogin: state.isFirstLogin,
                isTourCompleted: state.isTourCompleted,
            }),
        }
    )
)

// 🆕 Selector hooks for performance
export const useIsOnboardingComplete = () =>
    useOnboardingStore((s) => s.isCompleted)

export const useOnboardingStep = () =>
    useOnboardingStore((s) => s.currentStep)

export const useIsTourActive = () =>
    useOnboardingStore((s) => s.isTourActive)

export const useCurrentTourStep = () =>
    useOnboardingStore((s) => s.currentTourStep)

