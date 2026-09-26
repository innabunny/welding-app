import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-card border border-border bg-surface shadow-card', className)}
      {...rest}
    />
  )
}

interface PanelProps extends HTMLAttributes<HTMLElement> {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
}

export function Panel({ title, subtitle, action, className, children, ...rest }: PanelProps) {
  return (
    <article
      className={cn('rounded-card border border-border bg-surface p-5 shadow-card', className)}
      {...rest}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-heading">{title}</h2>
          {subtitle && <div className="mt-[3px] text-caption text-muted">{subtitle}</div>}
        </div>
        {action && <div className="shrink-0 whitespace-nowrap">{action}</div>}
      </div>
      {children}
    </article>
  )
}
