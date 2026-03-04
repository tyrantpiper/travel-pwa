/**
 * i18n Entry Point — merges all domain modules into a single dictionary.
 *
 * Design decisions:
 * 1. Domain-specific modules are spread AFTER `remaining` so new keys
 *    in domain modules take precedence (intentional override).
 * 2. `TranslationKey` uses Template Literal Types for dynamic keys,
 *    eliminating the need for `as any` casts in components.
 * 3. This file is the ONLY import consumers need:
 *    `import { translations, TranslationKey } from '@/lib/i18n'`
 */
import { coreTranslations } from './core'
import { expenseTranslations } from './expense'
import { chatTranslations } from './chat'
import { weatherTranslations } from './weather'
import { timelineTranslations } from './timeline'
import { remainingTranslations } from './remaining'
import { onboardingTranslations } from './onboarding'

export const translations = {
    en: {
        ...remainingTranslations.en,
        ...coreTranslations.en,
        ...expenseTranslations.en,
        ...chatTranslations.en,
        ...weatherTranslations.en,
        ...timelineTranslations.en,
        ...onboardingTranslations.en,
    },
    zh: {
        ...remainingTranslations.zh,
        ...coreTranslations.zh,
        ...expenseTranslations.zh,
        ...chatTranslations.zh,
        ...weatherTranslations.zh,
        ...timelineTranslations.zh,
        ...onboardingTranslations.zh,
    },
} as const

/** Static keys derived from the merged dictionary */
type StaticKeys = keyof typeof translations.en

/**
 * Dynamic keys for template-literal patterns used in components:
 * - `currency_${code}` for expense currency names
 * - `cat_${key}` for expense category names
 */
type DynamicKeys = `currency_${string}` | `cat_${string}`

/** Union type — no `as any` needed anywhere in the codebase */
export type TranslationKey = StaticKeys | DynamicKeys
