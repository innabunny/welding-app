import { AlertOctagon } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { formatNumber, formatRange } from '@/shared/lib/format'
import type { Deviation } from '@/shared/types/deviations'
import type { ArcRun } from '@/shared/types/telemetry'
import { Badge } from '@/shared/ui/Badge'
import { Table, Td, Th, Tr } from '@/shared/ui/Table'
import { MatchSourceBadge } from './Badges'
import { formatClock, formatTime } from './format'
import { deviationsOnArc, type PlanIndex } from './plan'

interface Props {
  arcs: ArcRun[]
  plan: PlanIndex
  deviations: Deviation[]
  selectedId: number | null
  onSelect: (id: number | null) => void
  now: number
}

/**
 * Участки дуги — таблица к графику: те же данные, но читаемые без
 * наведения мыши. Строка открывает график одного участка.
 */
export function ArcsTable({ arcs, plan, deviations, selectedId, onSelect, now }: Props) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Участок</Th>
          <Th>Проход</Th>
          <Th>Граница прохода</Th>
          <Th>Начало</Th>
          <Th className="text-right">Длительность</Th>
          <Th className="text-right">Ток ср., А</Th>
          <Th>Допуск, А</Th>
          <Th className="text-right">Напр. ср., В</Th>
          <Th>Допуск, В</Th>
          <Th className="text-right">Импульс, Гц</Th>
          <Th>Отклонения</Th>
        </tr>
      </thead>
      <tbody>
        {arcs.map((arc, idx) => {
          const pass = plan.passById(arc.plannedPassId)
          const onArc = deviationsOnArc(arc, deviations, now)
          const pending = onArc.filter((d) => !d.reviewed).length
          const selected = arc.id === selectedId
          const burning = arc.finishedAt === null
          return (
            <Tr
              key={arc.id}
              onClick={() => onSelect(selected ? null : arc.id)}
              className={cn(
                'cursor-pointer hover:bg-surface-2/60',
                selected && 'bg-primary-soft hover:bg-primary-soft',
                pending > 0 && '[&>td:first-child]:shadow-[inset_4px_0_0_rgb(var(--c-danger))]',
              )}
            >
              <Td className="!pl-3">
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={`График участка ${idx + 1}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect(selected ? null : arc.id)
                  }}
                  className="font-mono font-semibold hover:text-primary"
                >
                  №{idx + 1}
                </button>
              </Td>
              <Td>{arc.passNo ?? <span className="text-muted">—</span>}</Td>
              <Td>
                <MatchSourceBadge source={arc.matchSource} label={arc.matchSourceDisplay} />
              </Td>
              <Td className="font-mono">{formatTime(arc.startedAt, true)}</Td>
              <Td className="whitespace-nowrap text-right">
                {burning ? (
                  <span className="text-success">горит</span>
                ) : (
                  <span className="font-mono">{formatClock(arc.durationSeconds)}</span>
                )}
                {!arc.telemetryComplete && !burning && (
                  <span className="block text-xs text-warning">замеры дошли не полностью</span>
                )}
              </Td>
              <Td className="whitespace-nowrap text-right">
                <span className="font-mono font-semibold">{formatNumber(arc.currentAvg)}</span>
                <span className="block font-mono text-xs text-muted">{formatRange(arc.currentMin, arc.currentMax)}</span>
              </Td>
              <Td className="whitespace-nowrap">
                {pass ? formatRange(pass.currentMin, pass.currentMax) : <span className="text-muted">нет</span>}
              </Td>
              <Td className="text-right font-mono">{formatNumber(arc.voltageAvg)}</Td>
              <Td className="whitespace-nowrap">
                {pass ? formatRange(pass.voltageMin, pass.voltageMax) : <span className="text-muted">нет</span>}
              </Td>
              <Td className="text-right font-mono">{formatNumber(arc.pulseFreq, 2)}</Td>
              <Td>
                {onArc.length === 0 ? (
                  <span className="text-muted">нет</span>
                ) : pending > 0 ? (
                  <Badge tone="red" icon={<AlertOctagon />}>
                    {pending} ждёт решения
                  </Badge>
                ) : (
                  <span className="text-muted">рассмотрено: {onArc.length}</span>
                )}
              </Td>
            </Tr>
          )
        })}
      </tbody>
    </Table>
  )
}
