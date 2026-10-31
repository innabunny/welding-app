import { CircleAlert, CircleCheck, Gavel } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useSession } from '@/shared/api/session'
import { cn } from '@/shared/lib/cn'
import type { Deviation, WeldDecision } from '@/shared/types/deviations'
import type { WeldingSession } from '@/shared/types/welding'
import type { Editing } from '@/shared/ui/FormModal'
import { canDecide, newDecision, sameWork, WHO_DECIDES, type DecisionForm, type DeviationKind } from './decision'
import { DecisionModal } from './DecisionModal'
import { fmt1, fmtSpan, fmtTol, formatStart, formatTime, secondsSince } from './format'
import { DEVIATION_UNIT } from './units'

function Fact({ label, big = false, pending, children }: { label: string; big?: boolean; pending: boolean; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className={cn('label text-xs', pending ? 'text-crit-ink/70' : 'text-muted')}>{label}</span>
      <span
        className={cn(
          'tnum font-mono font-semibold',
          big ? 'text-[36px] leading-tight' : 'text-[24px]',
          big ? (pending ? 'text-surface' : 'text-fg') : pending ? 'text-crit-ink' : 'text-fg2',
        )}
      >
        {children}
      </span>
    </div>
  )
}

/** Где случилось: шов и деталь, если сварка по техпроцессу */
function where(d: Deviation): string {
  const s = [d.seamNumber && `шов ${d.seamNumber}`, d.partNumber && `деталь ${d.partNumber}`, d.serialNo && `зав. № ${d.serialNo}`]
    .filter(Boolean)
    .join(', ')
  return s ? `${s[0]?.toUpperCase()}${s.slice(1)}` : 'Шов'
}

function headline(d: Deviation): string {
  const name = d.parameterName.toLowerCase()
  if (d.isOrganizational) return d.parameterName
  return d.direction === 'above' ? `${name} выше допуска` : d.direction === 'below' ? `${name} ниже допуска` : `${name}: отклонение`
}

/** Принятые решения: кто, когда, что и почему — снимок подписи */
function Decisions({ decisions, now }: { decisions: WeldDecision[]; now: number }) {
  if (decisions.length === 0) return null
  return (
    <ul className="grid gap-1.5 border-t border-line px-4 py-2.5 text-[14px]">
      {decisions.map((x) => (
        <li key={x.id}>
          <span className="font-semibold text-fg">{x.resultName}</span>
          {x.assignedControl && <span className="text-fg"> · {x.assignedControl}</span>}
          <span className="text-fg2">
            {' '}· {x.authorName || 'автор не указан'}, {formatStart(x.createdAt, now)}
          </span>
          {x.reason && <span className="block text-fg2">{x.reason}</span>}
        </li>
      ))}
    </ul>
  )
}

interface ItemProps {
  d: Deviation
  decisions: WeldDecision[]
  /** undefined — выбирать нельзя (нет прав или уже рассмотрено) */
  selection?: { checked: boolean; disabled: string | null; toggle: () => void }
  now: number
}

