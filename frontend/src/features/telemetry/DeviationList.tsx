import { AlertOctagon, CheckCircle2, Gavel, ShieldOff } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useSession } from '@/shared/api/session'
import { cn } from '@/shared/lib/cn'
import { formatNumber, formatRange, plural } from '@/shared/lib/format'
import type { Deviation, WeldDecision } from '@/shared/types/deviations'
import type { WeldingSession } from '@/shared/types/welding'
import { Button } from '@/shared/ui/Button'
import type { Editing } from '@/shared/ui/FormModal'
import { EmptyState } from '@/shared/ui/States'
import { DeviationStatusBadge } from './Badges'
import { canDecide, newDecision, sameWork, WHO_DECIDES, type DecisionForm, type DeviationKind } from './decision'
import { DecisionModal } from './DecisionModal'
import { formatDuration, formatStart, formatTime } from './format'
import { DEVIATION_UNIT } from './units'

function Fact({ label, children, large }: { label: string; children: ReactNode; large?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cn('mt-0.5 font-semibold', large && 'text-2xl tracking-number')}>{children}</dd>
    </div>
  )
}

/** Где случилось: шов и деталь, если сварка по техпроцессу */
function where(d: Deviation): string {
  const parts = [
    d.seamNumber && `шов ${d.seamNumber}`,
    d.partNumber && `деталь ${d.partNumber}`,
    d.serialNo && `зав. № ${d.serialNo}`,
    d.operationNumber && `операция ${d.operationNumber}`,
  ].filter(Boolean)
  return parts.join(', ')
}

interface ItemProps {
  d: Deviation
  decisions: WeldDecision[]
  /** undefined — выбирать нельзя (нет прав или уже рассмотрено) */
  selection?: { checked: boolean; disabled: string | null; toggle: () => void }
  now: number
}

/** Принятые решения: кто, когда, что и почему — снимок подписи */
function Decisions({ decisions, now }: { decisions: WeldDecision[]; now: number }) {
  if (decisions.length === 0) return null
  return (
    <ul className="mt-3 grid gap-1.5 border-t border-border pt-3 text-sm">
      {decisions.map((x) => (
        <li key={x.id}>
          <span className="font-semibold">{x.resultName}</span>
          {x.assignedControl && <span> · {x.assignedControl}</span>}
          <span className="text-muted">
            {' '}· {x.authorName || 'автор не указан'}, {formatStart(x.createdAt, now)}
          </span>
          {x.reason && <span className="block text-muted">{x.reason}</span>}
        </li>
      ))}
    </ul>
  )
}

function DeviationItem({ d, decisions, selection, now }: ItemProps) {
  const unit = DEVIATION_UNIT[d.parameter]
  const pending = !d.reviewed
  const percent = d.deviationPercent === null ? null : Number(d.deviationPercent)
  return (
    <article
      className={cn(
        'rounded-box border p-4',
        pending ? 'border-danger bg-danger-soft' : 'border-border bg-surface',
      )}
    >
      <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {selection ? (
          <input
            type="checkbox"
            aria-label={`Выбрать: ${d.parameterName}, ${formatTime(d.startedAt, true)}`}
            title={selection.disabled ?? undefined}
            className="size-5 shrink-0 accent-primary disabled:cursor-not-allowed"
            checked={selection.checked}
            disabled={selection.disabled !== null}
            onChange={selection.toggle}
          />
        ) : (
          pending && <AlertOctagon className="size-5 shrink-0 text-danger" aria-hidden />
        )}
        <h3 className={cn('font-heading text-lg', pending && 'text-danger')}>{d.parameterName}</h3>
        <span className="text-sm text-muted">{d.severityName}</span>
        {d.passNo !== null && <span className="text-sm text-muted">проход {d.passNo}</span>}
        <span className="ml-auto inline-flex items-center gap-3">
          <span className="font-mono text-sm">
            {formatTime(d.startedAt, true)}
            {d.finishedAt && `–${formatTime(d.finishedAt, true)}`}
          </span>
          <DeviationStatusBadge deviation={d} />
        </span>
      </header>
      {!d.isOrganizational && (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Фактически" large>
            {formatNumber(d.actualValue)} <span className="text-base text-muted">{unit}</span>
          </Fact>
          <Fact label="Допуск по техкарте" large>
            {formatRange(d.plannedMin, d.plannedMax)} <span className="text-base text-muted">{unit}</span>
          </Fact>
          <Fact label="Отклонение от границы" large>
            {percent === null ? '—' : `${percent > 0 ? '+' : ''}${formatNumber(percent)} %`}
          </Fact>
          <Fact label="Длилось" large>
            {d.durationSeconds === null ? 'продолжается' : formatDuration(d.durationSeconds)}
          </Fact>
        </dl>
      )}
      <p className={cn('text-sm', d.isOrganizational ? '' : 'mt-3 border-t pt-3', pending ? 'border-danger/30' : 'border-border')}>
        {where(d) ? `${where(d)[0]?.toUpperCase()}${where(d).slice(1)}. ` : 'Шов по чертежу не привязан. '}
        {d.welderName && `Сварщик ${d.welderName}. `}
        {pending
          ? d.isOrganizational
            ? 'Мастеру нужно разобрать нарушение.'
            : 'Нужна оценка технолога: допустить, направить на контроль или на переварку.'
          : 'Решение по отклонению принято.'}
      </p>
      {selection?.disabled && <p className="mt-2 text-xs text-muted">{selection.disabled}</p>}
      <Decisions decisions={decisions} now={now} />
    </article>
  )
}

