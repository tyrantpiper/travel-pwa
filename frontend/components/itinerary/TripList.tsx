"use client"

import { Calendar, Trash2, Download, LogOut, Loader2, Hash } from "lucide-react"
import Image from "next/image"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Trip, Activity } from "@/lib/itinerary-types"
import { generateTripPDF, downloadPDF, TripPDFData } from "@/lib/pdf-generator"
import { tripsApi } from "@/lib/api"



interface TripListProps {
    trips: Trip[]
    userId: string | null
    isTripsLoading: boolean
    onSelectTrip: (id: string) => void
    onDeleteTrip: (id: string) => void
    onLeaveTrip: (id: string) => void
    leavingTripId: string | null
}

export function TripList({
    trips,
    userId,
    isTripsLoading,
    onSelectTrip,
    onDeleteTrip,
    onLeaveTrip,
    leavingTripId
}: TripListProps) {

    // PDF Generation Handler
    const handleDownloadPDF = async (trip: Trip) => {
        const toastId: string | number = toast.loading("生成 PDF 中...")
        try {
            // 🔒 Standardized: Use tripsApi.get to include userId/Auth header for private trips
            const fullTrip = await tripsApi.get(trip.id, userId || "")

            const pdfData: TripPDFData = {
                title: fullTrip.title || trip.title,
                startDate: new Date(fullTrip.start_date || trip.start_date).toLocaleDateString(),
                endDate: new Date(fullTrip.end_date || trip.end_date || trip.start_date).toLocaleDateString(),
                coverImage: fullTrip.cover_image,
                days: (fullTrip.days || []).map((d: { day: number; activities?: Activity[] }) => ({
                    day: d.day,
                    date: (() => {
                        const start = new Date(fullTrip.start_date || trip.start_date)
                        start.setDate(start.getDate() + d.day - 1)
                        return start.toLocaleDateString()
                    })(),
                    location: fullTrip.daily_locations?.[d.day]?.name,
                    activities: (d.activities || []).map((a: Activity) => ({
                        time: a.time || "00:00",
                        place: a.place || a.place_name || "",
                        desc: a.desc || a.notes || "",
                        category: a.category || "other",
                        memo: a.memo
                    })),
                    notes: fullTrip.day_notes?.[d.day] || []
                })),
                hotels: fullTrip.hotel_info || []
            }

            const blobUrl = await generateTripPDF(pdfData, (current, total, stage) => {
                toast.loading(`${stage} (${current}/${total})`, { id: toastId })
            })
            toast.dismiss(toastId)
            downloadPDF(blobUrl, `${trip.title || "trip"}.pdf`)
            toast.success("PDF 下載成功！")
        } catch (err) {
            console.error(err)
            toast.dismiss(toastId)
            toast.error("PDF 生成失敗")
        }
    }

    if (isTripsLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                ))}
            </div>
        )
    }

    if (trips.length === 0) {
        return (
            <div className="text-center py-20 bg-white/50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <div className="text-slate-400 mb-2 text-lg">📭</div>
                <p className="text-slate-500">尚無行程</p>
                <p className="text-xs text-slate-400 mt-1">建立新行程並開始你的冒險</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {trips.map((trip: Trip) => (
                <Card key={trip.id} className="p-0 overflow-hidden border-0 shadow-sm transition-transform relative group">
                    <div className="absolute top-2 right-2 z-20">
                        {userId && trip.created_by === userId && (
                            <Button
                                variant="destructive"
                                size="icon"
                                className="w-8 h-8 rounded-full shadow-md bg-red-500 hover:bg-red-600 border border-white/20"
                                onClick={(e) => { e.stopPropagation(); onDeleteTrip(trip.id) }}
                            >
                                <Trash2 className="w-4 h-4 text-white" />
                            </Button>
                        )}
                    </div>
                    <div className="cursor-pointer active:opacity-90" onClick={() => onSelectTrip(trip.id)}>
                        <div className="h-24 bg-slate-800 relative rounded-t-lg overflow-hidden">
                            {trip.cover_image ? (
                                <div className="relative w-full h-full">
                                    <Image src={trip.cover_image} alt="cover" fill className="object-cover opacity-80" unoptimized />
                                </div>
                            ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <div className="absolute bottom-4 left-4 text-white">
                                <h3 className="font-bold text-lg">{trip.title}</h3>
                                <p className="text-xs opacity-80 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(trip.start_date || new Date().toISOString()).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="absolute top-3 right-12 bg-slate-800/90 px-2 py-1 rounded text-xs text-white font-mono flex items-center gap-1">
                                <Hash className="w-3 h-3" /> {trip.share_code}
                            </div>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-800 flex justify-between items-center rounded-b-lg">
                            <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 dark:text-slate-400 px-2 py-1 rounded-full">
                                By {trip.creator_name || 'Guest'}
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50 gap-1 px-2 h-7"
                                    onClick={(e) => { e.stopPropagation(); handleDownloadPDF(trip) }}
                                >
                                    <Download className="w-3 h-3" /> PDF
                                </Button>
                                {userId && trip.created_by !== userId && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 gap-1 px-2 h-7"
                                        disabled={leavingTripId === trip.id}
                                        onClick={(e) => { e.stopPropagation(); onLeaveTrip(trip.id) }}
                                    >
                                        {leavingTripId === trip.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />} 退出
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    )
}
