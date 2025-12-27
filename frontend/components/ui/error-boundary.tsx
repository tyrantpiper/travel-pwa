"use client"

import React, { Component, ReactNode } from "react"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
    children: ReactNode
    fallbackTitle?: string
}

interface State {
    hasError: boolean
    error: Error | null
}

/**
 * ErrorBoundary 錯誤邊界元件
 * 
 * 防止單一元件的錯誤導致整個應用崩潰
 * 提供友善的錯誤訊息和重新整理按鈕
 */
export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // 可以在這裡記錄錯誤到監控服務
        console.error("ErrorBoundary caught an error:", error, errorInfo)
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null })
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[200px] p-6 bg-red-50 rounded-xl border border-red-200">
                    <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                    <h2 className="text-lg font-semibold text-red-700 mb-2">
                        {this.props.fallbackTitle || "出錯了"}
                    </h2>
                    <p className="text-sm text-red-600 mb-4 text-center max-w-md">
                        發生了一些問題，請嘗試重新整理頁面。
                    </p>
                    {process.env.NODE_ENV === "development" && this.state.error && (
                        <pre className="text-xs bg-red-100 p-2 rounded mb-4 max-w-full overflow-auto">
                            {this.state.error.message}
                        </pre>
                    )}
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={this.handleReset}
                            className="text-red-600 border-red-300 hover:bg-red-100"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            重試
                        </Button>
                        <Button
                            onClick={() => window.location.reload()}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            重新整理頁面
                        </Button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
