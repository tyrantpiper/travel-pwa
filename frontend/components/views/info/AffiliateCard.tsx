// 📍 frontend/components/views/info/AffiliateCard.tsx
// Single affiliate platform card with brand styling and deep link CTA
// Design: Brand-color left border + Emoji icon (zero external image dependency)

'use client'

import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'
import { openExternalLink } from '@/lib/utils'
import { useFlightPrice } from '@/lib/hooks'
import type { AffiliatePlatform, TripContext } from '@/lib/affiliate-config'

interface AffiliateCardProps {
  platform: AffiliatePlatform
  tripContext: TripContext
  lang: 'en' | 'zh'
  index?: number
}

export function AffiliateCard({ platform, tripContext, lang, index = 0 }: AffiliateCardProps) {
  // Phase 2A: Only Aviasales shows real-time price
  const showPrice = platform.id === 'aviasales'
    && !!tripContext.departureAirport
    && !!tripContext.arrivalAirport

  const { lowestPrice, currency, isLoading: priceLoading } = useFlightPrice(
    showPrice ? tripContext.departureAirport : undefined,
    showPrice ? tripContext.arrivalAirport : undefined,
    tripContext.checkinDate,
  )

  const handleClick = () => {
    const url = platform.buildUrl(tripContext)

    // 📊 Affiliate click tracking (custom event for analytics)
    try {
      window.dispatchEvent(new CustomEvent('affiliate-click', {
        detail: {
          platformId: platform.id,
          platformName: platform.name,
          category: platform.category,
          destination: tripContext.destination || 'unknown',
          timestamp: Date.now(),
        }
      }))
    } catch { /* non-blocking */ }

    openExternalLink(url)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      className={`
        relative overflow-hidden rounded-2xl border-l-4 ${platform.borderColor}
        ${platform.bgColor} 
        shadow-sm hover:shadow-md transition-shadow duration-200
      `}
    >
      <button
        onClick={handleClick}
        className="w-full text-left p-4 flex items-center gap-3.5 group"
      >
        {/* Emoji Icon */}
        <div className="text-3xl shrink-0 group-hover:scale-110 transition-transform duration-200">
          {platform.emoji}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              {platform.name}
            </h4>
            {platform.badge && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                {platform.badge[lang]}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
            {platform.description[lang]}
          </p>

          {/* 💰 Real-time lowest price badge (Phase 2A) */}
          {showPrice && lowestPrice != null && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full
                bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400
                text-xs font-black"
            >
              💰 {currency} {lowestPrice.toLocaleString()}+
            </motion.span>
          )}
          {showPrice && priceLoading && (
            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full
              bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] animate-pulse"
            >
              {lang === 'zh' ? '查價中...' : 'Fetching price...'}
            </span>
          )}
        </div>

        {/* CTA Arrow */}
        <div className={`
          shrink-0 w-8 h-8 rounded-full flex items-center justify-center
          bg-white/60 dark:bg-white/10 group-hover:bg-white dark:group-hover:bg-white/20
          transition-all duration-200 group-hover:scale-105
        `}>
          <ExternalLink className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
        </div>
      </button>


    </motion.div>
  )
}
