// 📍 frontend/components/views/info/CategoryPills.tsx
// Horizontally scrollable category filter pills for Booking Tab
// Design: Matches existing motion.div animation patterns in InfoView

'use client'

import { motion } from 'framer-motion'
import type { AffiliateCategory } from '@/lib/affiliate-config'

interface CategoryPillsProps {
  categories: { value: AffiliateCategory; label: string; emoji: string }[]
  activeCategory: AffiliateCategory
  onCategoryChange: (cat: AffiliateCategory) => void
}

export function CategoryPills({ categories, activeCategory, onCategoryChange }: CategoryPillsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
      {categories.map((cat) => {
        const isActive = cat.value === activeCategory
        return (
          <button
            key={cat.value}
            onClick={() => onCategoryChange(cat.value)}
            className={`
              relative flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium
              whitespace-nowrap transition-colors duration-200 shrink-0
              ${isActive
                ? 'text-white dark:text-white'
                : 'text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }
            `}
          >
            {/* Animated background for active pill */}
            {isActive && (
              <motion.div
                layoutId="category-pill-active"
                className="absolute inset-0 bg-slate-800 dark:bg-slate-200 rounded-full"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{cat.emoji}</span>
            <span className="relative z-10">{cat.label}</span>
          </button>
        )
      })}
    </div>
  )
}
