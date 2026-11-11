import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toNumber } from '@/shared/lib/format'
import type { Deviation } from '@/shared/types/deviations'
import type { ArcRun, PassPlan } from '@/shared/types/telemetry'
import { isChartRow, passSpans, timeTicks, type ChartRow } from './chart'
import { fmt1, fmtTol, formatTime } from './format'
import type { PlanIndex } from './plan'

// цвета графика — токены портала: график следует светлой и тёмной теме
const $ = {
  grid: 'rgb(var(--c-border) / 0.7)',
  axis: 'rgb(var(--c-border))',
  tick: 'rgb(var(--c-muted))',
  panel: 'rgb(var(--c-surface))',
  fg2: 'rgb(var(--c-text-2))',
  cur: 'rgb(var(--c-primary))',
  volt: 'rgb(var(--c-volt))',
  ok: 'rgb(var(--c-success))',
  crit: 'rgb(var(--c-danger))',
  critInk: 'rgb(var(--c-danger-ink))',
}
const TICK = { fill: $.tick, fontSize: 12, fontFamily: 'IBM Plex Mono, monospace' }

/** Шаг делений шкалы тока: около count делений */
function niceStep(span: number, count = 5): number {
  const raw = span / count
  return [1, 2, 5, 10, 20, 25, 50, 100].find((s) => s >= raw) ?? 100
}

const inside = (v: number, p: PassPlan) => {
  const lo = toNumber(p.currentMin)
  const hi = toNumber(p.currentMax)
  return (lo === null || v >= lo) && (hi === null || v <= hi)
}

function RowTooltip({ row, arc, pass }: { row: ChartRow; arc: ArcRun | undefined; pass: PassPlan | null }) {
  // сравнение с границами карты — только подсветка цифры
  const out = pass !== null && row.i !== null && !inside(row.i, pass)
  return (
    <div className="min-w-[210px] rounded-[6px] bg-bg/95 px-3 py-2 text-[14px] shadow-lg ring-1 ring-line">
      <div className="tnum mb-1 font-mono text-fg2">{formatTime(row.t, true)}</div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <span className="flex items-center gap-1.5 text-fg2">
          <i className="inline-block h-0.5 w-3 bg-cur" aria-hidden />
          Ток ср.
        </span>
        <span className={`tnum text-right font-mono font-semibold ${out ? 'text-crit' : 'text-fg'}`}>{fmt1(row.i)} А</span>
        <span className="pl-[18px] text-fg2">мин–макс</span>
        <span className="tnum text-right font-mono text-fg">
          {row.band ? `${Math.round(row.band[0])}–${Math.round(row.band[1])}` : '—'} А
        </span>
        <span className="flex items-center gap-1.5 text-fg2">
          <i className="inline-block h-0.5 w-3 bg-volt" aria-hidden />
          Напряжение
        </span>
        <span className="tnum text-right font-mono text-fg">{fmt1(row.u)} В</span>
      </div>
      <div className="mt-1.5 border-t border-line pt-1.5 text-fg2">
        {arc?.passNo == null ? (
          'Без привязки к проходу'
        ) : (
          <>
            Проход {arc.passNo}
            {pass ? ` · допуск ${fmtTol(pass.currentMin, pass.currentMax, 'А')}` : ''}
          </>
        )}
      </div>
    </div>
  )
}

function Legend({ hasDev, hasPlan }: { hasDev: boolean; hasPlan: boolean }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[14px] text-fg2">
      <li className="flex items-center gap-2">
        <span className="relative inline-block h-3 w-6 rounded-[4px] bg-cur/25" aria-hidden>
          <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-cur" />
        </span>
        Ток: среднее и разброс мин–макс
      </li>
      <li className="flex items-center gap-2">
        <span className="inline-block h-0.5 w-6 bg-volt" aria-hidden />
        Напряжение (правая шкала)
      </li>
      {hasPlan && (
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-6 rounded-[4px] border border-dashed border-ok/60 bg-ok/10" aria-hidden />
          Допуск по току из техкарты
        </li>
      )}
      {hasDev && (
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-6 rounded-[4px] bg-crit/60 ring-1 ring-crit" aria-hidden />
          Отклонение
        </li>
      )}
      <li className="text-muted">Пропуск линии — пауза между проходами</li>
    </ul>
  )
}

