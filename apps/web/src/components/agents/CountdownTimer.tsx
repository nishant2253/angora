'use client'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface CountdownTimerProps {
  nextRunAt: string | null | undefined
  className?: string
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSecs = Math.floor(ms / 1000)
  const hours = Math.floor(totalSecs / 3600)
  const mins = Math.floor((totalSecs % 3600) / 60)
  const secs = totalSecs % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function CountdownTimer({ nextRunAt, className }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState<number>(0)

  useEffect(() => {
    if (!nextRunAt) {
      setRemaining(0)
      return
    }

    const target = new Date(nextRunAt).getTime()

    const tick = () => {
      const diff = target - Date.now()
      setRemaining(Math.max(0, diff))
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [nextRunAt])

  if (!nextRunAt) return null

  const isWarning = remaining < 60_000 && remaining > 0

  return (
    <span
      className={cn(
        'font-mono text-xs tabular-nums transition-colors duration-300',
        isWarning ? 'text-amber-400 animate-pulse' : 'text-angora-muted',
        className
      )}
    >
      {remaining === 0 ? 'running…' : formatDuration(remaining)}
    </span>
  )
}
