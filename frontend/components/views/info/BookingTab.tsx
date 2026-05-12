// 📍 frontend/components/views/info/BookingTab.tsx
// Main container for the Booking/Affiliate tab
// Composes: SmartRecommendation + CategoryPills + AffiliateCard[]

'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { TripContext, AffiliateCategory } from '@/lib/affiliate-config'
import { getEnabledPlatforms, getPlatformsByCategory, getAvailableCategories } from '@/lib/affiliate-config'
import { CategoryPills } from './CategoryPills'
import { AffiliateCard } from './AffiliateCard'
import { SmartRecommendation } from './SmartRecommendation'

interface BookingTabProps {
  tripContext: TripContext
  lang?: 'en' | 'zh'
}

// Category display config
const CATEGORY_META: Record<AffiliateCategory, { emoji: string; en: string; zh: string }> = {
  all:       { emoji: '🔥', en: 'All',        zh: '全部' },
  hotel:     { emoji: '🏨', en: 'Hotels',     zh: '住宿' },
  flight:    { emoji: '✈️', en: 'Flights',    zh: '機票' },
  activity:  { emoji: '🎫', en: 'Activities', zh: '體驗活動' },
  transport: { emoji: '🚆', en: 'Transport',  zh: '交通票券' },
  esim:      { emoji: '📶', en: 'eSIM',       zh: 'eSIM 網卡' },
  insurance: { emoji: '🛡️', en: 'Insurance',  zh: '旅遊保險' },
  utility:   { emoji: '🧰', en: 'Utilities',  zh: '實用工具' },
}

export function BookingTab({ tripContext, lang = 'zh' }: BookingTabProps) {
  const [activeCategory, setActiveCategory] = useState<AffiliateCategory>('all')

  const enabledPlatforms = getEnabledPlatforms()
  const availableCategories = getAvailableCategories()
  const filteredPlatforms = getPlatformsByCategory(activeCategory)

  // Build category pills data from available categories
  const categoryPills = availableCategories.map(cat => ({
    value: cat,
    label: CATEGORY_META[cat]?.[lang] || cat,
    emoji: CATEGORY_META[cat]?.emoji || '📦',
  }))

  // Empty state: No affiliate IDs configured
  if (enabledPlatforms.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <div className="text-5xl mb-4">🛒</div>
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
          {lang === 'zh' ? '即將推出' : 'Coming Soon'}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
          {lang === 'zh'
            ? '旅遊優惠訂購功能正在準備中，敬請期待！'
            : 'Travel booking deals are being prepared. Stay tuned!'
          }
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 space-y-3">
      {/* Smart Recommendation Banner */}
      <SmartRecommendation tripContext={tripContext} lang={lang} />

      {/* Category Filter Pills */}
      {availableCategories.length > 2 && (
        <CategoryPills
          categories={categoryPills}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />
      )}

      {/* Platform Cards */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          {filteredPlatforms.map((platform, idx) => (
            <AffiliateCard
              key={platform.id}
              platform={platform}
              tripContext={tripContext}
              lang={lang}
              index={idx}
            />
          ))}
        </motion.div>
      </AnimatePresence>


    </div>
  )
}
