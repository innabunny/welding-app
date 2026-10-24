import { AlertOctagon, CheckCircle2, ShieldOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { formatNumber, formatRange, plural } from '@/shared/lib/format'
import type { Deviation } from '@/shared/types/deviations'
import type { WeldingSession } from '@/shared/types/welding'
import { EmptyState } from '@/shared/ui/States'
import { DeviationStatusBadge } from './Badges'
import { formatDuration, formatTime } from './format'
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

function DeviationItem({ d }: { d: Deviation }) {
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
        {pending && <AlertOctagon className="size-5 shrink-0 text-danger" aria-hidden />}
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
    </article>
  )
}

function Group({ title, who, items }: { title: string; who: string; items: Deviation[] }) {
  const pending = items.filter((d) => !d.reviewed).length
  return (
    <section>
      <h3 className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
        {title} · {items.length}
        <span className="font-normal text-muted">{who}</span>
        {pending > 0 && <span className="text-danger">ждут решения: {pending}</span>}
      </h3>
      <div className="grid gap-3">
        {items.map((d) => (
          <DeviationItem key={d.id} d={d} />
        ))}
      </div>
    </section>
  )
}

/**
 * Два разных списка для двух разных людей: отклонения режима — технологу,
 * нарушения порядка — мастеру.
 */
export function DeviationList({ deviations, session }: { deviations: Deviation[]; session: WeldingSession }) {
  // новые сверху, нерассмотренные раньше рассмотренных
  const sorted = [...deviations].sort(
    (a, b) => Number(a.reviewed) - Number(b.reviewed) || Date.parse(b.startedAt) - Date.parse(a.startedAt),
  )
  const regime = sorted.filter((d) => !d.isOrganizational)
  const order = sorted.filter((d) => d.isOrganizational)
  const controlled = session.passPlan.length > 0

  return (
    <div className="grid gap-5">
      {regime.length > 0 ? (
        <Group title="Отклонения режима" who="технологу" items={regime} />
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
      {order.length > 0 && <Group title="Нарушения порядка" who="мастеру" items={order} />}
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
