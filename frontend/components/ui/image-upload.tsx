"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Camera, Loader2, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

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
    const [progress, setProgress] = useState(0)
    const [previewOpen, setPreviewOpen] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setLoading(true)
        setProgress(0)
        try {
            const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
            const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY

            if (!cloudName || !apiKey) {
                console.error("Missing Cloudinary env vars:", { cloudName: !!cloudName, apiKey: !!apiKey })
                toast.error(`環境變數缺失！請確認 .env.local 並重啟前端。`)
                setLoading(false)
                return
            }

            const timestamp = Math.round((new Date).getTime() / 1000);
            const paramsToSign = { timestamp, folder };

            const res = await fetch("/api/sign-cloudinary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paramsToSign }),
            });

            if (!res.ok) {
                const errText = await res.text()
                console.error("Sign API error:", errText)
                toast.error(`簽名 API 錯誤: ${res.status}`)
                setLoading(false)
                return
            }

            const { signature } = await res.json();

            const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
            const data = new FormData()
            data.append("file", file)
            data.append("timestamp", timestamp.toString())
            data.append("folder", folder)
            data.append("signature", signature)
            data.append("api_key", apiKey)

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

    const handleRemove = () => {
        onRemove?.()
        onChange("")
    }

    return (
        <>
            <div className={cn("relative flex items-center gap-3", className)}>
                {/* 已上傳的圖片 - 點擊可預覽 */}
                {value && (
                    <div className="flex flex-col items-center gap-1">
                        <div
                            className="relative h-16 w-16 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                            onClick={() => setPreviewOpen(true)}
                        >
                            <Image src={value} alt="Upload" fill className="object-cover" unoptimized />
                        </div>
                        {/* 移除按鈕 - 在圖片下方 */}
                        <button
                            type="button"
                            onClick={handleRemove}
                            className="text-[10px] text-slate-400 hover:text-red-500 flex items-center gap-0.5 border border-dashed border-slate-300 hover:border-red-400 px-1.5 py-0.5 rounded transition-colors"
                        >
                            <Trash2 className="w-3 h-3" />
                            移除
                        </button>
                    </div>
                )}

                {/* 上傳按鈕 - 永遠顯示（可以上傳/替換圖片）*/}
                {icon && className?.includes("rounded-full") ? (
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
                        className="h-16 w-16 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-colors shrink-0"
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

            {/* 全螢幕預覽 Dialog */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/90 border-0">
                    <VisuallyHidden>
                        <DialogTitle>圖片預覽</DialogTitle>
                    </VisuallyHidden>
                    {value && (
                        <Image
                            src={value}
                            alt="Preview"
                            fill
                            className="object-contain cursor-pointer"
                            onClick={() => setPreviewOpen(false)}
                            unoptimized
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
