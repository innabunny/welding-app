import { CheckCircle2, CircleDashed, FileText, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/shared/lib/cn'
import { formatDate, formatNumber, formatWhen } from '@/shared/lib/format'
import type { OperationRun, WeldPassRun } from '@/shared/types/welding'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Table, Td, Th, Tr } from '@/shared/ui/Table'
import { resultMeta } from './labels'

/** «00:04:12» → «4 мин 12 с» */
function arcTime(value: string | null): string {
  if (!value) return '—'
  const [h = 0, m = 0, s = 0] = value.split(':').map((x) => Math.round(Number(x)))
  const parts = [h ? `${h} ч` : '', m ? `${m} мин` : '', s || (!h && !m) ? `${s} с` : '']
  return parts.filter(Boolean).join(' ')
}

function DeviationBadge({ pass }: { pass: WeldPassRun }) {
  const d = pass.deviation
  if (!d) return <span className="text-muted">нет данных</span>
  if (d.state === 'в допуске') return <Badge tone="green">в допуске</Badge>
  // отклонение — цветом и словом: «выше на 7,3%»
  return (
    <Badge tone="red">
      {d.state} на {formatNumber(d.percent)}%
    </Badge>
  )
}

interface Props {
  run: OperationRun
  /** Нет — у пользователя нет права вносить заключения */
  onInspect?: () => void
}

export function RunCard({ run, onInspect }: Props) {
  // назначенный контроль — строки из операции, методы заключений — те же коды
  const done = new Set<string>(run.inspections.map((i) => i.method))

  return (
    <article className="grid gap-4 rounded-tile border border-border bg-surface p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold">
            Операция {run.operationNumber}
            <Badge tone={run.status === 'done' ? 'green' : 'blue'}>{run.status === 'done' ? 'Выполнена' : 'В работе'}</Badge>
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
            <Link to={`/cards/${run.cardId}`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              <FileText className="size-3.5" aria-hidden />
              карта № {run.cardNo}
            </Link>
            <span>{run.methodName}</span>
          </p>
        </div>
        {onInspect && (
          <Button variant="secondary" icon={<Plus />} onClick={onInspect} className="h-8 px-3">
            Заключение контроля
          </Button>
        )}
      </header>

      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-muted">Сварщик</dt>
          <dd>{run.welderFio || <span className="text-muted">не указан</span>}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Установка</dt>
          <dd>{run.equipmentName || <span className="text-muted">не указана</span>}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Время</dt>
          <dd>
            {run.startedAt ? formatWhen(run.startedAt) : '—'}
            {run.finishedAt && ` – ${formatWhen(run.finishedAt)}`}
            {run.startedAt && <span className="block text-xs text-muted">{formatDate(run.startedAt)}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Усадка, мм</dt>
          <dd className="font-mono">
            {run.shrinkage !== null ? (
              <>
                {formatNumber(run.shrinkage, 2)}
                <span className="block font-sans text-xs text-muted">
                  {formatNumber(run.sizeBefore, 2)} → {formatNumber(run.sizeAfter, 2)}
                </span>
              </>
            ) : (
              <span className="font-sans text-muted">замеров нет</span>
            )}
          </dd>
        </div>
      </dl>

      {run.passes.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>Проход</Th>
              <Th className="text-right">Ток по карте, А</Th>
              <Th className="text-right">Ток средний, А</Th>
              <Th>Отклонение</Th>
              <Th>Время дуги</Th>
              <Th>Граница прохода</Th>
            </tr>
          </thead>
          <tbody>
            {run.passes.map((p) => (
              <Tr key={p.id}>
                <Td className="font-semibold">№ {p.no}</Td>
                <Td className="text-right font-mono">
                  {p.plannedCurrent ? `${formatNumber(p.plannedCurrent.min)}–${formatNumber(p.plannedCurrent.max)}` : '—'}
                </Td>
                <Td className="text-right font-mono">{p.actualCurrent ? formatNumber(p.actualCurrent.avg) : '—'}</Td>
                <Td>
                  <DeviationBadge pass={p} />
                </Td>
                <Td className="whitespace-nowrap">{arcTime(p.arcTime)}</Td>
                {/* граница прохода определяется расчётом — показываем, насколько ей верить */}
                <Td className="text-xs text-muted">{p.matchSourceDisplay}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      <section className="grid gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Контроль</h4>
        {run.requiredControls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {run.requiredControls.map((m) => {
              const ok = done.has(m)
              return (
                <span
                  key={m}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                    ok ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning',
                  )}
                >
                  {ok ? <CheckCircle2 className="size-3.5" aria-hidden /> : <CircleDashed className="size-3.5" aria-hidden />}
                  {m} — {ok ? 'есть' : 'ждёт'}
                </span>
              )
            })}
          </div>
        )}
        {run.inspections.length === 0 ? (
          <p className="text-sm text-muted">
            {run.requiredControls.length > 0 ? 'Заключений пока нет.' : 'Контроль после операции не назначен, заключений нет.'}
          </p>
        ) : (
          <ul className="grid gap-2">
            {run.inspections.map((i) => (
              <li key={i.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-control bg-surface-2/60 px-3 py-2 text-sm">
                <span className="font-mono font-semibold">{i.method}</span>
                <Badge tone={resultMeta[i.result].tone}>{resultMeta[i.result].label}</Badge>
                <span className="text-muted">
                  {i.kindDisplay.toLowerCase()} · {i.specimen}
                  {i.reportNo && ` · № ${i.reportNo}`}
                  {i.inspectedAt && ` · ${formatDate(i.inspectedAt)}`}
                  {i.inspectorName && ` · ${i.inspectorName}`}
                </span>
                {i.conclusion && <span className="basis-full whitespace-pre-line">{i.conclusion}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  )
}
