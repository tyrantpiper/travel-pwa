"use client"

import { useState, useCallback, useRef } from "react"
import { CheckSquare, Square, Plus, X, Check, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useHaptic } from "@/lib/hooks"
import { toast } from "sonner"

// Types
interface ChecklistItem {
    id: string
    text: string
    checked: boolean
}

interface EditableDailyChecklistProps {
    tripId: string
    day: number
    items: ChecklistItem[]
    onUpdate: (items: ChecklistItem[]) => Promise<boolean>
    readOnly?: boolean
}

export default function EditableDailyChecklist({
    tripId: _tripId,
    day: _day,
    items,
    onUpdate,
    readOnly = false
}: EditableDailyChecklistProps) {
    const haptic = useHaptic()
    const [localItems, setLocalItems] = useState<ChecklistItem[]>(items || [])
    const [isAdding, setIsAdding] = useState(false)
    const [newItemText, setNewItemText] = useState("")
    const [isUpdating, setIsUpdating] = useState(false)

    // Debounce ref for toggle updates
    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    // 生成 UUID
    const generateId = () => crypto.randomUUID()

    // 切換勾選狀態 (with debounce)
    const toggleItem = useCallback(async (id: string) => {
        if (readOnly || isUpdating) return

        haptic.tap()

        // 樂觀更新本地狀態
        const newItems = localItems.map(item =>
            item.id === id ? { ...item, checked: !item.checked } : item
        )
        setLocalItems(newItems)

        // Debounce API 呼叫
        if (debounceRef.current) {
            clearTimeout(debounceRef.current)
        }

        debounceRef.current = setTimeout(async () => {
            setIsUpdating(true)
            try {
                const success = await onUpdate(newItems)
                if (!success) {
                    // 回滾
                    setLocalItems(localItems)
                    toast.error("更新失敗")
                }
            } catch (_e) {
                setLocalItems(localItems)
                toast.error("更新失敗")
            } finally {
                setIsUpdating(false)
            }
        }, 500)
    }, [localItems, onUpdate, readOnly, isUpdating, haptic])

    // 新增項目
    const addItem = async () => {
        if (!newItemText.trim()) return

        haptic.success()
        const newItem: ChecklistItem = {
            id: generateId(),
            text: newItemText.trim(),
            checked: false
        }

        const newItems = [...localItems, newItem]
        setLocalItems(newItems)
        setNewItemText("")
        setIsAdding(false)

        setIsUpdating(true)
        try {
            const success = await onUpdate(newItems)
            if (!success) {
                setLocalItems(localItems)
                toast.error("新增失敗")
            } else {
                toast.success("已新增項目")
            }
        } catch (_e) {
            setLocalItems(localItems)
            toast.error("新增失敗")
        } finally {
            setIsUpdating(false)
        }
    }

    // 刪除項目
    const removeItem = async (id: string) => {
        haptic.tap()
        const newItems = localItems.filter(item => item.id !== id)
        setLocalItems(newItems)

        setIsUpdating(true)
        try {
            const success = await onUpdate(newItems)
            if (!success) {
                setLocalItems(localItems)
                toast.error("刪除失敗")
            }
        } catch (_e) {
            setLocalItems(localItems)
            toast.error("刪除失敗")
        } finally {
            setIsUpdating(false)
        }
    }

    // 計算完成進度
    const completedCount = localItems.filter(item => item.checked).length
    const totalCount = localItems.length
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    return (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-xl p-4 border border-indigo-100 dark:border-indigo-900/50">
            {/* 標題列 */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                        行前清單
                    </span>
                    {totalCount > 0 && (
                        <span className="text-xs text-indigo-500 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded-full">
                            {completedCount}/{totalCount} ({progressPercent}%)
                        </span>
                    )}
                </div>
                {!readOnly && !isAdding && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsAdding(true)}
                        className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                    >
                        <Plus className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {/* 進度條 */}
            {totalCount > 0 && (
                <div className="h-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-full mb-3 overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            )}

            {/* 清單項目 */}
            <div className="space-y-1">
                {localItems.length === 0 && !isAdding && (
                    <div className="text-center py-4 text-indigo-400 dark:text-indigo-500 text-sm">
                        尚無清單項目
                    </div>
                )}

                {localItems.map(item => (
                    <div
                        key={item.id}
                        className={`group flex items-center gap-2 p-2 rounded-lg transition-all cursor-pointer
                            ${item.checked
                                ? 'bg-indigo-100/50 dark:bg-indigo-900/30'
                                : 'hover:bg-white/50 dark:hover:bg-white/5'
                            }`}
                        onClick={() => toggleItem(item.id)}
                    >
                        {/* Checkbox */}
                        <div className={`flex-shrink-0 transition-transform duration-200 ${item.checked ? 'scale-110' : ''}`}>
                            {item.checked ? (
                                <CheckSquare className="w-5 h-5 text-indigo-500" />
                            ) : (
                                <Square className="w-5 h-5 text-indigo-300 dark:text-indigo-600" />
                            )}
                        </div>

                        {/* 文字 */}
                        <span className={`flex-1 text-sm transition-all ${item.checked
                            ? 'line-through text-indigo-400 dark:text-indigo-500'
                            : 'text-indigo-700 dark:text-indigo-200'
                            }`}>
                            {item.text}
                        </span>

                        {/* 刪除按鈕 */}
                        {!readOnly && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    removeItem(item.id)
                                }}
                                className="flex-shrink-0 p-1 rounded text-indigo-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                disabled={isUpdating}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}

                {/* 新增輸入框 */}
                {isAdding && (
                    <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-indigo-200 dark:border-indigo-700">
                        <Square className="w-5 h-5 text-indigo-300" />
                        <Input
                            value={newItemText}
                            onChange={(e) => setNewItemText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') addItem()
                                if (e.key === 'Escape') {
                                    setIsAdding(false)
                                    setNewItemText("")
                                }
                            }}
                            placeholder="輸入待辦事項..."
                            className="flex-1 h-8 text-sm border-0 focus-visible:ring-0 bg-transparent"
                            autoFocus
                        />
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={addItem}
                            disabled={!newItemText.trim() || isUpdating}
                            className="h-7 w-7 p-0 text-indigo-600 hover:bg-indigo-100"
                        >
                            <Check className="w-4 h-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                setIsAdding(false)
                                setNewItemText("")
                            }}
                            className="h-7 w-7 p-0 text-slate-400 hover:bg-slate-100"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
