import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-angora-primary/30 bg-angora-primary/10 text-angora-accent',
        secondary: 'border-angora-border bg-angora-surface text-angora-muted',
        destructive: 'border-red-800 bg-red-950 text-red-400',
        outline: 'border-angora-border text-angora-muted',
        success: 'border-emerald-800 bg-emerald-950 text-emerald-400',
        warning: 'border-yellow-800 bg-yellow-950 text-yellow-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
