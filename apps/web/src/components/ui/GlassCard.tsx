'use client'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  glow?: boolean
  hover?: boolean
}

export function GlassCard({ children, className, glow, hover }: GlassCardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -2, scale: 1.005 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'relative rounded-xl border border-angora-border',
        'bg-gradient-to-br from-angora-surface to-angora-card',
        'backdrop-blur-sm shadow-card',
        'before:absolute before:inset-0 before:rounded-xl before:pointer-events-none',
        'before:bg-gradient-to-b before:from-white/[0.03] before:to-transparent',
        glow && 'shadow-glow-primary',
        className
      )}
    >
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}
