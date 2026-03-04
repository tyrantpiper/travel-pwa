"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
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

    const isCreator = currentUserId === createdBy

    const handleKick = async (member: TripMember) => {
        setKickingUserId(member.user_id)
        try {
            await tripsApi.kickMember(tripId, member.user_id, currentUserId)
            toast.success(zh ? `已將 ${member.user_name} 移出行程` : `Removed ${member.user_name} from trip`)
            setConfirmKick(null)
            onMemberKicked()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : (zh ? "踢出失敗" : "Failed to remove"))
        } finally {
            setKickingUserId(null)
        }
    }

    const getInitials = (name: string) => {
        return name.slice(0, 2).toUpperCase()
    }

    return (
        <>
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    >
                        <Users className="w-4 h-4 mr-1" />
                        <span className="text-sm">{members.length}</span>
                    </Button>
                </SheetTrigger>

                <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-3xl flex flex-col p-0 overflow-hidden">
                    <SheetHeader className="p-6 pb-4 border-b shrink-0">
                        <SheetTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            {t('members_title')} ({members.length})
                        </SheetTitle>
                    </SheetHeader>

                    <div className="flex-1 py-4 px-6 space-y-2 overflow-y-auto">
                        {members.map((member) => {
                            const isThisCreator = member.user_id === createdBy
                            const isMe = member.user_id === currentUserId
                            const canKick = isCreator && !isThisCreator

                            return (
                                <div
                                    key={member.user_id}
                                    className={cn(
                                        "flex items-center justify-between p-3 rounded-xl",
                                        isMe ? "bg-blue-50" : "bg-slate-50"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 border border-slate-200 bg-white">
                                            {/* 🆕 顯示頭像圖片 */}
                                            {member.user_avatar && (
                                                <AvatarImage src={member.user_avatar} className="object-cover" />
                                            )}
                                            <AvatarFallback className={cn(
                                                "text-sm font-medium",
                                                isThisCreator ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"
                                            )}>
                                                {getInitials(member.user_name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-medium text-slate-900 flex items-center gap-1.5">
                                                {member.user_name}
                                                {isMe && <span className="text-xs text-blue-500">{zh ? '(我)' : '(Me)'}</span>}
                                                {isThisCreator && (
                                                    <Crown className="w-4 h-4 text-amber-500" />
                                                )}
                                            </p>
                                            {isThisCreator && (
                                                <p className="text-xs text-slate-500">{zh ? '行程創建者' : 'Trip Creator'}</p>
                                            )}
                                        </div>
                                    </div>

                                    {canKick && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => setConfirmKick(member)}
                                            disabled={kickingUserId === member.user_id}
                                        >
                                            {kickingUserId === member.user_id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <UserX className="w-4 h-4" />
                                            )}
                                        </Button>
                                    )}
                                </div>
                            )
                        })}

                        {members.length === 0 && (
                            <div className="text-center py-8 text-slate-400">
                                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>{t('members_nobody')}</p>
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* 踢出確認對話框 */}
            <AlertDialog open={!!confirmKick} onOpenChange={() => setConfirmKick(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{zh ? '確認移除成員？' : 'Remove Member?'}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {zh ? '確定要將' : 'Are you sure you want to remove'} <strong>{confirmKick?.user_name}</strong> {zh ? '從此行程中移除嗎？' : 'from this trip?'}
                            <br />
                            {zh ? '對方將無法再查看此行程。' : 'They will no longer be able to view this trip.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => confirmKick && handleKick(confirmKick)}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            {zh ? '確認移除' : 'Confirm Remove'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