interface GroupProps {
  kind: DeviationKind
  title: string
  who: string
  items: Deviation[]
  decisionsOf: (id: number) => WeldDecision[]
  canSign: boolean
  selected: number[]
  setSelected: (ids: number[]) => void
  onDecide: () => void
  now: number
}

function Group({ kind, title, who, items, decisionsOf, canSign, selected, setSelected, onDecide, now }: GroupProps) {
  const pendingItems = items.filter((d) => !d.reviewed)
  const picked = items.filter((d) => selected.includes(d.id))
  const anchor = picked[0]
  const toggle = (id: number) =>
    setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  // «выбрать все» — те, что относятся к той же операции, что и первый ждущий
  const first = anchor ?? pendingItems[0]
  const allSameWork = first ? pendingItems.filter((d) => sameWork(d, first)).map((d) => d.id) : []

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
          {title} · {items.length}
          <span className="font-normal text-muted">{who}</span>
          {pendingItems.length > 0 && <span className="text-danger">ждут решения: {pendingItems.length}</span>}
        </h3>
        {pendingItems.length > 0 &&
          (canSign ? (
            <span className="ml-auto flex flex-wrap items-center gap-2">
              {allSameWork.length > 1 && (
                <Button variant="ghost" onClick={() => setSelected(allSameWork)}>
                  Выбрать все ждущие
                </Button>
              )}
              <Button icon={<Gavel />} disabled={picked.length === 0} onClick={onDecide}>
                {kind === 'regime' ? 'Принять решение' : 'Отметить разобранным'}
                {picked.length > 0 && ` · ${picked.length}`}
              </Button>
            </span>
          ) : (
            <span className="ml-auto text-caption text-muted">{WHO_DECIDES[kind]}</span>
          ))}
      </div>
      <div className="grid gap-3">
        {items.map((d) => (
          <DeviationItem
            key={d.id}
            d={d}
            now={now}
            decisions={decisionsOf(d.id)}
            selection={
              canSign && !d.reviewed
                ? {
                    checked: selected.includes(d.id),
                    toggle: () => toggle(d.id),
                    disabled:
                      anchor && !selected.includes(d.id) && !sameWork(anchor, d)
                        ? 'Другая операция или шов — по ним отдельное решение.'
                        : null,
                  }
                : undefined
            }
          />
        ))}
      </div>
    </section>
  )
}

/**
 * Два разных списка для двух разных людей: отклонения режима — технологу,
 * нарушения порядка — мастеру.
 */
interface ListProps {
  deviations: Deviation[]
  decisions: WeldDecision[]
  session: WeldingSession
  now: number
}

