import { useId, type ReactNode } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { formatNumber } from '@/shared/lib/format'
import type { Deviation } from '@/shared/types/deviations'
import { isChartRow, timeTicks, type ChartRow } from './chart'
import { formatTime } from './format'
import type { Range } from './plan'

// цвета — токены портала: график сам следует светлой и тёмной теме
const C = {
  current: 'rgb(var(--c-primary))',
  voltage: 'rgb(var(--c-teal))',
  tolerance: 'rgb(var(--c-success))',
  deviation: 'rgb(var(--c-danger))',
  grid: 'rgb(var(--c-border))',
  axis: 'rgb(var(--c-muted))',
  surface: 'rgb(var(--c-surface))',
}

const AXIS_TICK = { fill: C.axis, fontSize: 12 }
const yTick = (v: number) => formatNumber(v, 2)

/** Отклонения по току рисуются на графике тока, по напряжению — на графике напряжения */
const ON_CURRENT = new Set(['ток', 'ток_импульса', 'ток_паузы'])
const ON_VOLTAGE = new Set(['напряжение'])

const fmtRange = (r: Range | null, unit: string) => (r ? `${formatNumber(r[0])}–${formatNumber(r[1])} ${unit}` : '—')

function RowTooltip({ active, payload }: TooltipContentProps) {
  const row: unknown = payload?.[0]?.payload
  if (!active || !isChartRow(row)) return null
  return (
    <div className="rounded-sm border border-border bg-surface px-3 py-2 text-xs shadow-card">
      <p className="mb-1 font-semibold">{formatTime(row.t, true)}</p>
      {row.i === null ? (
        <p className="text-muted">дуги нет, замеров нет</p>
      ) : (
        <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
          <dt className="text-muted">Ток среднее</dt>
          <dd className="text-right font-semibold">{formatNumber(row.i)} А</dd>
          <dt className="text-muted">разброс</dt>
          <dd className="text-right">{fmtRange(row.band, 'А')}</dd>
          <dt className="text-muted">допуск по карте</dt>
          <dd className="text-right">{row.iTol ? fmtRange(row.iTol, 'А') : 'нет'}</dd>
          <dt className="text-muted">Напряжение</dt>
          <dd className="text-right font-semibold">{formatNumber(row.u, 2)} В</dd>
          <dt className="text-muted">допуск по карте</dt>
          <dd className="text-right">{row.uTol ? fmtRange(row.uTol, 'В') : 'нет'}</dd>
        </dl>
      )}
    </div>
  )
}

function Swatch({ kind, color }: { kind: 'line' | 'band' | 'tolerance' | 'deviation'; color: string }) {
  const style =
    kind === 'line'
      ? { background: color, height: 2 }
      : kind === 'band'
        ? { background: color, opacity: 0.25, height: 10 }
        : kind === 'tolerance'
          ? { background: color, opacity: 0.14, height: 10, boxShadow: `inset 0 0 0 1px ${color}` }
          : { background: color, opacity: 0.3, height: 10, boxShadow: `inset 0 0 0 1px ${color}` }
  return <span aria-hidden className="inline-block w-4 rounded-[2px]" style={style} />
}

function Legend({ hasTolerance, hasDeviations }: { hasTolerance: boolean; hasDeviations: boolean }) {
  const items: [ReactNode, string][] = [
    [<Swatch key="l" kind="line" color={C.current} />, 'среднее'],
    [<Swatch key="b" kind="band" color={C.current} />, 'разброс внутри точки'],
  ]
  if (hasTolerance) items.push([<Swatch key="t" kind="tolerance" color={C.tolerance} />, 'допуск по техкарте'])
  if (hasDeviations) items.push([<Swatch key="d" kind="deviation" color={C.deviation} />, 'отклонение'])
  return (
    <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-caption text-muted">
      {items.map(([sw, label]) => (
        <li key={label} className="inline-flex items-center gap-2">
          {sw}
          {label}
        </li>
      ))}
    </ul>
  )
}

