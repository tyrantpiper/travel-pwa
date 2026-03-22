"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Users, Crown, UserX, Loader2 } from "lucide-react"
import { tripsApi } from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/LanguageContext"

interface TripMember {
    user_id: string
    user_name: string
    user_avatar?: string | null // 🆕 新增頭像欄位
}

interface TripMembersSheetProps {
    tripId: string
    members: TripMember[]
    createdBy: string  // 創建者 user_id
    currentUserId: string  // 當前用戶
    onMemberKicked: () => void  // 踢出後刷新
}

/**
 * 🧑‍🤝‍🧑 行程成員管理 Sheet
 * 
 * 功能:
 * - 查看所有成員
 * - 創建者可以踢出成員
 * - 顯示創建者標示
 */
export function TripMembersSheet({
    tripId,
    members,
    createdBy,
    currentUserId,
    onMemberKicked
}: TripMembersSheetProps) {
    const { t, lang } = useLanguage()
    const zh = lang === 'zh'
    const [isOpen, setIsOpen] = useState(false)
    const [kickingUserId, setKickingUserId] = useState<string | null>(null)
    const [confirmKick, setConfirmKick] = useState<TripMember | null>(null)

    // 🛡️ 魯棒的身分比較 (防禦 UUID/Email/Case 差異)
    const normalizedCurrentId = currentUserId?.toString().trim().toLowerCase()
    const normalizedCreatedBy = createdBy?.toString().trim().toLowerCase()
    const isCreator = normalizedCurrentId && normalizedCreatedBy && normalizedCurrentId === normalizedCreatedBy

    const handleKick = async (member: TripMember) => {
        if (!member.user_id) return
        setKickingUserId(member.user_id)
        try {
            // 🔒 呼叫 API (需傳入當前使用者 ID 用於 Header)
            await tripsApi.kickMember(tripId, member.user_id, currentUserId)
            
            toast.success(zh ? `已將 ${member.user_name} 移出行程` : `Removed ${member.user_name} from trip`)
            setConfirmKick(null)
            onMemberKicked() // 觸發父組件刷新資料
        } catch (error) {
            console.error("🔥 Kick Failed:", error)
            toast.error(error instanceof Error ? error.message : (zh ? "移除失敗" : "Failed to remove"))
        } finally {
            setKickingUserId(null)
        }
    }

    const getInitials = (name: string) => {
        return (name || "?").slice(0, 2).toUpperCase()
    }

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                >
                    <Users className="w-4 h-4 mr-1" />
                    <span className="text-sm font-medium">{members?.length || 0}</span>
                </Button>
            </SheetTrigger>

            <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-3xl flex flex-col p-0 overflow-hidden border-none shadow-2xl">
                <SheetHeader className="p-6 pb-4 border-b shrink-0 bg-white dark:bg-slate-900">
                    <SheetTitle className="flex items-center gap-2 text-xl font-serif">
                        <Users className="w-5 h-5 text-blue-500" />
                        {t('members_title')} <span className="text-slate-400 font-sans text-lg">({members?.length || 0})</span>
                    </SheetTitle>
                </SheetHeader>

                <div className="flex-1 min-h-0 py-4 px-6 space-y-3 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50 pb-12">
                    {members && members.length > 0 ? members.map((member) => {
                        const memberId = member.user_id?.toString().trim().toLowerCase()
                        const isThisCreator = memberId === normalizedCreatedBy
                        const isMe = memberId === normalizedCurrentId
                        const canKick = isCreator && !isThisCreator

                        return (
                            <div
                                key={member.user_id}
                                className={cn(
                                    "flex items-center justify-between p-4 rounded-2xl transition-all duration-200",
                                    isMe 
                                        ? "bg-blue-50 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800/30 shadow-sm" 
                                        : "bg-white border border-slate-100 dark:bg-slate-900 dark:border-slate-800 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)]"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <Avatar className="h-12 w-12 border-2 border-white dark:border-slate-800 shadow-sm">
                                            {member.user_avatar && (
                                                <AvatarImage src={member.user_avatar} className="object-cover" />
                                            )}
                                            <AvatarFallback className={cn(
                                                "text-sm font-bold",
                                                isThisCreator ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                                            )}>
                                                {getInitials(member.user_name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        {isThisCreator && (
                                            <div className="absolute -top-1 -right-1 bg-amber-500 text-white p-0.5 rounded-full border-2 border-white dark:border-slate-800">
                                                <Crown className="w-3 h-3" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                            {member.user_name}
                                            {isMe && <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-medium ml-1">YOU</span>}
                                        </p>
                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                            {isThisCreator ? (zh ? '行程創建者' : 'Trip Creator') : (zh ? '參與成員' : 'Member')}
                                        </p>
                                    </div>
                                </div>

                                {canKick && (
                                    <div className="flex items-center gap-2">
                                        {confirmKick?.user_id === member.user_id ? (
                                            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded-full animate-in slide-in-from-right-2">
                                                <span className="text-xs font-bold text-red-600 dark:text-red-400 mr-1">{zh ? '確定移除?' : 'Remove?'}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-2 text-slate-500 hover:text-slate-700 bg-white shadow-sm rounded-full text-xs"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirmKick(null);
                                                    }}
                                                    disabled={kickingUserId === member.user_id}
                                                >
                                                    {t('cancel')}
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    className="h-7 px-3 rounded-full text-xs font-bold shadow-sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleKick(member);
                                                    }}
                                                    disabled={kickingUserId === member.user_id}
                                                >
                                                    {kickingUserId === member.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : (zh ? '確認' : 'Confirm')}
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-10 w-10 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setConfirmKick(member);
                                                }}
                                                disabled={kickingUserId === member.user_id}
                                            >
                                                {kickingUserId === member.user_id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <UserX className="w-5 h-5" />
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    }) : (
                        <div className="text-center py-12 text-slate-400">
                            <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
                            <p className="text-lg">{t('members_nobody')}</p>
                        </div>
                    )}
                </div>

            </SheetContent>
        </Sheet>
    )
}
