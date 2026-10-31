import { cn } from '@/shared/lib/cn'
import { toNumber } from '@/shared/lib/format'
import type { Deviation } from '@/shared/types/deviations'
import type { ArcRun } from '@/shared/types/telemetry'
import { VerdictCell, type ArcVerdict } from './Badges'
import { fmt1, fmtTol, formatClock, formatTime, secondsSince } from './format'
import { deviationsOnArc, fit, range, type PlanIndex } from './plan'

const TH = 'label whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted'
const TD = 'whitespace-nowrap px-3 py-2.5'

interface Props {
  arcs: ArcRun[]
  plan: PlanIndex
  deviations: Deviation[]
  now: number
}

/** Участки дуги сеанса — те же данные, что на графике, но читаемые без наведения */
export function ArcsTable({ arcs, plan, deviations, now }: Props) {
  return (
    <div className="overflow-x-auto rounded-[8px] ring-1 ring-line">
      <table className="tnum w-full min-w-[960px] border-collapse bg-panel text-[15px]">
        <thead className="bg-panel2">
          <tr>
            <th className={TH}>Участок</th>
            <th className={TH}>Проход</th>
            <th className={TH}>Начало</th>
            <th className={TH}>Длительность</th>
            <th className={cn(TH, 'text-right')}>Ток ср.</th>
            <th className={cn(TH, 'text-right')}>Мин–макс</th>
            <th className={TH}>Допуск</th>
            <th className={cn(TH, 'text-right')}>Напр. ср.</th>
            <th className={cn(TH, 'text-right')}>Импульс</th>
            <th className={TH}>Привязка</th>
            <th className={TH}>Итог</th>
          </tr>
        </thead>
        <tbody>
          {arcs.map((arc, idx) => {
            const pass = plan.passById(arc.plannedPassId)
            const bad = deviationsOnArc(arc, deviations, now).length > 0
            const burning = arc.finishedAt === null
            const verdict: ArcVerdict = bad ? 'deviation' : arc.passNo === null ? 'unassigned' : pass ? 'ok' : 'no-plan'
            // среднее вне границ карты — только подсветка цифры
            const avgOut = pass !== null && fit(toNumber(arc.currentAvg), range(pass.currentMin, pass.currentMax)) === 'out'
            return (
              <tr key={arc.id} className={cn('border-t border-line', bad && 'bg-crit-bg')}>
                <td className={cn(TD, 'font-mono text-fg2')}>
                  <span className="flex items-center gap-2">
                    {bad && <span className="inline-block h-5 w-1 rounded-[4px] bg-crit" aria-hidden />}#{idx + 1}
                  </span>
                </td>
                <td className={TD}>
                  {arc.passNo === null ? (
                    <span className="text-muted">не сопоставлен</span>
                  ) : (
                    <span className="font-semibold text-fg">{arc.passNo}</span>
                  )}
                </td>
                <td className={cn(TD, 'font-mono text-fg2')}>{formatTime(arc.startedAt, true)}</td>
                <td className={cn(TD, 'font-mono')}>
                  {formatClock(burning ? secondsSince(arc.startedAt, now) : arc.durationSeconds)}
                  {burning && (
                    <span className="label ml-2 inline-flex items-center gap-1 text-xs text-arc">
                      <span className="arc-dot inline-block size-1.5 rounded-full bg-arc" aria-hidden />
                      идёт
                    </span>
                  )}
                </td>
                <td className={cn(TD, 'text-right font-mono font-semibold', avgOut ? 'text-crit' : 'text-fg')}>{fmt1(arc.currentAvg)} А</td>
                <td className={cn(TD, 'text-right font-mono text-fg2')}>
                  {fmt1(arc.currentMin)}–{fmt1(arc.currentMax)}
                </td>
                <td className={cn(TD, 'text-fg2')}>{pass ? fmtTol(pass.currentMin, pass.currentMax, 'А') : '—'}</td>
                <td className={cn(TD, 'text-right font-mono text-fg')}>{fmt1(arc.voltageAvg)} В</td>
                <td className={cn(TD, 'text-right font-mono text-fg2')}>{arc.pulseFreq === null ? '—' : `${fmt1(arc.pulseFreq)} Гц`}</td>
                <td className={cn(TD, 'text-fg2')}>{arc.matchSourceDisplay || arc.matchSource || '—'}</td>
                <td className={TD}>
                  <VerdictCell v={verdict} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
