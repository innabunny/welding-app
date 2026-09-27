import { Check } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import type { AttestationStatus } from '@/shared/types/attestation'
import { STEPS } from './labels'

/** Где аттестация на пути «черновик → аттестован» */
export function StatusStepper({ status }: { status: AttestationStatus }) {
  const current = STEPS.findIndex((s) => s.value === status)
  return (
    <ol className="grid gap-2 sm:grid-cols-5">
      {STEPS.map((step, i) => {
        const done = i < current || status === 'done'
        const active = i === current && status !== 'done'
        return (
          <li
            key={step.value}
            aria-current={active ? 'step' : undefined}
            className={cn(
              'flex items-start gap-2.5 rounded-tile border px-3 py-2.5',
              active ? 'border-primary bg-primary-soft' : 'border-border bg-surface',
            )}
          >
            <span
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold',
                done ? 'bg-success text-surface' : active ? 'bg-primary text-surface' : 'bg-surface-2 text-muted',
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className={cn('block text-sm font-semibold', active ? 'text-primary' : !done && 'text-muted')}>
                {step.label}
              </span>
              <span className="block text-xs text-muted">{step.hint}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
