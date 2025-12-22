"use client"

import { forwardRef } from "react"
import { Button, type buttonVariants } from "@/components/ui/button"
import { useTheme } from "@/lib/ThemeContext"
import { cn } from "@/lib/utils"
import type { VariantProps } from "class-variance-authority"

interface ThemedButtonProps extends React.ComponentProps<typeof Button> {
    useThemeColor?: boolean // 是否使用主題色，預設 true
}

/**
 * 主題化按鈕元件
 * 預設按鈕使用主題色作為背景色
 */
export const ThemedButton = forwardRef<HTMLButtonElement, ThemedButtonProps>(
    ({ className, variant = "default", useThemeColor = true, style, ...props }, ref) => {
        const { currentTheme, accentColor } = useTheme()

        // 只有 default variant 且 useThemeColor 為 true 時才套用主題色
        const shouldApplyTheme = variant === "default" && useThemeColor && accentColor !== "default"

        return (
            <Button
                ref={ref}
                variant={variant}
                className={cn(
                    shouldApplyTheme && "hover:opacity-90",
                    className
                )}
                style={shouldApplyTheme ? {
                    backgroundColor: currentTheme.primary,
                    borderColor: currentTheme.primary,
                    ...style
                } : style}
                {...props}
            />
        )
    }
)

ThemedButton.displayName = "ThemedButton"
