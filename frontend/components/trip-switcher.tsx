"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { Check, ChevronsUpDown, Map, Edit3, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTripContext } from "@/lib/trip-context"
import { toast } from "sonner"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export function TripSwitcher({
    className,
    pencilPosition = "right"
}: {
    className?: string,
    pencilPosition?: "left" | "right"
}) {
    const { trips, activeTripId, setActiveTripId, mutate } = useTripContext()
    const activeTrip = trips.find((t) => t.id === activeTripId)

    // 編輯狀態
    const [isEditing, setIsEditing] = useState(false)
    const [newTitle, setNewTitle] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    // 自動聚焦輸入框
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    // 開始編輯
    const startEdit = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!activeTrip) return
        setNewTitle(activeTrip.title || "")
        setIsEditing(true)
    }

    // 儲存標題
    const handleSave = async () => {
        if (!newTitle.trim() || !activeTripId) {
            toast.warning("標題不能為空")
            return
        }
        if (newTitle.trim() === activeTrip?.title) {
            setIsEditing(false)
            return
        }

        setIsSaving(true)
        try {
            const res = await fetch(`${API_BASE}/api/trips/${activeTripId}/title`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newTitle.trim() })
            })
            if (!res.ok) throw new Error("API failed")

            mutate()  // 刷新行程列表
            toast.success("標題已更新")
            setIsEditing(false)
        } catch {
            toast.error("更新失敗")
        } finally {
            setIsSaving(false)
        }
    }

    // 取消編輯
    const handleCancel = () => {
        setIsEditing(false)
        setNewTitle("")
    }

    // 鍵盤事件處理
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            handleSave()
        } else if (e.key === "Escape") {
            handleCancel()
        }
    }

    // 編輯模式 UI
    if (isEditing && activeTrip) {
        return (
            <div className="flex items-center gap-2">
                <Input
                    ref={inputRef}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => {
                        // 延遲取消，讓按鈕點擊有機會觸發
                        setTimeout(() => {
                            if (!isSaving) handleCancel()
                        }, 150)
                    }}
                    className="h-8 text-lg font-bold font-serif border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                    placeholder="輸入行程名稱..."
                    disabled={isSaving}
                />
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-green-600 hover:bg-green-50"
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    <Check className="w-4 h-4" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-slate-400 hover:bg-slate-100"
                    onClick={handleCancel}
                    disabled={isSaving}
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>
        )
    }

    const pencilButton = activeTrip && (
        <button
            onClick={startEdit}
            className="p-1.5 rounded-full text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
            title="編輯行程名稱"
        >
            <Edit3 className="w-4 h-4" />
        </button>
    )

    return (
        <div className="flex items-center gap-2 flex-wrap max-w-full">
            {pencilPosition === "left" && pencilButton}

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-label="Select a trip"
                        className={cn("justify-between rounded-full bg-white/90 backdrop-blur-sm shadow-sm border-slate-200", className)}
                    >
                        <div className="flex items-center gap-2 truncate">
                            <Map className="mr-2 h-4 w-4 text-blue-500 shrink-0" />
                            <span className="truncate">{activeTrip?.title || "Select a trip"}</span>
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

            {pencilPosition === "right" && pencilButton}
        </div>
    )
}
