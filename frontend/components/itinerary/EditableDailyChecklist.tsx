"use client"

import { useState, useCallback, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckSquare, Square, Plus, X, Check, ListChecks, Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useHaptic } from "@/lib/hooks"
import { toast } from "sonner"

// Types
interface ChecklistItem {
    id: string
    text: string
    checked: boolean
    is_private?: boolean
    private_owner_id?: string
}

interface EditableDailyChecklistProps {
    tripId: string
    day: number
    items: ChecklistItem[]
    onUpdate: (items: ChecklistItem[]) => Promise<boolean>
    readOnly?: boolean
    userId?: string
}

export default function EditableDailyChecklist({
    tripId: _tripId,
    day: _day,
    items,
    onUpdate,
    readOnly = false,
    userId
}: EditableDailyChecklistProps) {
    const haptic = useHaptic()
    const [localItems, setLocalItems] = useState<ChecklistItem[]>(items || [])
    const [isAdding, setIsAdding] = useState(false)
    const [newItemText, setNewItemText] = useState("")
    const [isUpdating, setIsUpdating] = useState(false)

    // 🆕 Per-item processing state for anti-spam
    const [processingItems, setProcessingItems] = useState<Set<string>>(new Set())

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
        // 🛡️ Anti-spam: skip if already processing
        if (processingItems.has(id)) return

        haptic.tap()
        setProcessingItems(prev => new Set(prev).add(id))
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
            setProcessingItems(prev => {
                const next = new Set(prev)
                next.delete(id)
                return next
            })
        }
    }

    // 🆕 Toggle privacy for checklist items
    const handleTogglePrivacy = async (id: string) => {
        // 🛡️ Anti-spam: skip if already processing
        if (processingItems.has(id)) return

        haptic.tap()
        setProcessingItems(prev => new Set(prev).add(id))
        const newItems = localItems.map(item =>
            item.id === id ? {
                ...item,
                is_private: !item.is_private,
                private_owner_id: !item.is_private ? userId : undefined
            } : item
        )
        setLocalItems(newItems)

        setIsUpdating(true)
        try {
            const success = await onUpdate(newItems)
            if (!success) {
                setLocalItems(localItems)
                toast.error("更新失敗")
            } else {
                const item = newItems.find(i => i.id === id)
                toast.success(item?.is_private ? "已設為私人" : "已設為公開")
            }
        } catch (_e) {
            setLocalItems(localItems)
            toast.error("更新失敗")
        } finally {
            setIsUpdating(false)
            setProcessingItems(prev => {
                const next = new Set(prev)
                next.delete(id)
                return next
            })
        }
    }

    // 計算完成進度
    const completedCount = localItems.filter(item => item.checked).length
    const totalCount = localItems.length
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    // 🆕 排序邏輯：已勾選項目移到最上面，保留組內原始順序
    const sortedItems = useMemo(() => {
        return [...localItems].sort((a, b) => {
            // 已勾選在前
            if (a.checked !== b.checked) return a.checked ? -1 : 1
            // 同組內保持原始順序 (依據在 localItems 中的位置)
            return localItems.indexOf(a) - localItems.indexOf(b)
        })
    }, [localItems])

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

                <AnimatePresence mode="popLayout">
                    {sortedItems.map(item => (
                        <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{
                                layout: { type: "spring", stiffness: 500, damping: 35 },
                                opacity: { duration: 0.15 }
                            }}
                            className={`group flex items-center gap-2 p-2 rounded-lg transition-colors cursor-pointer
                                ${item.checked
                                    ? 'bg-indigo-100/50 dark:bg-indigo-900/30'
                                    : 'hover:bg-white/50 dark:hover:bg-white/5'
                                }
                                ${item.is_private ? 'opacity-60 border border-dashed border-indigo-200 dark:border-indigo-700' : ''}`}
                            onClick={() => toggleItem(item.id)}
                        >
                            {/* Checkbox */}
                            <motion.div
                                className="flex-shrink-0"
                                animate={{ scale: item.checked ? 1.1 : 1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                            >
                                {item.checked ? (
                                    <CheckSquare className="w-5 h-5 text-indigo-500" />
                                ) : (
                                    <Square className="w-5 h-5 text-indigo-300 dark:text-indigo-600" />
                                )}
                            </motion.div>

                            {/* 文字 */}
                            <span className={`flex-1 text-sm transition-all ${item.checked
                                ? 'line-through text-indigo-400 dark:text-indigo-500'
                                : 'text-indigo-700 dark:text-indigo-200'
                                }`}>
                                {item.is_private && <EyeOff className="w-3 h-3 inline mr-1 text-indigo-400" />}
                                {item.text}
                            </span>

                            {/* 隱私切換 + 刪除按鈕 */}
                            {!readOnly && (
                                <>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleTogglePrivacy(item.id)
                                        }}
                                        className={`flex-shrink-0 p-1 rounded transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center ${processingItems.has(item.id) ? 'opacity-50 cursor-not-allowed' :
                                                item.is_private ? 'text-amber-500 hover:text-amber-600' : 'text-indigo-300 hover:text-indigo-500'
                                            }`}
                                        disabled={processingItems.has(item.id) || isUpdating}
                                        title={item.is_private ? "設為公開" : "設為私人"}
                                    >
                                        {processingItems.has(item.id) ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : item.is_private ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            removeItem(item.id)
                                        }}
                                        className={`flex-shrink-0 p-1 rounded text-indigo-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center ${processingItems.has(item.id) ? 'opacity-50 cursor-not-allowed' : ''
                                            }`}
                                        disabled={processingItems.has(item.id) || isUpdating}
                                    >
                                        {processingItems.has(item.id) ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <X className="w-4 h-4" />
                                        )}
                                    </button>
                                </>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>

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
