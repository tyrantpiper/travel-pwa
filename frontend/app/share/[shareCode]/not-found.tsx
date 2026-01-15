import Link from 'next/link'

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <div className="text-center px-4">
                <h1 className="text-6xl font-bold text-slate-300 dark:text-slate-600 mb-4">
                    404
                </h1>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                    行程不存在
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                    此分享連結無效或行程已被刪除
                </p>
                <Link
                    href="/"
                    className="inline-block px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                    返回首頁
                </Link>
            </div>
        </div>
    )
}
