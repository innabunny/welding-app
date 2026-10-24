import { useId } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { formatNumber } from '@/shared/lib/format'
import type { SessionSamples } from '@/shared/types/telemetry'
import { isChartRow, timeTicks, toChartRows, type ChartRow } from './chart'
import { formatTime } from './format'

// цвета — токены портала: график сам следует светлой и тёмной теме
const C = {
  current: 'rgb(var(--c-primary))',
  voltage: 'rgb(var(--c-teal))',
  grid: 'rgb(var(--c-border))',
  axis: 'rgb(var(--c-muted))',
}

const AXIS_TICK = { fill: C.axis, fontSize: 12 }
const yTick = (v: number) => formatNumber(v, 2)

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
          <dd className="text-right">
            {row.band ? `${formatNumber(row.band[0])}–${formatNumber(row.band[1])} А` : '—'}
          </dd>
          <dt className="text-muted">Напряжение</dt>
          <dd className="text-right font-semibold">{formatNumber(row.u, 2)} В</dd>
        </dl>
      )}
    </div>
  )
}

interface Props {
  samples: SessionSamples
  /** выше — для режима у станка */
  large?: boolean
}

/**
 * Ток и напряжение за сеанс. Два графика с общей осью времени, а не две
 * шкалы на одном: совмещённые шкалы рисуют связь, которой в данных нет.
 */
export function SessionChart({ samples, large = false }: Props) {
  const syncId = useId()
  const rows: ChartRow[] = toChartRows(samples.points, samples.stepMs)
  const domain: [number, number] = [samples.from ?? rows[0]?.t ?? 0, samples.to ?? rows.at(-1)?.t ?? 0]
  const ticks = timeTicks(domain[0], domain[1])

  const xAxis = (show: boolean) => (
    <XAxis
      dataKey="t"
      type="number"
      scale="time"
      domain={domain}
      ticks={ticks}
      tickFormatter={(v: number) => formatTime(v)}
      tick={show ? AXIS_TICK : false}
      tickLine={false}
      axisLine={{ stroke: C.grid }}
      height={show ? 28 : 4}
    />
  )
  const grid = <CartesianGrid stroke={C.grid} strokeWidth={1} vertical={false} />
  const tooltip = (
    <Tooltip
      content={RowTooltip}
      cursor={{ stroke: C.axis, strokeWidth: 1 }}
      isAnimationActive={false}
    />
  )

  return (
    <div className="grid gap-1">
      <h3 className="text-xs font-semibold text-muted">Ток, А</h3>
      <div className={large ? 'h-[340px]' : 'h-[260px]'}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} syncId={syncId} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            {grid}
            {xAxis(false)}
            <YAxis width={44} tick={AXIS_TICK} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={yTick} />
            {tooltip}
            <Area
              dataKey="band"
              stroke="none"
              fill={C.current}
              fillOpacity={0.18}
              connectNulls={false}
              isAnimationActive={false}
              activeDot={false}
            />
            <Line
              dataKey="i"
              stroke={C.current}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'rgb(var(--c-surface))' }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <h3 className="mt-2 text-xs font-semibold text-muted">Напряжение, В</h3>
      <div className={large ? 'h-[200px]' : 'h-[160px]'}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} syncId={syncId} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            {grid}
            {xAxis(true)}
            <YAxis width={44} tick={AXIS_TICK} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={yTick} />
            {tooltip}
            <Line
              dataKey="u"
              stroke={C.voltage}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'rgb(var(--c-surface))' }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