function DeviationCard({ d, decisions, selection, now }: ItemProps) {
  const unit = DEVIATION_UNIT[d.parameter]
  const pending = !d.reviewed
  const ongoing = d.finishedAt === null
  return (
    <li className={cn('overflow-hidden rounded-[8px]', pending ? 'bg-crit-bg ring-2 ring-crit' : 'bg-panel ring-1 ring-line')}>
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5',
          pending ? 'bg-crit-strong text-surface' : 'bg-panel2 text-fg',
        )}
      >
        {selection && (
          <input
            type="checkbox"
            aria-label={`Выбрать: ${d.parameterName}, ${formatTime(d.startedAt, true)}`}
            title={selection.disabled ?? undefined}
            className="size-5 shrink-0 accent-surface disabled:cursor-not-allowed"
            checked={selection.checked}
            disabled={selection.disabled !== null}
            onChange={selection.toggle}
          />
        )}
        {pending ? (
          <CircleAlert className={cn('size-6 shrink-0', ongoing && 'crit-blink')} aria-hidden />
        ) : (
          <CircleCheck className="size-6 shrink-0 text-ok" aria-hidden />
        )}
        <span className="label text-[18px]">{headline(d)}</span>
        {d.passNo !== null && <span className="text-[16px]">проход {d.passNo}</span>}
        <span className="tnum ml-auto font-mono text-[16px]">{formatTime(d.startedAt, true)}</span>
        {pending && ongoing && <span className="label rounded-[4px] bg-surface px-2 py-0.5 text-[14px] text-crit-strong">Продолжается</span>}
        {!pending && <span className="label rounded-[4px] bg-ok-bg px-2 py-0.5 text-[14px] text-ok ring-1 ring-ok/40">Решение принято</span>}
      </div>
      {!d.isOrganizational && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-4">
          <Fact label="Факт" big pending={pending}>
            {fmt1(d.actualValue)} <small className={cn('text-[20px]', pending ? 'text-crit-ink/80' : 'text-fg2')}>{unit}</small>
          </Fact>
          <Fact label="Допуск по техкарте" pending={pending}>
            {fmtTol(d.plannedMin, d.plannedMax, unit)}
          </Fact>
          <Fact label={d.direction === 'below' ? 'Ниже нижней границы на' : 'Выше верхней границы на'} pending={pending}>
            {fmt1(d.delta)} {unit}
            {d.deviationPercent !== null && (
              <span className={cn('ml-2 text-[18px]', pending ? 'text-crit-ink/80' : 'text-fg2')}>({fmt1(d.deviationPercent)} %)</span>
            )}
          </Fact>
          <Fact label={ongoing ? 'Длится' : 'Длительность'} pending={pending}>
            {fmtSpan(ongoing ? secondsSince(d.startedAt, now) : d.durationSeconds)}
          </Fact>
        </div>
      )}
      {selection?.disabled && <p className="px-4 pb-2 text-xs text-crit-ink/70">{selection.disabled}</p>}
      <div className={cn('border-t px-4 py-2.5 text-[15px]', pending ? 'border-crit/40 text-crit-ink' : 'border-line text-fg2')}>
        {where(d)}
        {d.welderName && `, сварщик ${d.welderName}`}
        {' — '}
        {pending
          ? d.isOrganizational
            ? 'мастеру нужно разобрать нарушение.'
            : 'нужна оценка технолога: допустить, направить на контроль или на переварку.'
          : 'решение принято.'}
      </div>
      <Decisions decisions={decisions} now={now} />
    </li>
  )
}

interface GroupProps {
  kind: DeviationKind
  title: string
  items: Deviation[]
  decisionsOf: (id: number) => WeldDecision[]
  canSign: boolean
  selected: number[]
  setSelected: (ids: number[]) => void
  onDecide: () => void
  now: number
  empty?: ReactNode
}

function Group({ kind, title, items, decisionsOf, canSign, selected, setSelected, onDecide, now, empty }: GroupProps) {
  const pendingItems = items.filter((d) => !d.reviewed)
  const picked = items.filter((d) => selected.includes(d.id))
  const anchor = picked[0]
  const toggle = (id: number) => setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  // «выбрать все» — те, что относятся к той же операции, что и первый ждущий
  const first = anchor ?? pendingItems[0]
  const allSameWork = first ? pendingItems.filter((d) => sameWork(d, first)).map((d) => d.id) : []

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="label text-[16px] text-fg">
          {title} <span className={items.length ? 'text-crit' : 'text-muted'}>· {items.length}</span>
        </h2>
        {pendingItems.length > 0 &&
          (canSign ? (
            <span className="ml-auto flex flex-wrap items-center gap-2">
              {allSameWork.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSelected(allSameWork)}
                  className="rounded-[6px] px-3 py-1.5 text-[14px] text-fg2 ring-1 ring-line hover:bg-panel2 hover:text-fg"
                >
                  Выбрать все ждущие
                </button>
              )}
              <button
                type="button"
                disabled={picked.length === 0}
                onClick={onDecide}
                className="label inline-flex items-center gap-2 rounded-[6px] bg-fg px-3 py-1.5 text-[14px] text-bg hover:bg-fg/90 disabled:cursor-not-allowed disabled:bg-panel2 disabled:text-muted"
              >
                <Gavel className="size-4" aria-hidden />
                {kind === 'regime' ? 'Принять решение' : 'Отметить разобранным'}
                {picked.length > 0 && ` · ${picked.length}`}
              </button>
            </span>
          ) : (
            <span className="ml-auto text-[14px] text-muted">{WHO_DECIDES[kind]}</span>
          ))}
      </div>
      {items.length === 0 ? (
        empty
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((d) => (
            <DeviationCard
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
        </ul>
      )}
    </section>
  )
}

interface ListProps {
  deviations: Deviation[]
  decisions: WeldDecision[]
  session: WeldingSession
  now: number
}

