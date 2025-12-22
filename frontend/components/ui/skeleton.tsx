import { cn } from "@/lib/utils"

/**
 * Skeleton - 基礎骨架屏組件
 * 用於在資料載入時顯示佔位符動畫
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("animate-pulse rounded-md bg-slate-200", className)}
            {...props}
        />
    )
}

/**
 * TripCardSkeleton - Trip 卡片的骨架屏
 * 與實際 TripCard 視覺結構一致
 */
export function TripCardSkeleton() {
    return (
        <div className="p-0 overflow-hidden border-0 shadow-sm rounded-lg bg-white">
            {/* Cover image placeholder */}
            <div className="h-24 bg-slate-200 animate-pulse rounded-t-lg" />
            {/* Content placeholder */}
            <div className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
            </div>
        </div>
    )
}

/**
 * ExpenseItemSkeleton - 記帳項目的骨架屏
 */
export function ExpenseItemSkeleton() {
    return (
        <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                </div>
            </div>
            <Skeleton className="h-5 w-16" />
        </div>
    )
}
