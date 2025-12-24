"use client"

import { useState, useRef } from "react"
import { Camera, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface ImageUploadProps {
    value?: string
    onChange: (url: string) => void
    onRemove?: () => void
    folder?: string
    className?: string
    icon?: React.ReactNode
}

export function ImageUpload({ value, onChange, onRemove, folder = "ryan_travel", className, icon }: ImageUploadProps) {
    const [loading, setLoading] = useState(false)
    // 🆕 v3.5: 上傳進度百分比
    const [progress, setProgress] = useState(0)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setLoading(true)
        setProgress(0)
        try {
            const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
            const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY

            // Debug: Check env vars
            if (!cloudName || !apiKey) {
                console.error("Missing Cloudinary env vars:", { cloudName: !!cloudName, apiKey: !!apiKey })
                toast.error(`環境變數缺失！請確認 .env.local 並重啟前端。\nCloud Name: ${cloudName ? '✅' : '❌'}\nAPI Key: ${apiKey ? '✅' : '❌'}`)
                return
            }

            const timestamp = Math.round((new Date).getTime() / 1000);
            const paramsToSign = { timestamp, folder };

            // Get signature from our API
            const res = await fetch("/api/sign-cloudinary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paramsToSign }),
            });

            if (!res.ok) {
                const errText = await res.text()
                console.error("Sign API error:", errText)
                toast.error(`簽名 API 錯誤: ${res.status}`)
                return
            }

            const { signature } = await res.json();

            // 🆕 Upload to Cloudinary with XMLHttpRequest for progress
            const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
            const data = new FormData()
            data.append("file", file)
            data.append("timestamp", timestamp.toString())
            data.append("folder", folder)
            data.append("signature", signature)
            data.append("api_key", apiKey)

            // 使用 XMLHttpRequest 以獲取上傳進度
            const xhr = new XMLHttpRequest()

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100)
                    setProgress(percent)
                }
            }

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const result = JSON.parse(xhr.responseText)
                    if (result.secure_url) {
                        onChange(result.secure_url)
                        toast.success("圖片上傳成功！")
                    } else {
                        console.error("Cloudinary error:", result)
                        toast.error(`Cloudinary 錯誤: ${result.error?.message || JSON.stringify(result)}`)
                    }
                } else {
                    toast.error(`上傳失敗: ${xhr.status}`)
                }
                setLoading(false)
                setProgress(0)
            }

            xhr.onerror = () => {
                toast.error("圖片上傳失敗")
                setLoading(false)
                setProgress(0)
            }

            xhr.open("POST", url)
            xhr.send(data)

        } catch (error) {
            console.error("Upload error:", error)
            toast.error("圖片上傳失敗")
            setLoading(false)
            setProgress(0)
        }
    }

    return (
        <div className={cn("relative flex items-center gap-4", className)}>
            {value ? (
                <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-slate-200 group shrink-0">
                    <img src={value} alt="Upload" className="h-full w-full object-cover" />
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onRemove?.(); onChange(""); }}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <X className="w-4 h-4 text-white" />
                    </button>
                </div>
            ) : icon && className?.includes("rounded-full") ? (
                // Compact mode: just show a circular button with the icon
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className={cn("flex items-center justify-center cursor-pointer", className)}
                >
                    {loading ? (
                        <span className="text-[10px] font-mono text-blue-500">{progress}%</span>
                    ) : icon}
                </div>
            ) : (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="h-16 w-16 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors shrink-0"
                >
                    {loading ? (
                        <div className="flex flex-col items-center">
                            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                            <span className="text-[10px] text-blue-500 font-mono mt-1">{progress}%</span>
                        </div>
                    ) : (icon || <Camera className="w-5 h-5 text-slate-400" />)}
                </div>
            )}

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleUpload}
            />
        </div>
    )
}
