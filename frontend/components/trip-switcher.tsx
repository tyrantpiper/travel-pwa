"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Map, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTripContext } from "@/lib/trip-context"

export function TripSwitcher({ className }: { className?: string }) {
    const { trips, activeTripId, setActiveTripId } = useTripContext()
    const activeTrip = trips.find((t) => t.id === activeTripId)

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-label="Select a trip"
                    className={cn("w-[200px] justify-between rounded-full bg-white/90 backdrop-blur-sm shadow-sm border-slate-200", className)}
                >
                    <div className="flex items-center gap-2 truncate">
                        <Map className="mr-2 h-4 w-4 text-blue-500 shrink-0" />
                        <span className="truncate max-w-[120px]">{activeTrip?.title || "Select a trip"}</span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px] p-0">
                <DropdownMenuLabel className="text-xs text-slate-500 font-normal px-2 py-1.5">My Trips</DropdownMenuLabel>
                {trips.map((trip) => (
                    <DropdownMenuItem
                        key={trip.id}
                        onSelect={() => setActiveTripId(trip.id)}
                        className="text-sm cursor-pointer"
                    >
                        <Check
                            className={cn(
                                "mr-2 h-4 w-4",
                                activeTripId === trip.id ? "opacity-100 text-blue-600" : "opacity-0"
                            )}
                        />
                        {trip.title}
                    </DropdownMenuItem>
                ))}
                {trips.length === 0 && (
                    <div className="p-2 text-xs text-slate-400 text-center">No trips found</div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