interface Props {
  rows: ChartRow[]
  domain: [number, number]
  deviations?: Deviation[]
  /** выше — для режима у станка */
  large?: boolean
}

/**
 * Ток и напряжение. Два графика с общей осью времени, а не две шкалы
 * на одном: совмещённые шкалы рисуют связь, которой в данных нет.
 */
export function TelemetryChart({ rows, domain, deviations = [], large = false }: Props) {
  const syncId = useId()
  const ticks = timeTicks(domain[0], domain[1])
  const withSeconds = domain[1] - domain[0] < 10 * 60_000
  const hasTolerance = rows.some((r) => r.iTol !== null || r.uTol !== null)
  const marks = (params: Set<string>) =>
    deviations
      .filter((d) => params.has(d.parameter))
      .map((d) => ({
        id: d.id,
        x1: Math.max(Date.parse(d.startedAt), domain[0]),
        x2: Math.min(d.finishedAt ? Date.parse(d.finishedAt) : domain[1], domain[1]),
      }))
      .filter((m) => m.x2 >= m.x1)
  const currentMarks = marks(ON_CURRENT)
  const voltageMarks = marks(ON_VOLTAGE)

  const xAxis = (show: boolean) => (
    <XAxis
      dataKey="t"
      type="number"
      scale="time"
      domain={domain}
      ticks={ticks}
      tickFormatter={(v: number) => formatTime(v, withSeconds)}
      tick={show ? AXIS_TICK : false}
      tickLine={false}
      axisLine={{ stroke: C.grid }}
      height={show ? 28 : 4}
    />
  )
  const common = (marksHere: typeof currentMarks) => [
    <CartesianGrid key="g" stroke={C.grid} strokeWidth={1} vertical={false} />,
    <YAxis key="y" width={44} tick={AXIS_TICK} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={yTick} />,
    <Tooltip key="tt" content={RowTooltip} cursor={{ stroke: C.axis, strokeWidth: 1 }} isAnimationActive={false} />,
    ...marksHere.map((m) => (
      // узкое окно отклонения на длинном графике — минимум 3 px за счёт обводки
      <ReferenceArea key={`d${m.id}`} x1={m.x1} x2={m.x2} fill={C.deviation} fillOpacity={0.22} stroke={C.deviation} strokeWidth={2} ifOverflow="hidden" />
    )),
  ]
  const tolerance = (key: 'iTol' | 'uTol') => (
    <Area
      dataKey={key}
      stroke={C.tolerance}
      strokeOpacity={0.55}
      strokeWidth={1}
      fill={C.tolerance}
      fillOpacity={0.1}
      connectNulls={false}
      isAnimationActive={false}
      activeDot={false}
    />
  )
  const margin = { top: 8, right: 12, bottom: 0, left: 0 }

  return (
    <div>
      <Legend hasTolerance={hasTolerance} hasDeviations={currentMarks.length + voltageMarks.length > 0} />
      <h3 className="text-xs font-semibold text-muted">Ток, А</h3>
      <div className={large ? 'h-[340px]' : 'h-[260px]'}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} syncId={syncId} margin={margin}>
            {common(currentMarks)}
            {xAxis(false)}
            {tolerance('iTol')}
            <Area dataKey="band" stroke="none" fill={C.current} fillOpacity={0.18} connectNulls={false} isAnimationActive={false} activeDot={false} />
            <Line dataKey="i" stroke={C.current} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: C.surface }} connectNulls={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <h3 className="mt-2 text-xs font-semibold text-muted">Напряжение, В</h3>
      <div className={large ? 'h-[200px]' : 'h-[160px]'}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} syncId={syncId} margin={margin}>
            {common(voltageMarks)}
            {xAxis(true)}
            {tolerance('uTol')}
            <Area dataKey="uBand" stroke="none" fill={C.voltage} fillOpacity={0.18} connectNulls={false} isAnimationActive={false} activeDot={false} />
            <Line dataKey="u" stroke={C.voltage} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: C.surface }} connectNulls={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
