# UI Component Templates (React 19 + Tailwind CSS v4)

## 1. Basic Template (Card / Presentational)

```tsx
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface {{ComponentName}}Props extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
}

/**
 * {{ComponentName}}
 * [Description]
 */
export function {{ComponentName}}({
  className,
  children,
  ...props
}: {{ComponentName}}Props) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xs transition-colors",
        "dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
```

---

## 2. Animated Template (Framer Motion)

```tsx
"use client"

import * as React from "react"
import { motion, AnimatePresence, type HTMLMotionProps } from "framer-motion"
import { cn } from "@/lib/utils"

export interface {{ComponentName}}Props extends HTMLMotionProps<"div"> {
  isVisible?: boolean
  children?: React.ReactNode
}

/**
 * {{ComponentName}}
 * [Description with micro-interaction]
 */
export function {{ComponentName}}({
  className,
  isVisible = true,
  children,
  ...props
}: {{ComponentName}}Props) {
  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100",
            className
          )}
          {...props}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

---

## 3. Interactive Template (State & Action)

```tsx
"use client"

import * as React from "react"
import { useState, useCallback } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface {{ComponentName}}Props {
  className?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

/**
 * {{ComponentName}}
 * [Interactive component with accessible state handling]
 */
export function {{ComponentName}}({
  className,
  defaultValue = "",
  onValueChange,
}: {{ComponentName}}Props) {
  const [value, setValue] = useState(defaultValue)

  const handleUpdate = useCallback(
    (nextVal: string) => {
      setValue(nextVal)
      onValueChange?.(nextVal)
    },
    [onValueChange]
  )

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <button
        type="button"
        whileTap={{ scale: 0.98 }}
        className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        onClick={() => handleUpdate("toggled")}
      >
        Action
      </button>
    </div>
  )
}
```

---

## 4. Form Input Template

```tsx
"use client"

import * as React from "react"
import { forwardRef } from "react"
import { cn } from "@/lib/utils"

export interface {{ComponentName}}Props
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

/**
 * {{ComponentName}}
 * [Accessible form input component compliant with Touch Targets & Dark Mode]
 */
export const {{ComponentName}} = forwardRef<HTMLInputElement, {{ComponentName}}Props>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || React.useId()

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            "min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors",
            "focus-visible:border-primary focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none",
            "dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:bg-slate-950",
            error && "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20",
            className
          )}
          {...props}
        />
        {error ? (
          <p id={`${inputId}-error`} className="text-xs font-medium text-red-500">
            {error}
          </p>
        ) : helperText ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
        ) : null}
      </div>
    )
  }
)

{{ComponentName}}.displayName = "{{ComponentName}}"
```
