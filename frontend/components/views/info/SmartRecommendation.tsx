// 📍 frontend/components/views/info/SmartRecommendation.tsx
// Context-aware recommendation banner based on TripContext data
// Shows different messages depending on available trip data

'use client'

import { motion } from 'framer-motion'
import { Sparkles, Plane, Globe } from 'lucide-react'
import type { TripContext } from '@/lib/affiliate-config'
import { useFlightPrice } from '@/lib/hooks'

interface SmartRecommendationProps {
  tripContext: TripContext
  lang: 'en' | 'zh'
}

export function SmartRecommendation({ tripContext, lang }: SmartRecommendationProps) {
  // Phase 2B: Hook into real-time prices
  const flight = useFlightPrice(
    tripContext.departureAirport,
    tripContext.arrivalAirport,
    tripContext.checkinDate,
  )

  // Determine recommendation level based on available data
  const hasDestination = !!tripContext.destination
  const hasFlightInfo = !!tripContext.departureAirport
  const hasDates = !!tripContext.checkinDate

  // No data at all → generic
  if (!hasDestination && !hasFlightInfo && !hasDates) {
    return (
      <RecommendationBanner
        icon={<Globe className="w-4 h-4" />}
        title={lang === 'zh' ? '🌍 探索旅遊優惠' : '🌍 Explore Travel Deals'}
        subtitle={lang === 'zh'
          ? '瀏覽各大旅遊平台的最新優惠'
          : 'Browse the latest deals from top travel platforms'
        }
        accentClass="from-slate-500/10 to-slate-600/5 dark:from-slate-400/10 dark:to-slate-500/5"
      />
    )
  }

  // Common price display block (Graceful degradation with isLoading check)
  const priceDisplay = flight.lowestPrice && !flight.isLoading ? (
    <div className="mt-3">
      <PricePill
        icon="✈️"
        label={lang === 'zh' ? '機票最低' : 'Flights from'}
        price={flight.lowestPrice}
        currency={flight.currency}
        sub={`${tripContext.departureAirport} → ${tripContext.arrivalAirport}`}
      />
    </div>
  ) : flight.isLoading && hasFlightInfo ? (
    <div className="mt-3 animate-pulse">
      <div className="h-[68px] rounded-xl bg-white/30 dark:bg-slate-800/30 border border-slate-200/30 dark:border-slate-700/30"></div>
    </div>
  ) : null

  // Has destination → personalized
  if (hasDestination) {
    const dest = tripContext.destination
    return (
      <RecommendationBanner
        icon={<Sparkles className="w-4 h-4" />}
        title={lang === 'zh'
          ? `🎯 為你的「${dest}」行程推薦`
          : `🎯 Picks for your "${dest}" trip`
        }
        subtitle={lang === 'zh'
          ? `根據行程${hasDates ? '日期' : ''}自動篩選最相關的優惠`
          : `Auto-filtered deals${hasDates ? ' for your travel dates' : ''}`
        }
        accentClass="from-amber-500/10 to-orange-500/5 dark:from-amber-400/10 dark:to-orange-400/5"
      >
        {priceDisplay}
      </RecommendationBanner>
    )
  }

  // Has flight info only → flight-focused
  return (
    <RecommendationBanner
      icon={<Plane className="w-4 h-4" />}
      title={lang === 'zh'
        ? `✈️ 找到航班資訊 (${tripContext.departureAirport} → ${tripContext.arrivalAirport})`
        : `✈️ Flight info found (${tripContext.departureAirport} → ${tripContext.arrivalAirport})`
      }
      subtitle={lang === 'zh'
        ? '為你推薦相關的機票比價與旅遊優惠'
        : 'Showing relevant flight deals and travel offers'
      }
      accentClass="from-sky-500/10 to-blue-500/5 dark:from-sky-400/10 dark:to-blue-400/5"
    >
      {priceDisplay}
    </RecommendationBanner>
  )
}

// --- Internal Banner Component ---
function RecommendationBanner({
  icon,
  title,
  subtitle,
  accentClass,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  accentClass: string
  children?: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        relative overflow-hidden rounded-2xl p-4 mb-4
        bg-gradient-to-br ${accentClass}
        border border-slate-200/50 dark:border-slate-700/50
      `}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 text-slate-500 dark:text-slate-400">
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {title}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {subtitle}
          </p>
          {children}
        </div>
      </div>
    </motion.div>
  )
}

function PricePill({ icon, label, price, currency, sub }: {
  icon: string; label: string; price: number; currency: string; sub: string
}) {
  return (
    <div className="rounded-xl bg-white/60 dark:bg-slate-800/60 p-2.5 border border-slate-200/50 dark:border-slate-700/50 flex flex-col justify-center">
      <div className="text-[10px] text-slate-500 font-medium mb-0.5">{icon} {label}</div>
      <div className="text-base font-black text-slate-800 dark:text-slate-100 flex items-baseline gap-1">
        <span className="text-[11px] font-semibold text-slate-500">{currency}</span>
        {price.toLocaleString()}
      </div>
      <div className="text-[10px] text-slate-400 mt-0.5 font-medium">{sub}</div>
    </div>
  )
}