/**
 * Два разных списка для двух разных людей: отклонения режима — технологу,
 * нарушения порядка — мастеру.
 */
export function DeviationList({ deviations, decisions, session, now }: ListProps) {
  const role = useSession((s) => s.user?.role)
  const [selected, setSelected] = useState<Record<DeviationKind, number[]>>({ regime: [], order: [] })
  const [modal, setModal] = useState<{ kind: DeviationKind; editing: Editing<DecisionForm> } | null>(null)

  // нерассмотренные раньше рассмотренных, внутри — по времени
  const sorted = [...deviations].sort(
    (a, b) => Number(a.reviewed) - Number(b.reviewed) || Date.parse(a.startedAt) - Date.parse(b.startedAt),
  )
  const regime = sorted.filter((d) => !d.isOrganizational)
  const order = sorted.filter((d) => d.isOrganizational)
  const controlled = session.passPlan.length > 0

  const byDeviation = new Map<number, WeldDecision[]>()
  for (const x of decisions) for (const id of x.deviations) byDeviation.set(id, [...(byDeviation.get(id) ?? []), x])
  const decisionsOf = (id: number) => byDeviation.get(id) ?? []

  // выбранными считаются только те, что ещё ждут решения
  const pendingIds = new Set(deviations.filter((d) => !d.reviewed).map((d) => d.id))
  const pick = (kind: DeviationKind) => selected[kind].filter((id) => pendingIds.has(id))
  const picked = (kind: DeviationKind) => deviations.filter((d) => pick(kind).includes(d.id))

  const group = (kind: DeviationKind, title: string, items: Deviation[], empty?: ReactNode) => (
    <Group
      kind={kind}
      title={title}
      items={items}
      decisionsOf={decisionsOf}
      canSign={canDecide(role, kind)}
      selected={pick(kind)}
      setSelected={(ids) => setSelected((prev) => ({ ...prev, [kind]: ids }))}
      onDecide={() => setModal({ kind, editing: { id: null, initial: newDecision(session.id, kind, picked(kind)) } })}
      now={now}
      empty={empty}
    />
  )

  return (
    <div className="flex flex-col gap-6">
      {group(
        'regime',
        'Отклонения от режима',
        regime,
        controlled ? (
          <div className="flex items-center gap-3 rounded-[8px] bg-ok-bg px-4 py-3 text-ok ring-1 ring-ok/40">
            <CircleCheck className="size-6 shrink-0" aria-hidden />
            <span className="text-[16px]">Отклонений от режима в сеансе нет.</span>
          </div>
        ) : (
          <div className="rounded-[8px] bg-panel px-4 py-3 text-fg2 ring-1 ring-line">
            Режим не контролируется: сварка без техкарты, допусков для сравнения нет.
          </div>
        ),
      )}
      {order.length > 0 && group('order', 'Нарушения порядка', order)}

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

/** Красная полоса под заголовком экрана: по сеансу есть отклонения без решения */
export function DeviationBanner({ deviations, onShow }: { deviations: Deviation[]; onShow: () => void }) {
  const pending = deviations.filter((d) => !d.reviewed && !d.isOrganizational)
  if (pending.length === 0) return null
  const ongoing = pending.some((d) => d.finishedAt === null)
  return (
    <button
      type="button"
      onClick={onShow}
      className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-[8px] bg-crit-strong px-4 py-3.5 text-left text-surface ring-2 ring-crit hover:brightness-110"
    >
      <CircleAlert className={cn('size-8 shrink-0', ongoing && 'crit-blink')} aria-hidden />
      <span className="label text-[20px]">{ongoing ? 'Отклонение от режима сейчас' : 'Было отклонение от режима'}</span>
      <span className="min-w-0 flex-1 text-[16px]">
        {pending.map((d) => {
          const unit = DEVIATION_UNIT[d.parameter]
          return (
            <span key={d.id} className="tnum mr-3 inline-block">
              {d.parameterName.toLowerCase()}{' '}
              <b className="font-mono">
                {fmt1(d.actualValue)} {unit}
              </b>{' '}
              при допуске {fmtTol(d.plannedMin, d.plannedMax, unit)}
              {d.passNo !== null && `, проход ${d.passNo}`}
              {d.direction && d.delta !== null && ` (${d.direction === 'above' ? '+' : '−'}${fmt1(d.delta)})`},{' '}
              {formatTime(d.startedAt, true)}
            </span>
          )
        })}
      </span>
      <span className="label text-[14px] underline underline-offset-4">Подробнее ↓</span>
    </button>
  )
}
