# Component Templates

## Basic Template

```tsx
"use client"

import { cn } from "@/lib/utils"

interface {{ComponentName}}Props {
    className?: string
    children?: React.ReactNode
}

/**
 * {{ComponentName}}
 * 
 * [Description]
 */
export function {{ComponentName}}({
    className,
    children
}: {{ComponentName}}Props) {
    return (
        <div className={cn("", className)}>
            {children}
        </div>
    )
}
```

---

## Animated Template

```tsx
"use client"

import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface {{ComponentName}}Props {
    className?: string
    isVisible?: boolean
    children?: React.ReactNode
}

/**
 * {{ComponentName}}
 * 
 * [Description with animation]
 */
export function {{ComponentName}}({
    className,
    isVisible = true,
    children
}: {{ComponentName}}Props) {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className={cn("", className)}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    )
}
```

---

## Interactive Template

```tsx
"use client"

import { useState, useCallback } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface {{ComponentName}}Props {
    className?: string
    defaultValue?: string
    onChange?: (value: string) => void
}

/**
 * {{ComponentName}}
 * 
 * [Description with state management]
 */
export function {{ComponentName}}({
    className,
    defaultValue = "",
    onChange
}: {{ComponentName}}Props) {
    const [value, setValue] = useState(defaultValue)

    const handleChange = useCallback((newValue: string) => {
        setValue(newValue)
        onChange?.(newValue)
    }, [onChange])

    return (
        <div className={cn("", className)}>
            {/* Interactive content */}
        </div>
    )
}
```

---

## Form Template

```tsx
"use client"

import { forwardRef } from "react"
import { cn } from "@/lib/utils"

interface {{ComponentName}}Props extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
}

/**
 * {{ComponentName}}
 * 
 * [Form input component]
 */
export const {{ComponentName}} = forwardRef<HTMLInputElement, {{ComponentName}}Props>(
    ({ className, label, error, ...props }, ref) => {
        return (
            <div className="space-y-1">
                {label && (
                    <label className="text-sm font-medium text-slate-700">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={cn(
                        "w-full px-3 py-2 border rounded-lg",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500",
                        error && "border-red-500",
                        className
                    )}
                    {...props}
                />
                {error && (
                    <p className="text-sm text-red-500">{error}</p>
                )}
            </div>
        )
    }
)

{{ComponentName}}.displayName = "{{ComponentName}}"
```

---

## Placeholder Replacements

| Placeholder | Replacement |
|-------------|-------------|
| `{{ComponentName}}` | User-provided PascalCase name |
| `{{component-name}}` | kebab-case filename |
| `[Description]` | AI-generated based on name |
