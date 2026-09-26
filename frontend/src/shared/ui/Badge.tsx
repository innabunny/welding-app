import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export type BadgeTone = 'green' | 'yellow' | 'red' | 'gray' | 'blue'

const tones: Record<BadgeTone, string> = {
  green: 'bg-success-soft text-success',
  yellow: 'bg-warning-soft text-warning',
  red: 'bg-danger-soft text-danger',
  gray: 'bg-surface-2 text-muted',
  blue: 'bg-primary-soft text-primary',
}

interface BadgeProps {
  tone: BadgeTone
  icon?: ReactNode
  children: ReactNode
  className?: string
}

export function Badge({ tone, icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold [&_svg]:size-3',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/** Моноширинная плашка срока: «−12 дн», «7 мес» */
export function Pill({ tone, children }: { tone: Exclude<BadgeTone, 'gray' | 'blue'>; children: ReactNode }) {
  return (
    <span className={cn('shrink-0 rounded-tag px-2 py-[3px] font-mono text-xs font-semibold', tones[tone])}>
      {children}
    </span>
  )
}
