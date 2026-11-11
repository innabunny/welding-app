import { formatNumber } from '@/shared/lib/format'
import type { Deviation } from '@/shared/types/deviations'
import type { ArcRun } from '@/shared/types/telemetry'
import type { WeldingSession } from '@/shared/types/welding'
import { ErrorState, Skeleton } from '@/shared/ui/States'
import { toChartRows } from './chart'
import type { PlanIndex } from './plan'
import { useSessionSamples } from './queries'
import { TelemetryChart } from './TelemetryChart'

interface Props {
  session: WeldingSession
  arcs: ArcRun[]
  plan: PlanIndex
  deviations: Deviation[]
}

/** «Ток и напряжение за сеанс» */
export function SessionChartPanel({ session, arcs, plan, deviations }: Props) {
  const open = session.finishedAt === null
  const samples = useSessionSamples(session.id, 2000, open)

  let body
  if (samples.isPending) body = <Skeleton className="h-[340px] sm:h-[400px]" />
  else if (samples.isError) body = <ErrorState error={samples.error} onRetry={() => void samples.refetch()} />
  else if (samples.data.total === 0) body = <p className="text-fg2">Данных графика нет.</p>
  else {
    const d = samples.data
    const rows = toChartRows(d.points, d.stepMs, (p) => plan.passForArc(p.arcId))
    const domain: [number, number] = [d.from ?? rows[0]?.t ?? 0, d.to ?? rows.at(-1)?.t ?? 0]
    body = (
      <>
        <TelemetryChart rows={rows} domain={domain} arcs={arcs} plan={plan} deviations={deviations} open={open} />
        <p className="tnum text-xs text-muted">
          {formatNumber(d.total, 0)} замеров, показано {formatNumber(d.points.length, 0)}
        </p>
      </>
    )
  }

  return (
    <section aria-label="График сеанса" className="flex flex-col gap-3 rounded-[8px] bg-panel px-4 py-4 ring-1 ring-line sm:px-5">
      <h2 className="label text-[16px] text-fg">Ток и напряжение за сеанс</h2>
      {body}
    </section>
  )
}