interface Props {
  rows: ChartRow[]
  domain: [number, number]
  arcs: ArcRun[]
  plan: PlanIndex
  deviations: Deviation[]
  /** сеанс идёт — пунктир на последней точке */
  open: boolean
}

/**
 * Ток и напряжение за сеанс на одном графике: ток по левой шкале
 * в верхней части, напряжение по правой — в нижней.
 */
export function TelemetryChart({ rows, domain, arcs, plan, deviations, open }: Props) {
  const points = rows.filter((r) => r.i !== null)
  const lastT = points.at(-1)?.t ?? domain[1]
  const devs = deviations.filter((d) => d.parameter === 'ток' && d.actualValue !== null)
  const passes = arcs.map((a) => plan.passById(a.plannedPassId)).filter((p): p is PassPlan => p !== null)

  // шкала тока: данные в верхних 62 % высоты, ниже место под напряжение
  const iVals = [
    ...points.flatMap((r) => (r.band ? r.band : [r.i ?? 0])),
    ...devs.map((d) => Number(d.actualValue)),
  ]
  const iMin = Math.min(...iVals, ...passes.map((p) => toNumber(p.currentMin) ?? Infinity))
  const iMax = Math.max(...iVals, ...passes.map((p) => toNumber(p.currentMax) ?? -Infinity))
  const h = niceStep(iMax - iMin)
  const iTop = Math.ceil((iMax * 1.03) / h) * h
  const iFirst = Math.floor(iMin / h) * h
  const iLo = Math.max(0, Math.floor((iFirst - 0.38 * iTop) / 0.62 / h) * h)
  const iTicks: number[] = []
  for (let v = iFirst; v <= iTop; v += h) iTicks.push(v)

  // шкала напряжения: данные в нижней четверти
  const uVals = points.map((r) => r.u ?? 0)
  const uFrom = Math.floor(Math.min(...uVals) - 0.5)
  const uTo = Math.ceil(Math.max(...uVals) + 0.5)
  const uSpan = uTo - uFrom || 1
  const uLo = uFrom - (0.03 / 0.24) * uSpan
  const uHi = uLo + uSpan / 0.24
  // ровные деления: 10, 12, 14 В — а не 5, 19, 33 при большом разбросе
  const uStep = [1, 2, 5, 10, 20].find((st) => uSpan / st <= 4) ?? 50
  const uTicks: number[] = []
  for (let v = Math.ceil(uFrom / uStep) * uStep; v <= uTo; v += uStep) uTicks.push(v)

  // шаг меток меньше минуты — нужны секунды, иначе подписи повторяются: 10:47, 10:47
  const xTicks = timeTicks(domain[0], domain[1], 9)
  const withSec = xTicks.some((t) => new Date(t).getSeconds() !== 0)

  const minDevMs = (domain[1] - domain[0]) * 0.006
  const arcById = new Map(arcs.map((a) => [a.id, a]))
  const arcEnd = (a: ArcRun) => (a.finishedAt ? Date.parse(a.finishedAt) : lastT)

  return (
    <div className="flex flex-col gap-3">
      <Legend hasDev={devs.length > 0} hasPlan={passes.length > 0} />
      <div className="h-[340px] w-full sm:h-[400px]" role="img" aria-label="График тока и напряжения за сеанс">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 26, right: 4, bottom: 4, left: 4 }}>
            <CartesianGrid yAxisId="i" stroke={$.grid} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={domain}
              ticks={xTicks}
              tickFormatter={(v: number) => formatTime(v, withSec)}
              stroke={$.axis}
              tick={TICK}
              allowDataOverflow
            />
            <YAxis
              yAxisId="i"
              domain={[iLo, iTop]}
              ticks={iTicks}
              stroke={$.axis}
              tick={TICK}
              width={40}
              allowDataOverflow
              label={{ value: 'А', position: 'insideTopLeft', offset: 0, dy: -22, dx: 14, fill: $.tick, fontSize: 12 }}
            />
            <YAxis
              yAxisId="u"
              orientation="right"
              domain={[uLo, uHi]}
              ticks={uTicks}
              stroke={$.axis}
              // как в референсе: линия правой шкалы — только вдоль полосы
              // напряжения, пунктиром (ниже ReferenceLine), а не на всю высоту
              axisLine={false}
              tick={TICK}
              tickFormatter={(v: number) => `${v} В`}
              width={46}
              allowDataOverflow
            />

            {arcs.map((a) => {
              const p = plan.passById(a.plannedPassId)
              const lo = p ? toNumber(p.currentMin) : null
              const hi = p ? toNumber(p.currentMax) : null
              if (lo === null || hi === null) return null
              return (
                <ReferenceArea
                  key={`tol-${a.id}`}
                  yAxisId="i"
                  x1={Date.parse(a.startedAt)}
                  x2={arcEnd(a)}
                  y1={lo}
                  y2={hi}
                  fill={$.ok}
                  fillOpacity={0.07}
                  stroke={$.ok}
                  strokeOpacity={0.45}
                  strokeDasharray="4 4"
                  ifOverflow="hidden"
                />
              )
            })}
            {passSpans(rows).map((s) => (
              <ReferenceArea
                key={`lbl-${s.no}`}
                yAxisId="i"
                x1={s.from}
                x2={s.to}
                y1={iTop}
                y2={iTop}
                fillOpacity={0}
                strokeOpacity={0}
                ifOverflow="visible"
                label={{
                  value: `Проход ${s.no}`,
                  position: 'top',
                  fill: $.fg2,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'IBM Plex Sans Condensed, sans-serif',
                }}
              />
            ))}
            {devs.map((d) => {
              const t = Date.parse(d.startedAt)
              return (
                <ReferenceArea
                  key={`dev-${d.id}`}
                  yAxisId="i"
                  x1={t}
                  x2={t + Math.max((d.durationSeconds ?? 0) * 1000, minDevMs)}
                  fill={$.crit}
                  fillOpacity={0.35}
                  stroke={$.crit}
                  strokeWidth={1.5}
                  ifOverflow="hidden"
                />
              )
            })}

            <Area yAxisId="i" dataKey="band" stroke="none" fill={$.cur} fillOpacity={0.24} connectNulls={false} isAnimationActive={false} activeDot={false} />
            <Line
              yAxisId="i"
              dataKey="i"
              stroke={$.cur}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: $.cur, stroke: $.panel, strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="u"
              dataKey="u"
              stroke={$.volt}
              strokeWidth={1.75}
              dot={false}
              activeDot={{ r: 4, fill: $.volt, stroke: $.panel, strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />

            {devs.map((d) => (
              <ReferenceDot
                key={`dot-${d.id}`}
                yAxisId="i"
                x={Date.parse(d.startedAt) + ((d.durationSeconds ?? 0) * 1000) / 2}
                y={Number(d.actualValue)}
                r={6}
                fill={$.crit}
                stroke={$.panel}
                strokeWidth={2}
                ifOverflow="visible"
                label={{
                  value: `${fmt1(d.actualValue)} А`,
                  position: 'left',
                  fill: $.critInk,
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'IBM Plex Mono, monospace',
                }}
              />
            ))}
            <ReferenceLine
              yAxisId="u"
              segment={[
                { x: domain[1], y: uFrom },
                { x: domain[1], y: uTo },
              ]}
              stroke={$.axis}
              strokeDasharray="2 3"
              ifOverflow="visible"
            />
            {open && <ReferenceLine yAxisId="i" x={lastT} stroke={$.fg2} strokeDasharray="2 4" />}

            <Tooltip
              isAnimationActive={false}
              cursor={{ stroke: $.fg2, strokeWidth: 1 }}
              content={({ active, payload }) => {
                const row: unknown = payload?.[0]?.payload
                if (!active || !isChartRow(row) || row.i === null) return null
                const arc = row.arcId === null ? undefined : arcById.get(row.arcId)
                return <RowTooltip row={row} arc={arc} pass={arc ? plan.passById(arc.plannedPassId) : null} />
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
