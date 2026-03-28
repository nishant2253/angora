'use client'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useEffect } from 'react'

interface StatCardProps {
  label: string
  value: string
  unit?: string
  trend?: number
  color?: string
}

export function StatCard({
  label,
  value,
  unit,
  trend,
  color = '#836EF9',
}: StatCardProps) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, (v) => {
    const num = parseFloat(value)
    // preserve decimal places from the original value string
    const decimals = value.includes('.') ? value.split('.')[1].length : 0
    return v.toFixed(decimals)
  })

  useEffect(() => {
    const controls = animate(count, parseFloat(value), {
      duration: 1.5,
      ease: 'easeOut',
    })
    return controls.stop
  }, [value, count])

  return (
    <div className="relative p-4 rounded-xl border border-angora-border bg-gradient-to-br from-angora-surface to-angora-card overflow-hidden">
      {/* Glow blob */}
      <div
        className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-20 blur-xl"
        style={{ background: color }}
      />
      <p className="text-angora-muted text-xs uppercase tracking-widest mb-2">
        {label}
      </p>
      <div className="flex items-end gap-1">
        <motion.span className="text-2xl font-bold text-white font-mono">
          {rounded}
        </motion.span>
        {unit && (
          <span className="text-angora-muted text-sm mb-0.5">{unit}</span>
        )}
      </div>
      {trend !== undefined && (
        <p
          className={`text-xs mt-1 ${
            trend > 0 ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(2)}%
        </p>
      )}
    </div>
  )
}
