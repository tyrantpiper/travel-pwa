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
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setLoading(true)
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

            // Upload to Cloudinary
            const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`

            const data = new FormData()
            data.append("file", file)
            data.append("timestamp", timestamp.toString())
            data.append("folder", folder)
            data.append("signature", signature)
            data.append("api_key", apiKey)

            const uploadRes = await fetch(url, { method: "POST", body: data })
            const result = await uploadRes.json()

            if (result.secure_url) {
                onChange(result.secure_url)
            } else {
                console.error("Cloudinary error:", result)
                toast.error(`Cloudinary 錯誤: ${result.error?.message || JSON.stringify(result)}`)
            }

        } catch (error) {
            console.error("Upload error:", error)
            toast.error("圖片上傳失敗")
        } finally {
            setLoading(false)
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
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
                </div>
            ) : (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="h-16 w-16 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors shrink-0"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : (icon || <Camera className="w-5 h-5 text-slate-400" />)}
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
