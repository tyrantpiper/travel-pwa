"use client"

import { useState, useCallback, useRef, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckSquare, Square, Plus, X, Check, ListChecks, Eye, EyeOff, Loader2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useHaptic } from "@/lib/hooks"
import { toast } from "sonner"
import { ChecklistItem } from "@/lib/itinerary-types"

// Types moved to @/lib/itinerary-types

interface EditableDailyChecklistProps {
    tripId: string
    day: number
    items: ChecklistItem[]
    onUpdate: (items: ChecklistItem[]) => Promise<boolean>
    readOnly?: boolean
    userId?: string
}

export default function EditableDailyChecklist({
    tripId: _tripId,  // eslint-disable-line @typescript-eslint/no-unused-vars
    day: _day,        // eslint-disable-line @typescript-eslint/no-unused-vars
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
    // 🆕 編輯模式狀態
    const [isEditing, setIsEditing] = useState(false)
    const [editData, setEditData] = useState<ChecklistItem[]>([])

    // Debounce ref for toggle updates
    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    // 🆕 Track pending optimistic updates to prevent useEffect from overwriting
    const pendingUpdatesCount = useRef(0)

    // 🔧 FIX: Sync local items when props update (async data loading)
    // 🛡️ L4 Protection: Skip sync if user is currently adding an item or saving to prevent "Renew Overwrite"
    useEffect(() => {
        if (pendingUpdatesCount.current > 0 || isAdding) return
        setLocalItems(items || [])
    }, [items, isAdding])

    // 🆕 Cleanup: cancel debounce on unmount to prevent memory leak
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current)
            }
        }
    }, [])

    // 生成 UUID
    const generateId = () => crypto.randomUUID()

    // 切換勾選狀態 (with debounce)
    const toggleItem = useCallback(async (id: string) => {
        if (readOnly || isUpdating) return

        haptic.tap()
        pendingUpdatesCount.current++  // 🆕 Mark update pending

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
            } catch {
                setLocalItems(localItems)
                toast.error("更新失敗")
            } finally {
                setIsUpdating(false)
                pendingUpdatesCount.current--  // 🆕 Clear pending flag
            }
        }, 500)
    }, [localItems, onUpdate, readOnly, isUpdating, haptic])

    // 新增項目
    const addItem = async () => {
        if (!newItemText.trim()) return

        haptic.success()
        pendingUpdatesCount.current++  // 🆕 Mark update pending
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
        } catch {
            setLocalItems(localItems)
            toast.error("新增失敗")
        } finally {
            setIsUpdating(false)
            pendingUpdatesCount.current--  // 🆕 Clear pending flag
        }
    }

    // 刪除項目
    const removeItem = async (id: string) => {
        // 🛡️ Anti-spam: skip if already processing
        if (processingItems.has(id)) return

        haptic.tap()
        pendingUpdatesCount.current++  // 🆕 Mark update pending
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
        } catch {
            setLocalItems(localItems)
            toast.error("刪除失敗")
        } finally {
            setIsUpdating(false)
            pendingUpdatesCount.current--  // 🆕 Clear pending flag
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
        pendingUpdatesCount.current++  // 🆕 Mark update pending
        setProcessingItems(prev => new Set(prev).add(id))
        const newItems: ChecklistItem[] = localItems.map(item =>
            item.id === id ? {
                ...item,
                is_private: !item.is_private,
                // 🧠 Secure ID Assignment: Must use stable UUID
                private_owner_id: !item.is_private ? (userId || localStorage.getItem("user_uuid") || undefined) : undefined
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
        } catch {
            setLocalItems(localItems)
            toast.error("更新失敗")
        } finally {
            setIsUpdating(false)
            pendingUpdatesCount.current--  // 🆕 Clear pending flag
            setProcessingItems(prev => {
                const next = new Set(prev)
                next.delete(id)
                return next
            })
        }
    }

    // 🆕 編輯模式
    const handleStartEdit = () => {
        setEditData([...localItems])
        setIsEditing(true)
        setIsAdding(false)
    }

    const handleSaveEdit = async () => {
        setIsUpdating(true)
        try {
            if (await onUpdate(editData)) {
                setLocalItems(editData)
                setIsEditing(false)
                setEditData([])
                toast.success("已儲存修改")
            } else {
                toast.error("儲存失敗")
            }
        } catch {
            toast.error("儲存失敗")
        } finally {
            setIsUpdating(false)
        }
    }

    const handleCancelEdit = () => {
        setIsEditing(false)
        setEditData([])
    }

    const handleUpdateEditItem = (id: string, text: string) => {
        setEditData(prev => prev.map(item =>
            item.id === id ? { ...item, text } : item
        ))
    }

    // 計算完成進度
    const completedCount = localItems.filter(item => item.checked).length
    const totalCount = localItems.length
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    // 🆕 排序邏輯：1. 私人項目最優先, 2. 已勾選項目次優先, 3. 保持穩定原始順序
    const sortedItems = useMemo(() => {
        return [...localItems].sort((a, b) => {
            // 第一層：私人項目 (is_private) 最置頂
            if (a.is_private !== b.is_private) return a.is_private ? -1 : 1
            // 第二層：已勾選 (checked)
            if (a.checked !== b.checked) return a.checked ? -1 : 1
            // 第三層：保持穩定順序 (依據在 localItems 中的位置)
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
                {!readOnly && !isAdding && !isEditing && (
                    <div className="flex gap-1">
                        {localItems.length > 0 && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleStartEdit}
                                className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                            >
                                <Pencil className="w-3 h-3 mr-1" /> 編輯
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsAdding(true)}
                            className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                )}
                {isEditing && (
                    <div className="flex gap-1">
                        <Button size="sm" className="h-7 text-xs bg-indigo-500 hover:bg-indigo-600 text-white" onClick={handleSaveEdit} disabled={isUpdating}>
                            {isUpdating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />} 儲存
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCancelEdit}>
                            取消
                        </Button>
                    </div>
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
                {localItems.length === 0 && !isAdding && !isEditing && (
                    <div className="text-center py-4 text-indigo-400 dark:text-indigo-500 text-sm">
                        尚無清單項目
                    </div>
                )}

                {/* 編輯模式：顯示所有項目的編輯表單 */}
                {isEditing && editData.map(item => (
                    <div key={item.id} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-indigo-200 dark:border-indigo-700">
                        <Square className="w-5 h-5 text-indigo-300" />
                        <Input
                            className="flex-1 h-8 text-sm border-0 focus-visible:ring-0 bg-transparent"
                            value={item.text}
                            onChange={(e) => handleUpdateEditItem(item.id, e.target.value)}
                        />
                    </div>
                ))}

                {/* 正常模式：顯示清單 */}
                {!isEditing && (
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
                                            className={`flex-shrink-0 p-1 rounded transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center touch-manipulation ${processingItems.has(item.id) ? 'opacity-50 cursor-not-allowed' :
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
                                            className={`flex-shrink-0 p-1 rounded text-indigo-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center touch-manipulation ${processingItems.has(item.id) ? 'opacity-50 cursor-not-allowed' : ''
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
                )}

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
