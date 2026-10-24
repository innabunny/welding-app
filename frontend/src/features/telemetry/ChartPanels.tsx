import { LineChart, X } from 'lucide-react'
import { formatNumber } from '@/shared/lib/format'
import type { Deviation } from '@/shared/types/deviations'
import type { ArcRun } from '@/shared/types/telemetry'
import type { WeldingSession } from '@/shared/types/welding'
import { IconButton } from '@/shared/ui/Button'
import { Panel } from '@/shared/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/shared/ui/States'
import { toChartRows } from './chart'
import { formatClock, formatTime } from './format'
import type { PlanIndex } from './plan'
import { useArcSamples, useSessionSamples } from './queries'
import { TelemetryChart } from './TelemetryChart'

function samplesNote(total: number, shown: number, stepMs: number): string {
  return (
    `${formatNumber(total, 0)} замеров, показано ${formatNumber(shown, 0)}. ` +
    `Одна точка — ${formatNumber(stepMs / 1000, 1)} с.`
  )
}

function controlNote(session: WeldingSession): string {
  return session.passPlan.length > 0
    ? 'Коридор допуска — по проходу техкарты, к которому отнесён участок.'
    : 'Сварка без техкарты: допуска нет, режим не контролируется.'
}

interface SessionProps {
  session: WeldingSession
  plan: PlanIndex
  deviations: Deviation[]
  large: boolean
}

export function SessionChartPanel({ session, plan, deviations, large }: SessionProps) {
  const open = session.finishedAt === null
  const samples = useSessionSamples(session.id, 2000, open)

  let body
  if (samples.isPending) body = <Skeleton className="h-[460px]" />
  else if (samples.isError) body = <ErrorState error={samples.error} onRetry={() => void samples.refetch()} />
  else if (samples.data.total === 0)
    body = (
      <EmptyState
        icon={<LineChart />}
        title="Замеров по сеансу нет"
        description={
          open
            ? 'Дуга в этом сеансе ещё не зажигалась или замеры не дошли до хранилища.'
            : 'Узел не прислал замеры за этот сеанс. Участки дуги и отклонения могут быть, а графика не будет.'
        }
      />
    )
  else {
    const d = samples.data
    const rows = toChartRows(d.points, d.stepMs, (p) => plan.passForArc(p.arcId))
    const domain: [number, number] = [d.from ?? rows[0]?.t ?? 0, d.to ?? rows.at(-1)?.t ?? 0]
    body = <TelemetryChart rows={rows} domain={domain} deviations={deviations} large={large} />
  }

  const d = samples.data
  const subtitle =
    d && d.total > 0
      ? `${samplesNote(d.total, d.points.length, d.stepMs)} Разрывы — паузы между участками дуги. ${controlNote(session)}`
      : undefined

  return (
    <Panel title="Ток и напряжение за сеанс" subtitle={subtitle}>
      {body}
    </Panel>
  )
}

interface ArcProps {
  arc: ArcRun
  index: number
  session: WeldingSession
  plan: PlanIndex
  deviations: Deviation[]
  large: boolean
  onClose: () => void
}

export function ArcChartPanel({ arc, index, session, plan, deviations, large, onClose }: ArcProps) {
  const burning = arc.finishedAt === null
  const samples = useArcSamples(arc.id, 1200, burning)
  const pass = plan.passById(arc.plannedPassId)

  let body
  if (samples.isPending) body = <Skeleton className="h-[460px]" />
  else if (samples.isError) body = <ErrorState error={samples.error} onRetry={() => void samples.refetch()} />
  else if (samples.data.total === 0)
    body = <EmptyState icon={<LineChart />} title="Замеров по участку нет" description="Узел не прислал замеры этого участка дуги." />
  else {
    const d = samples.data
    const rows = toChartRows(d.points, d.stepMs, () => pass)
    const domain: [number, number] = [d.from ?? rows[0]?.t ?? 0, d.to ?? rows.at(-1)?.t ?? 0]
    body = <TelemetryChart rows={rows} domain={domain} deviations={deviations} large={large} />
  }

  const d = samples.data
  const head = [
    arc.passNo !== null ? `проход ${arc.passNo}` : 'проход не определён',
    `${formatTime(arc.startedAt, true)}${arc.finishedAt ? `–${formatTime(arc.finishedAt, true)}` : ', горит'}`,
    arc.durationSeconds !== null && formatClock(arc.durationSeconds),
  ].filter(Boolean)
  const subtitle = [
    head.join(' · ') + '.',
    d && d.total > 0 ? samplesNote(d.total, d.points.length, d.stepMs) : '',
    pass
      ? ''
      : session.passPlan.length > 0
        ? 'Участок не отнесён к проходу техкарты, поэтому коридора допуска нет.'
        : controlNote(session),
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Panel
      title={`Участок дуги №${index + 1}`}
      subtitle={subtitle}
      action={
        <IconButton label="Закрыть график участка" onClick={onClose}>
          <X />
        </IconButton>
      }
    >
      {body}
    </Panel>
  )
}
