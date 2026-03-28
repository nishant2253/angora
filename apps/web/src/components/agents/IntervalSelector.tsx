'use client'
import { cn } from '@/lib/utils'

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const
export type Interval = (typeof INTERVALS)[number]

interface IntervalSelectorProps {
  value: Interval | string
  onChange: (interval: Interval) => void
  disabled?: boolean
  className?: string
}

export function IntervalSelector({ value, onChange, disabled, className }: IntervalSelectorProps) {
  return (
    <div className={cn('flex gap-1 flex-wrap', className)}>
      {INTERVALS.map((interval) => (
        <button
          key={interval}
          disabled={disabled}
          onClick={() => onChange(interval)}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-semibold border transition-all duration-150',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            value === interval
              ? 'bg-angora-primary border-angora-primary text-white shadow-glow-primary'
              : 'bg-transparent border-angora-border text-angora-muted hover:border-angora-primary/60 hover:text-white'
          )}
        >
          {interval}
        </button>
      ))}
    </div>
  )
}
