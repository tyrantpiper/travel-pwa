"use client"

/**
 * WelcomeWizard - 3-Step Onboarding Guide
 * 
 * 🆕 2026 Best Practice:
 * - Framer Motion AnimatePresence for smooth transitions
 * - Skip button on API Key step to avoid user drop-off
 * - Unique keys for parallel exit/enter animations
 */
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Calendar, Sparkles, Compass, ChevronRight, ChevronLeft,
    X, ExternalLink, Rocket
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useOnboardingStore } from "@/lib/stores/onboardingStore"
import { cn } from "@/lib/utils"

interface WelcomeWizardProps {
    onComplete: () => void
}

// Step configuration
const STEPS = [
    {
        id: "create-trip",
        icon: Calendar,
        title: "建立你的第一個行程",
        subtitle: "開始規劃精彩旅程",
        description: "點擊左上角「新增行程」建立行程，或使用 AI 自動生成完整行程規劃。",
        color: "from-blue-500 to-indigo-600",
        emoji: "🗓️"
    },
    {
        id: "setup-ai",
        icon: Sparkles,
        title: "啟用 AI 助手",
        subtitle: "解鎖智能規劃功能",
        description: "設定 Gemini API Key 即可使用 AI 行程規劃、翻譯、推薦等功能。完全免費！",
        color: "from-amber-400 to-orange-500",
        emoji: "🤖",
        skipable: true  // 🆕 可跳過
    },
    {
        id: "explore",
        icon: Compass,
        title: "探索更多功能",
        subtitle: "你的旅行好幫手",
        description: "費用追蹤、PDF 匯出、即時天氣、地圖導航...所有旅行所需功能一應俱全！",
        color: "from-emerald-400 to-teal-500",
        emoji: "🎯"
    }
]

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
    const { currentStep, nextStep, prevStep, completeOnboarding, skipOnboarding } = useOnboardingStore()
    const [direction, setDirection] = useState(0)

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
                                    前往 Google AI Studio 獲取 Key
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                                <p className="text-xs text-white/40">
                                    可稍後在 Profile → AI API Key 設定
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
                            上一步
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
                                開始旅程
                                <Rocket className="w-5 h-5 ml-2" />
                            </>
                        ) : (
                            <>
                                下一步
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
                        稍後再說，先看看其他功能
                    </button>
                )}
            </div>
        </motion.div>
    )
}
