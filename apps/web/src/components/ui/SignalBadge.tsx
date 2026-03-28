'use client'
import { motion } from 'framer-motion'

type Signal = 'BUY' | 'SELL' | 'HOLD'

const SIGNAL_STYLES: Record<Signal, { bg: string; text: string; border: string; dot: string }> = {
  BUY: {
    bg: 'bg-emerald-950',
    text: 'text-emerald-400',
    border: 'border-emerald-800',
    dot: 'bg-emerald-400',
  },
  SELL: {
    bg: 'bg-red-950',
    text: 'text-red-400',
    border: 'border-red-800',
    dot: 'bg-red-400',
  },
  HOLD: {
    bg: 'bg-yellow-950',
    text: 'text-yellow-400',
    border: 'border-yellow-800',
    dot: 'bg-yellow-400',
  },
}

export function SignalBadge({ signal }: { signal: Signal }) {
  const c = SIGNAL_STYLES[signal]
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${c.bg} ${c.text} ${c.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} animate-pulse`} />
      {signal}
    </motion.span>
  )
}
