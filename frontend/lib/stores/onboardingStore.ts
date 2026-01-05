/**
 * Onboarding Store - Zustand State Management
 * Manages onboarding state with localStorage persistence
 * 
 * 🆕 2026 Best Practice: Use persist middleware for key flags only
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OnboardingState {
    // State
    isCompleted: boolean
    isFirstLogin: boolean
    currentStep: number

    // Actions
    setStep: (step: number) => void
    nextStep: () => void
    prevStep: () => void
    completeOnboarding: () => void
    skipOnboarding: () => void
    resetOnboarding: () => void // For testing
}

export const useOnboardingStore = create<OnboardingState>()(
    persist(
        (set) => ({
            // Initial State
            isCompleted: false,
            isFirstLogin: true,
            currentStep: 0,

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
                currentStep: 0
            }),
        }),
        {
            name: 'onboarding-storage',
            // 🔧 Only persist key flags, not step (avoid stale data)
            partialize: (state) => ({
                isCompleted: state.isCompleted,
                isFirstLogin: state.isFirstLogin
            }),
        }
    )
)

// 🆕 Selector hooks for performance
export const useIsOnboardingComplete = () =>
    useOnboardingStore((s) => s.isCompleted)

export const useOnboardingStep = () =>
    useOnboardingStore((s) => s.currentStep)
