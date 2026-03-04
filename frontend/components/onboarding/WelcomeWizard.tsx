"use client"

/**
 * WelcomeWizard - 3-Step Onboarding Guide
 * 
 * 🆕 2026 Best Practice:
 * - Framer Motion AnimatePresence for smooth transitions
 * - Skip button on API Key step to avoid user drop-off
 * - Unique keys for parallel exit/enter animations
 */
import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Calendar, Sparkles, Compass, ChevronRight, ChevronLeft,
    X, ExternalLink, Rocket
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/LanguageContext"
import { useOnboardingStore } from "@/lib/stores/onboardingStore"
import { cn } from "@/lib/utils"

interface WelcomeWizardProps {
    onComplete: () => void
}

// (STEPS moved into component body as useMemo — t() is a hook and cannot be called at module level)

// Animation variants
const slideVariants = {
    enter: (direction: number) => ({
        x: direction > 0 ? 300 : -300,
        opacity: 0
    }),
    center: {
        x: 0,
        opacity: 1
    },
    exit: (direction: number) => ({
        x: direction < 0 ? 300 : -300,
        opacity: 0
    })
}

export function WelcomeWizard({ onComplete }: WelcomeWizardProps) {
    const { t } = useLanguage()
    const { currentStep, nextStep, prevStep, completeOnboarding, skipOnboarding } = useOnboardingStore()
    const [direction, setDirection] = useState(0)

    // Steps defined inside component so t() i18n works (hooks can't be called at module level)
    const STEPS = useMemo(() => [
        {
            id: "create-trip",
            icon: Calendar,
            title: t('wz_step1_title'),
            subtitle: t('wz_step1_subtitle'),
            description: t('wz_step1_desc'),
            color: "from-blue-500 to-indigo-600",
            emoji: "🗓️"
        },
        {
            id: "setup-ai",
            icon: Sparkles,
            title: t('wz_step2_title'),
            subtitle: t('wz_step2_subtitle'),
            description: t('wz_step2_desc'),
            color: "from-amber-400 to-orange-500",
            emoji: "🤖",
            skipable: true
        },
        {
            id: "explore",
            icon: Compass,
            title: t('wz_step3_title'),
            subtitle: t('wz_step3_subtitle'),
            description: t('wz_step3_desc'),
            color: "from-emerald-400 to-teal-500",
            emoji: "🎯"
        }
    ], [t])

    const step = STEPS[currentStep]
    const isLastStep = currentStep === STEPS.length - 1

    const handleNext = () => {
        if (isLastStep) {
            completeOnboarding()
            onComplete()
        } else {
            setDirection(1)
            nextStep()
        }
    }

    const handlePrev = () => {
        setDirection(-1)
        prevStep()
    }

    const handleSkip = () => {
        skipOnboarding()
        onComplete()
    }

    const handleSkipToNext = () => {
        setDirection(1)
        nextStep()
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col"
        >
            {/* Skip Button */}
            <button
                onClick={handleSkip}
                className="absolute top-4 right-4 p-2 text-white/50 hover:text-white/80 transition-colors z-10"
                aria-label="Skip onboarding"
            >
                <X className="w-6 h-6" />
            </button>

            {/* Progress Indicator */}
            <div className="pt-16 px-8">
                <div className="flex gap-2 justify-center">
                    {STEPS.map((_, idx) => (
                        <div
                            key={idx}
                            className={cn(
                                "h-1.5 rounded-full transition-all duration-300",
                                idx === currentStep
                                    ? "w-8 bg-white"
                                    : idx < currentStep
                                        ? "w-4 bg-white/60"
                                        : "w-4 bg-white/20"
                            )}
                        />
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col items-center justify-center px-8 overflow-hidden">
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={currentStep}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="flex flex-col items-center text-center max-w-sm"
                    >
                        {/* Icon with gradient background */}
                        <div className={cn(
                            "w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-2xl",
                            `bg-gradient-to-br ${step.color}`
                        )}>
                            <span className="text-5xl">{step.emoji}</span>
                        </div>

                        {/* Title */}
                        <h1 className="text-2xl font-bold text-white mb-2">
                            {step.title}
                        </h1>

                        {/* Subtitle */}
                        <p className="text-white/60 text-sm mb-4">
                            {step.subtitle}
                        </p>

                        {/* Description */}
                        <p className="text-white/80 text-sm leading-relaxed">
                            {step.description}
                        </p>

                        {/* Step-specific actions */}
                        {step.id === "setup-ai" && (
                            <div className="mt-6 space-y-2">
                                <a
                                    href="https://aistudio.google.com/app/apikey"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
                                >
                                    {t('wz_get_key')}
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                                <p className="text-xs text-white/40">
                                    {t('wz_setup_later')}
                                </p>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation */}
            <div className="px-8 pb-12 space-y-3">
                {/* Main Navigation Buttons */}
                <div className="flex gap-3">
                    {currentStep > 0 && (
                        <Button
                            variant="outline"
                            onClick={handlePrev}
                            className="flex-1 h-14 rounded-2xl bg-white/10 border-white/20 text-white hover:bg-white/20"
                        >
                            <ChevronLeft className="w-5 h-5 mr-1" />
                            {t('wz_prev')}
                        </Button>
                    )}

                    <Button
                        onClick={handleNext}
                        className={cn(
                            "flex-1 h-14 rounded-2xl text-white font-medium shadow-lg",
                            `bg-gradient-to-r ${step.color} hover:opacity-90`
                        )}
                    >
                        {isLastStep ? (
                            <>
                                {t('wz_start')}
                                <Rocket className="w-5 h-5 ml-2" />
                            </>
                        ) : (
                            <>
                                {t('wz_next')}
                                <ChevronRight className="w-5 h-5 ml-1" />
                            </>
                        )}
                    </Button>
                </div>

                {/* Skip Step Button (only for skippable steps) */}
                {step.skipable && (
                    <button
                        onClick={handleSkipToNext}
                        className="w-full text-center text-sm text-white/40 hover:text-white/60 transition-colors py-2"
                    >
                        {t('wz_skip')}
                    </button>
                )}
            </div>
        </motion.div>
    )
}
