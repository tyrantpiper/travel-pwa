"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLanguage } from "@/lib/LanguageContext"
import { useHaptic } from "@/lib/hooks"
import { CalendarRangeSheet } from "@/components/itinerary/CalendarRangeSheet"
import { motion, AnimatePresence } from "framer-motion"
import { 
    MapPin, 
    Calendar as CalendarIcon, 
    Users, 
    Sparkles, 
    Zap, 
    Car, 
    ArrowRight, 
    ArrowLeft, 
    Plus, 
    Minus
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AiGrillMeWizardProps {
    onComplete: (xmlPrompt: string, summary: string) => void
    onCancel?: () => void
}

// 快速目的地靈感膠囊
const POPULAR_DESTINATIONS = [
    { label: "🇯🇵 東京", name: "日本東京" },
    { label: "🌸 京都", name: "日本京都" },
    { label: "🏖️ 沖繩", name: "日本沖繩" },
    { label: "🏔️ 北海道", name: "日本北海道" },
    { label: "🇰🇷 首爾", name: "韓國首爾" },
    { label: "🇹🇭 曼谷", name: "泰國曼谷" },
    { label: "🇫🇷 巴黎", name: "法國巴黎" },
]

// 同行者組合
const COMPANION_OPTIONS = [
    { id: "solo", icon: "🚶‍♂️", label: "獨自旅行", desc: "自由自在，探索專屬節奏" },
    { id: "couple", icon: "💑", label: "情侶 / 夫妻", desc: "浪漫約會，美景與高空夜景" },
    { id: "family", icon: "👨‍👩‍👧", label: "親子家庭", desc: "步調輕鬆，友善設施與樂園" },
    { id: "friends", icon: "🍻", label: "朋友死黨", desc: "熱鬧狂歡，美食打卡與逛街" },
    { id: "parents", icon: "👵", label: "孝親長輩", desc: "步道平緩，溫泉美食與放鬆" },
]

// 神聖使命標籤
const MISSION_TAGS = [
    { id: "foodie", icon: "🍣", label: "美食饕客巡禮" },
    { id: "photo", icon: "📸", label: "攝影絕美打卡" },
    { id: "shopping", icon: "🛍️", label: "購物掃貨爆買" },
    { id: "culture", icon: "⛩️", label: "歷史文化神社" },
    { id: "vacation", icon: "🏖️", label: "浪漫度假放鬆" },
    { id: "nature", icon: "⛰️", label: "自然戶外探險" },
    { id: "anime", icon: "🎌", label: "動漫聖地巡禮" },
    { id: "cafe", icon: "☕", label: "特色咖啡跑店" },
]

// 活動節奏
const PACE_OPTIONS = [
    { id: "relaxed", icon: "☕", label: "悠閒慢活", count: "每日 3-4 個點", desc: "不趕行程，深度品味當地" },
    { id: "balanced", icon: "🚶", label: "充實平衡", count: "每日 5-6 個點", desc: "經典必去與彈性休息兼具" },
    { id: "hardcore", icon: "🏃", label: "鐵人行軍", count: "每日 7+ 個點", desc: "早出晚歸，極大化景點數量" },
]

// 預算風格
const BUDGET_OPTIONS = [
    { id: "budget", icon: "🏷️", label: "小資高 CP", desc: "平價道地美食與高性價比體驗" },
    { id: "comfort", icon: "🌟", label: "舒適享受", desc: "中高預算，品質餐廳與精緻景點" },
    { id: "luxury", icon: "💎", label: "奢華極致", desc: "米其林頂級美饌與無上限尊榮體驗" },
]

// 交通偏好
const TRANSPORT_OPTIONS = [
    { id: "transit", icon: "🚇", label: "大眾運輸", desc: "地鐵、電車與公車為主" },
    { id: "driving", icon: "🚗", label: "租車自駕", desc: "公路旅行、自駕探險自由度高" },
    { id: "taxi", icon: "🚕", label: "步行 + 計程車", desc: "散步探索，遠程直接叫車" },
]

function calculateDays(start: string, end: string): number {
    try {
        const s = new Date(start)
        const e = new Date(end)
        const diffTime = e.getTime() - s.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
        return Math.max(1, diffDays)
    } catch {
        return 1
    }
}

export function AiGrillMeWizard({ onComplete }: AiGrillMeWizardProps) {
    const { t } = useLanguage()
    const haptic = useHaptic()

    // 步驟控制 (1 ~ 5)
    const [step, setStep] = useState<number>(1)
    const totalSteps = 5

    // Step 1: 目的地與日期
    const [destination, setDestination] = useState("")
    const [startDate, setStartDate] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        return d.toISOString().split('T')[0]
    })
    const [endDate, setEndDate] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() + 5)
        return d.toISOString().split('T')[0]
    })
    const [isCalendarOpen, setIsCalendarOpen] = useState(false)

    // Step 2: 出行組合與人數
    const [companion, setCompanion] = useState("couple")
    const [pax, setPax] = useState<number>(2)

    // Step 3: 旅行神聖使命
    const [selectedMissions, setSelectedMissions] = useState<string[]>(["foodie", "photo"])
    const [customMission, setCustomMission] = useState("")

    // Step 4: 節奏強度與預算
    const [pace, setPace] = useState("balanced")
    const [budget, setBudget] = useState("comfort")

    // Step 5: 交通與必去願望清單
    const [transport, setTransport] = useState("transit")
    const [wishlist, setWishlist] = useState("")

    // 動畫方向
    const [direction, setDirection] = useState<number>(1)

    const toggleMission = (id: string) => {
        haptic.selection()
        setSelectedMissions(prev => 
            prev.includes(id) 
                ? prev.filter(m => m !== id)
                : [...prev, id]
        )
    }

    const handleNext = () => {
        if (step === 1 && !destination.trim()) {
            haptic.error()
            return
        }
        haptic.tap()
        setDirection(1)
        if (step < totalSteps) {
            setStep(s => s + 1)
        } else {
            handleFinish()
        }
    }

    const handleBack = () => {
        haptic.tap()
        setDirection(-1)
        if (step > 1) {
            setStep(s => s - 1)
        }
    }

    // 🚀 組裝 Gemini 3.x 官方最佳實踐的 XML Envelope Prompt
    const handleFinish = () => {
        haptic.success()
        const days = calculateDays(startDate, endDate)
        const companionLabel = COMPANION_OPTIONS.find(c => c.id === companion)?.label || companion
        const missionLabels = selectedMissions.map(m => MISSION_TAGS.find(t => t.id === m)?.label).filter(Boolean).join("、")
        const paceLabel = PACE_OPTIONS.find(p => p.id === pace)?.label || pace
        const budgetLabel = BUDGET_OPTIONS.find(b => b.id === budget)?.label || budget
        const transportLabel = TRANSPORT_OPTIONS.find(t => t.id === transport)?.label || transport

        const holyMissionText = [
            missionLabels ? `核心主題：${missionLabels}` : "",
            customMission.trim() ? `特別心願：${customMission.trim()}` : ""
        ].filter(Boolean).join("；") || "享受在地文化與放鬆探索"

        const xmlPrompt = `<travel_inquiry>
  <destination>${destination.trim()}</destination>
  <date_range>
    <start_date>${startDate}</start_date>
    <end_date>${endDate}</end_date>
    <total_days>${days}</total_days>
  </date_range>
  <party>
    <group_type>${companionLabel}</group_type>
    <pax>${pax}</pax>
  </party>
  <holy_mission>
    ${holyMissionText}
  </holy_mission>
  <pace_and_style>
    <intensity>${paceLabel}</intensity>
    <budget_tier>${budgetLabel}</budget_tier>
    <transport_mode>${transportLabel}</transport_mode>
  </pace_and_style>
  <wishlist>
    ${wishlist.trim() || "請依在地人私房推薦安排精選地標與美食"}
  </wishlist>
</travel_inquiry>`

        const summaryText = `${destination.trim()} ${days}天 · ${pax}人 (${companionLabel}) · ${paceLabel}`
        onComplete(xmlPrompt, summaryText)
    }

    const slideVariants = {
        enter: (dir: number) => ({
            x: dir > 0 ? 30 : -30,
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (dir: number) => ({
            x: dir > 0 ? -30 : 30,
            opacity: 0,
        }),
    }

    return (
        <div className="space-y-4 py-1 select-none">
            {/* 🏷️ iOS Swift Progress Stepper Bar */}
            <div className="space-y-1.5 px-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{t('grill_step_label')} {step} / {totalSteps}</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                        {step === 1 && "📍 目的地與日期"}
                        {step === 2 && "👥 出行成員"}
                        {step === 3 && "✨ 神聖使命"}
                        {step === 4 && "⚡ 節奏與預算"}
                        {step === 5 && "🚇 交通與願望"}
                    </span>
                </div>
                <div className="h-1.5 w-full bg-stone-200/80 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    <motion.div 
                        className="h-full bg-linear-to-r from-amber-500 to-indigo-500 rounded-full"
                        initial={{ width: `${((step - 1) / totalSteps) * 100}%` }}
                        animate={{ width: `${(step / totalSteps) * 100}%` }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                    />
                </div>
            </div>

            {/* 🪟 Step Content Animation Slider */}
            <div className="min-h-72.5 relative overflow-hidden flex flex-col justify-between pt-1">
                <AnimatePresence mode="wait" custom={direction}>
                    {/* STEP 1: 目的地與日期 */}
                    {step === 1 && (
                        <motion.div
                            key="step-1"
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.2 }}
                            className="space-y-3.5"
                        >
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-amber-500" />
                                    {t('grill_q1_dest')}
                                </Label>
                                <Input
                                    value={destination}
                                    onChange={e => setDestination(e.target.value)}
                                    placeholder="例如：日本東京、京都、沖繩、首爾..."
                                    className="h-11 rounded-xl bg-stone-100 dark:bg-slate-800"
                                    autoFocus
                                />
                                
                                {/* 推薦目的地膠囊 */}
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {POPULAR_DESTINATIONS.map(p => (
                                        <button
                                            key={p.name}
                                            type="button"
                                            onClick={() => {
                                                haptic.selection()
                                                setDestination(p.name)
                                            }}
                                            className={cn(
                                                "px-2.5 py-1 text-xs rounded-full border transition-all cursor-pointer select-none active:scale-95",
                                                destination === p.name
                                                    ? "bg-amber-500 text-white border-amber-600 font-bold shadow-xs"
                                                    : "bg-stone-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-stone-200/80 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-slate-700"
                                            )}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 日期選擇膠囊 */}
                            <div className="space-y-1.5 pt-1">
                                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                    <CalendarIcon className="w-3.5 h-3.5 text-amber-500" />
                                    {t('travel_dates')}
                                </Label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        haptic.selection()
                                        setIsCalendarOpen(true)
                                    }}
                                    className="w-full h-11 px-3.5 rounded-xl bg-stone-100 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 flex items-center justify-between hover:bg-stone-200/60 dark:hover:bg-slate-700/60 active:scale-[0.99] transition-all cursor-pointer select-none"
                                >
                                    <div className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                                        <CalendarIcon className="w-3.5 h-3.5 text-amber-500" />
                                        <span>{startDate} ~ {endDate}</span>
                                    </div>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-400/20 text-amber-600 dark:text-amber-400 font-bold">
                                        {calculateDays(startDate, endDate)} {t('days_suffix')}
                                    </span>
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 2: 出行成員與同行關係 */}
                    {step === 2 && (
                        <motion.div
                            key="step-2"
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.2 }}
                            className="space-y-3.5"
                        >
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-amber-500" />
                                    {t('grill_q2_companions')}
                                </Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {COMPANION_OPTIONS.map(opt => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => {
                                                haptic.selection()
                                                setCompanion(opt.id)
                                                if (opt.id === "solo") setPax(1)
                                                if (opt.id === "couple") setPax(2)
                                            }}
                                            className={cn(
                                                "p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer active:scale-98",
                                                companion === opt.id
                                                    ? "bg-amber-500/10 dark:bg-amber-400/15 border-amber-500 dark:border-amber-400 shadow-2xs"
                                                    : "bg-stone-100 dark:bg-slate-800/80 border-stone-200 dark:border-slate-700 hover:bg-stone-200/50 dark:hover:bg-slate-700/50"
                                            )}
                                        >
                                            <span className="text-xl shrink-0">{opt.icon}</span>
                                            <div className="space-y-0.5">
                                                <div className={cn(
                                                    "text-xs font-bold",
                                                    companion === opt.id ? "text-amber-600 dark:text-amber-400" : "text-slate-800 dark:text-slate-200"
                                                )}>{opt.label}</div>
                                                <div className="text-[10px] text-slate-400 leading-tight">{opt.desc}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 人數計數器 */}
                            <div className="flex items-center justify-between p-3 rounded-xl bg-stone-100 dark:bg-slate-800 border border-stone-200 dark:border-slate-700">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">出行總人數</span>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        disabled={pax <= 1}
                                        onClick={() => {
                                            haptic.tap()
                                            setPax(p => Math.max(1, p - 1))
                                        }}
                                        className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 border border-stone-200 dark:border-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer"
                                    >
                                        <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-base font-bold font-mono text-slate-900 dark:text-slate-100 min-w-6 text-center">{pax}</span>
                                    <button
                                        type="button"
                                        disabled={pax >= 20}
                                        onClick={() => {
                                            haptic.tap()
                                            setPax(p => Math.min(20, p + 1))
                                        }}
                                        className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 border border-stone-200 dark:border-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 3: 旅行神聖使命 */}
                    {step === 3 && (
                        <motion.div
                            key="step-3"
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.2 }}
                            className="space-y-3.5"
                        >
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                    {t('grill_q3_mission')}
                                </Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {MISSION_TAGS.map(tag => {
                                        const isSelected = selectedMissions.includes(tag.id)
                                        return (
                                            <button
                                                key={tag.id}
                                                type="button"
                                                onClick={() => toggleMission(tag.id)}
                                                className={cn(
                                                    "p-2.5 rounded-xl border flex items-center gap-2 transition-all cursor-pointer active:scale-98 text-left",
                                                    isSelected
                                                        ? "bg-amber-500/10 dark:bg-amber-400/15 border-amber-500 dark:border-amber-400 text-amber-700 dark:text-amber-300 font-bold shadow-2xs"
                                                        : "bg-stone-100 dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-stone-200/60"
                                                )}
                                            >
                                                <span className="text-lg">{tag.icon}</span>
                                                <span className="text-xs">{tag.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                    自訂專屬心願或紀念日 (選填)
                                </Label>
                                <Input
                                    value={customMission}
                                    onChange={e => setCustomMission(e.target.value)}
                                    placeholder="例如：慶祝 30 歲生日、浪漫求婚、想吃米其林..."
                                    className="h-10 text-xs rounded-xl bg-stone-100 dark:bg-slate-800"
                                />
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 4: 節奏強度與預算風格 */}
                    {step === 4 && (
                        <motion.div
                            key="step-4"
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.2 }}
                            className="space-y-3.5"
                        >
                            {/* 每日節奏 */}
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                                    {t('grill_q4_pace')}
                                </Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {PACE_OPTIONS.map(opt => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => {
                                                haptic.selection()
                                                setPace(opt.id)
                                            }}
                                            className={cn(
                                                "p-2.5 rounded-xl border text-center flex flex-col items-center gap-1 transition-all cursor-pointer active:scale-98",
                                                pace === opt.id
                                                    ? "bg-amber-500/10 dark:bg-amber-400/15 border-amber-500 dark:border-amber-400 text-amber-700 dark:text-amber-300 font-bold shadow-2xs"
                                                    : "bg-stone-100 dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-stone-200/60"
                                            )}
                                        >
                                            <span className="text-xl">{opt.icon}</span>
                                            <span className="text-xs font-bold">{opt.label}</span>
                                            <span className="text-[10px] text-slate-400">{opt.count}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 預算風格 */}
                            <div className="space-y-2 pt-1">
                                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                    {t('grill_q4_budget')}
                                </Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {BUDGET_OPTIONS.map(opt => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => {
                                                haptic.selection()
                                                setBudget(opt.id)
                                            }}
                                            className={cn(
                                                "p-2.5 rounded-xl border text-center flex flex-col items-center gap-1 transition-all cursor-pointer active:scale-98",
                                                budget === opt.id
                                                    ? "bg-indigo-500/10 dark:bg-indigo-400/15 border-indigo-500 dark:border-indigo-400 text-indigo-700 dark:text-indigo-300 font-bold shadow-2xs"
                                                    : "bg-stone-100 dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-stone-200/60"
                                            )}
                                        >
                                            <span className="text-xl">{opt.icon}</span>
                                            <span className="text-xs font-bold">{opt.label}</span>
                                            <span className="text-[10px] text-slate-400 line-clamp-1">{opt.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 5: 交通偏好與必去願望 */}
                    {step === 5 && (
                        <motion.div
                            key="step-5"
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.2 }}
                            className="space-y-3.5"
                        >
                            {/* 交通方式 */}
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                    <Car className="w-3.5 h-3.5 text-amber-500" />
                                    {t('grill_q5_transport')}
                                </Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {TRANSPORT_OPTIONS.map(opt => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => {
                                                haptic.selection()
                                                setTransport(opt.id)
                                            }}
                                            className={cn(
                                                "p-2.5 rounded-xl border text-center flex flex-col items-center gap-1 transition-all cursor-pointer active:scale-98",
                                                transport === opt.id
                                                    ? "bg-amber-500/10 dark:bg-amber-400/15 border-amber-500 dark:border-amber-400 text-amber-700 dark:text-amber-300 font-bold shadow-2xs"
                                                    : "bg-stone-100 dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-stone-200/60"
                                            )}
                                        >
                                            <span className="text-xl">{opt.icon}</span>
                                            <span className="text-xs font-bold">{opt.label}</span>
                                            <span className="text-[10px] text-slate-400">{opt.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 必去清單 */}
                            <div className="space-y-1.5 pt-1">
                                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                    {t('grill_q5_wishlist')}
                                </Label>
                                <Input
                                    value={wishlist}
                                    onChange={e => setWishlist(e.target.value)}
                                    placeholder="例如：SHIBUYA SKY 日落、六本木夜景、HARBS 蛋糕..."
                                    className="h-11 rounded-xl bg-stone-100 dark:bg-slate-800"
                                />
                                <p className="text-[11px] text-slate-400">
                                    提示：輸入任何你想去或不想錯過的景點、餐廳或地標。
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 🎛️ Navigation Actions (Back & Next / Submit) */}
            <div className="flex items-center gap-2 pt-2 border-t border-stone-200/60 dark:border-slate-800">
                {step > 1 && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleBack}
                        className="h-11 px-4 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                        {t('back')}
                    </Button>
                )}

                <Button
                    type="button"
                    onClick={handleNext}
                    disabled={step === 1 && !destination.trim()}
                    className={cn(
                        "flex-1 h-11 rounded-xl font-bold text-white shadow-md cursor-pointer transition-all active:scale-[0.99] flex items-center justify-center gap-2",
                        step === totalSteps
                            ? "bg-linear-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700"
                            : "bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-900"
                    )}
                >
                    {step === totalSteps ? (
                        <>
                            <Sparkles className="w-4 h-4" />
                            <span>{t('grill_ignite_btn')}</span>
                        </>
                    ) : (
                        <>
                            <span>{t('next_step')}</span>
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </Button>
            </div>

            {/* 📅 12 個月連續日曆彈窗 */}
            <CalendarRangeSheet
                isOpen={isCalendarOpen}
                onOpenChange={setIsCalendarOpen}
                currentStartDate={startDate}
                currentEndDate={endDate}
                onConfirm={async (newStart, newEnd) => {
                    setStartDate(newStart)
                    setEndDate(newEnd)
                    setIsCalendarOpen(false)
                }}
            />
        </div>
    )
}