export function DeviationList({ deviations, decisions, session, now }: ListProps) {
  const role = useSession((s) => s.user?.role)
  const [selected, setSelected] = useState<Record<DeviationKind, number[]>>({ regime: [], order: [] })
  const [modal, setModal] = useState<{ kind: DeviationKind; editing: Editing<DecisionForm> } | null>(null)

  // новые сверху, нерассмотренные раньше рассмотренных
  const sorted = [...deviations].sort(
    (a, b) => Number(a.reviewed) - Number(b.reviewed) || Date.parse(b.startedAt) - Date.parse(a.startedAt),
  )
  const regime = sorted.filter((d) => !d.isOrganizational)
  const order = sorted.filter((d) => d.isOrganizational)
  const controlled = session.passPlan.length > 0

  const byDeviation = new Map<number, WeldDecision[]>()
  for (const x of decisions) for (const id of x.deviations) byDeviation.set(id, [...(byDeviation.get(id) ?? []), x])
  const decisionsOf = (id: number) => byDeviation.get(id) ?? []

  // выбранными считаются только те, что ещё ждут решения: после сохранения
  // или чужого решения они сами выпадают из выбора
  const pendingIds = new Set(deviations.filter((d) => !d.reviewed).map((d) => d.id))
  const pick = (kind: DeviationKind) => selected[kind].filter((id) => pendingIds.has(id))
  const picked = (kind: DeviationKind) => deviations.filter((d) => pick(kind).includes(d.id))

  const group = (kind: DeviationKind, title: string, who: string, items: Deviation[]) => (
    <Group
      kind={kind}
      title={title}
      who={who}
      items={items}
      decisionsOf={decisionsOf}
      canSign={canDecide(role, kind)}
      selected={pick(kind)}
      setSelected={(ids) => setSelected((prev) => ({ ...prev, [kind]: ids }))}
      onDecide={() => setModal({ kind, editing: { id: null, initial: newDecision(session.id, kind, picked(kind)) } })}
      now={now}
    />
  )

  return (
    <div className="grid gap-5">
      {regime.length > 0 ? (
        group('regime', 'Отклонения режима', 'технологу', regime)
      ) : controlled ? (
        <EmptyState icon={<CheckCircle2 className="text-success" />} title="Отклонений режима нет" description="Ток, напряжение и скорость в сеансе не выходили за допуски техкарты." />
      ) : (
        <EmptyState
          icon={<ShieldOff />}
          title="Режим не контролируется"
          description={
            session.mode === 'по техпроцессу'
              ? 'Техкарта к сеансу не привязана: сверять режим не с чем.'
              : 'Сварка без техкарты — отработка режимов или прихватка. Сверять режим не с чем.'
          }
        />
      )}
      {order.length > 0 && group('order', 'Нарушения порядка', 'мастеру', order)}

      {modal && (
        <DecisionModal
          editing={modal.editing}
          kind={modal.kind}
          deviations={picked(modal.kind)}
          onClose={() => setModal(null)}
          onSaved={() => setSelected((prev) => ({ ...prev, [modal.kind]: [] }))}
        />
      )}
    </div>
  )
}

/** Полоса вверху экрана: отклонение идёт сейчас или ждёт решения */
export function DeviationBanner({ deviations, onShow }: { deviations: Deviation[]; onShow: () => void }) {
  const pending = deviations.filter((d) => !d.reviewed && !d.isOrganizational)
  if (pending.length === 0) return null
  const ongoing = pending.find((d) => d.finishedAt === null)
  const d = ongoing ?? pending[0]
  if (!d) return null
  const unit = DEVIATION_UNIT[d.parameter]
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-box bg-danger px-4 py-3 text-white dark:border-2 dark:border-danger dark:bg-danger-soft dark:text-danger">
      <AlertOctagon className="size-6 shrink-0" aria-hidden />
      <p className="font-heading text-lg">
        {ongoing
          ? 'Отклонение от режима сейчас'
          : `${pending.length} ${plural(pending.length, ['отклонение ждёт', 'отклонения ждут', 'отклонений ждут'])} решения`}
      </p>
      <p className="text-sm">
        {d.parameterName.toLowerCase()} {formatNumber(d.actualValue)} {unit} при допуске {formatRange(d.plannedMin, d.plannedMax)} {unit}
        {d.passNo !== null && `, проход ${d.passNo}`}, {formatTime(d.startedAt, true)}
      </p>
      <button type="button" onClick={onShow} className="ml-auto text-sm font-semibold underline underline-offset-2">
        К отклонениям
      </button>
    </div>
  )
}
