import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import type { WeldingSession } from '@/shared/types/welding'
import { Panel } from '@/shared/ui/Card'
import { ModeBadge } from './Badges'
import { formatClock, formatDuration, formatStart, secondsSince } from './format'
import { STALE_SESSION_SECONDS } from './posts'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold">{children}</dd>
    </div>
  )
}

export function SessionCard({ session, now, large }: { session: WeldingSession; now: number; large: boolean }) {
  const open = session.finishedAt === null
  const length = open
    ? secondsSince(session.startedAt, now)
    : (Date.parse(session.finishedAt ?? '') - Date.parse(session.startedAt)) / 1000
  const stale = open && length !== null && length > STALE_SESSION_SECONDS

  return (
    <Panel
      title={stale ? 'Сеанс не закрыт' : open ? 'Сеанс идёт' : 'Сеанс закрыт'}
      subtitle={`с ${formatStart(session.startedAt, now)}${open ? '' : ` по ${formatStart(session.finishedAt, now)}`}`}
    >
      <dl className={cn('grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4', large && 'text-lg')}>
        <Field label="Сварщик">{session.welderName || <span className="text-muted">не опознан</span>}</Field>
        <Field label="Режим работы">
          <ModeBadge mode={session.mode} label={session.modeDisplay} />
        </Field>
        {!stale && (
          <Field label={open ? 'Идёт' : 'Длительность'}>
            <span className="font-mono">{open ? formatClock(length) : formatDuration(length)}</span>
          </Field>
        )}
        <Field label="Участков дуги">{session.arcsCount}</Field>
        {session.routeCodeRaw && <Field label="Код маршрутного листа">{session.routeCodeRaw}</Field>}
      </dl>
      {stale && (
        <p className="mt-3 text-caption text-warning">
          Сеанс открыт дольше смены. Скорее всего, узел не прислал его окончание, и сеанс надо закрыть.
        </p>
      )}
      {session.mode !== 'по техпроцессу' && (
        <p className="mt-3 text-caption text-muted">
          Сварка не по техпроцессу: шва по чертежу у этого сеанса нет, сверки с техкартой не будет.
        </p>
      )}
    </Panel>
  )
}
