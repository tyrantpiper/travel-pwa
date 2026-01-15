'use client'

import { Trip, Activity } from '@/lib/itinerary-types'
import { useState } from 'react'
import { Calendar, MapPin, Clock, ChevronDown, ChevronUp } from 'lucide-react'

interface PublicTripViewProps {
    trip: Trip
}

export default function PublicTripView({ trip }: PublicTripViewProps) {
    const [expandedDay, setExpandedDay] = useState<number | null>(1)

    const toggleDay = (day: number) => {
        setExpandedDay(expandedDay === day ? null : day)
    }

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return ''
        return new Date(dateStr).toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            {/* Header */}
            <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
                <div className="max-w-4xl mx-auto px-4 py-6">
                    {trip.cover_image && (
                        <div className="mb-4 rounded-xl overflow-hidden h-48">
                            <img
                                src={trip.cover_image}
                                alt={trip.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {trip.title}
                    </h1>
                    <div className="flex items-center gap-4 mt-2 text-slate-600 dark:text-slate-400 text-sm">
                        <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(trip.start_date)} - {formatDate(trip.end_date)}
                        </span>
                        <span>
                            {trip.days.length} 天行程
                        </span>
                    </div>
                </div>
            </header>

            {/* Days List */}
            <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
                {trip.days.map((day) => (
                    <div
                        key={day.day}
                        className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"
                    >
                        {/* Day Header */}
                        <button
                            onClick={() => toggleDay(day.day)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                        >
                            <span className="font-semibold text-slate-900 dark:text-white">
                                Day {day.day}
                            </span>
                            <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                <span className="text-sm">{day.activities.length} 個活動</span>
                                {expandedDay === day.day ? (
                                    <ChevronUp className="w-5 h-5" />
                                ) : (
                                    <ChevronDown className="w-5 h-5" />
                                )}
                            </span>
                        </button>

                        {/* Activities */}
                        {expandedDay === day.day && (
                            <div className="border-t border-slate-200 dark:border-slate-700">
                                {day.activities.length === 0 ? (
                                    <p className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                                        尚無活動
                                    </p>
                                ) : (
                                    <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {day.activities.map((activity: Activity) => (
                                            <li key={activity.id} className="px-4 py-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex-shrink-0 text-slate-400 dark:text-slate-500">
                                                        <Clock className="w-4 h-4 mt-0.5" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                                                {activity.time_slot || activity.time}
                                                            </span>
                                                        </div>
                                                        <p className="font-medium text-slate-900 dark:text-white">
                                                            {activity.place_name || activity.place}
                                                        </p>
                                                        {(activity.notes || activity.desc) && (
                                                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                                                {activity.notes || activity.desc}
                                                            </p>
                                                        )}
                                                        {activity.lat && activity.lng && (
                                                            <a
                                                                href={`https://www.google.com/maps?q=${activity.lat},${activity.lng}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mt-1 hover:underline"
                                                            >
                                                                <MapPin className="w-3 h-3" />
                                                                在 Google Maps 中查看
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </main>

            {/* Footer */}
            <footer className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                <p>由 Tabidachi 旅立ち 提供技術支援</p>
            </footer>
        </div>
    )
}
