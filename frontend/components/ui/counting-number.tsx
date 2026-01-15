"use client"

import { useEffect } from "react"
import { motion, useSpring, useTransform } from "framer-motion"

interface CountingNumberProps {
    value: number
    prefix?: string
    className?: string
    duration?: number
}

export function CountingNumber({ value, prefix = "", className = "", duration: _duration = 0.5 }: CountingNumberProps) {
    const spring = useSpring(value, { mass: 0.8, stiffness: 75, damping: 15 })
    const display = useTransform(spring, (current) => {
        // Smart formatting logic mirroring the chart
        if (current < 10000) {
            return `${prefix}${Math.round(current).toLocaleString()}`
        } else if (current < 1000000) {
            return `${prefix}${Math.round(current / 1000)}K`
        } else {
            return `${prefix}${(current / 1000000).toFixed(1)}M`
        }
    })

    useEffect(() => {
        spring.set(value)
    }, [value, spring])

    return <motion.span className={className}>{display}</motion.span>
}
