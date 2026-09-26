import { Activity } from 'lucide-react'
import { Link } from 'react-router'
import { paths } from '@/layouts/navigation'
import { cn } from '@/shared/lib/cn'
import { formatNumber, formatRange } from '@/shared/lib/format'
import { Panel } from '@/shared/ui/Card'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'
import { buildDeviationRows, type DeviationTone } from './deviation'
import { useDoneOperationRuns, useWelds } from './queries'

const barTone: Record<DeviationTone, string> = {
  ok: 'bg-success',
  warn: 'bg-warning',
  bad: 'bg-danger',
}

export function DeviationPanel() {
  const runs = useDoneOperationRuns()
  const welds = useWelds()

  let body
  if (runs.isPending || welds.isPending) {
    body = <SkeletonRows rows={4} />
  } else if (runs.isError) {
    body = <ErrorState error={runs.error} onRetry={() => runs.refetch()} />
  } else {
    // без списка швов строки всё равно показываем — только без названия детали
    const rows = buildDeviationRows(runs.data, welds.data ?? [], 5)
    body =
      rows.length === 0 ? (
        <EmptyState
          icon={<Activity />}
          title="Сравнивать пока не с чем"
          description="Здесь появятся выполненные операции, у которых есть и режим по карте, и замеры тока с установки."
        />
      ) : (
        <div className="grid gap-0.5">
          {rows.map((row) => (
            <div
              key={row.runId}
              className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 border-b border-border px-1 py-[11px] text-sm last:border-b-0 md:grid-cols-[1fr_78px_78px_96px]"
            >
              <div className="min-w-0">
                <strong className="block truncate font-semibold">{row.title}</strong>
                <span className="text-xs text-muted">{row.subtitle}</span>
              </div>
              <div className="hidden text-right font-mono md:block">
                {formatRange(row.plannedMin, row.plannedMax)}
                <small className="block font-sans text-xs text-muted">по карте</small>
              </div>
              <div className="text-right font-mono">
                {formatNumber(row.actual)}
                <small className="block font-sans text-xs text-muted">факт, А</small>
              </div>
              <div className="col-span-2 md:col-span-1">
                <div className="relative h-1.5 overflow-hidden rounded bg-surface-2">
                  <i
                    className={cn('absolute inset-y-0 left-0 rounded', barTone[row.tone])}
                    style={{ width: `${row.barPercent}%` }}
                  />
                </div>
                <span className="mt-1 block font-mono text-xs text-muted">{row.label}</span>
              </div>
            </div>
          ))}
        </div>
      )
  }

  return (
    <Panel
      title="Отклонение факта от карты"
      subtitle="Последние сваренные швы, ток по проходам"
      action={
        <Link to={paths.welds} className="px-1 py-0.5 text-sm text-primary hover:text-primary-hover hover:underline">
          Все швы
        </Link>
      }
    >
      {body}
    </Panel>
  )
}
