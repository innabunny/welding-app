import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import type { WeldingSession } from '@/shared/types/welding'
import { modeLabel } from './Badges'
import { fmtSpan, formatDay, formatTime } from './format'
import { STALE_SESSION_SECONDS } from './posts'

function Field({ label, children, mono = false, wide = false }: { label: string; children: ReactNode; mono?: boolean; wide?: boolean }) {
  return (
    <div className={cn('flex min-w-0 flex-col', wide && 'col-span-2')}>
      <dt className="label text-xs text-muted">{label}</dt>
      <dd className={cn('text-[16px] text-fg', mono && 'tnum font-mono')}>{children}</dd>
    </div>
  )
}

/** «Текущий сеанс»: кто варит, в каком режиме и что */
export function SessionCard({ session, now }: { session: WeldingSession; now: number }) {
  const open = session.finishedAt === null
  const end = open ? now : Date.parse(session.finishedAt ?? '')
  const length = (end - Date.parse(session.startedAt)) / 1000
  const stale = open && length > STALE_SESSION_SECONDS
  const byCard = session.cardId !== null

  return (
    <section aria-label="Сеанс" className="rounded-[8px] bg-panel px-5 py-4 ring-1 ring-line">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="label text-[16px] text-fg">{stale ? 'Сеанс не закрыт' : open ? 'Текущий сеанс' : 'Сеанс'}</h2>
        <span className="font-mono text-[14px] text-muted">{String(session.id).padStart(4, '0')}</span>
        <span className="text-[14px] text-fg2">
          {formatDay(session.startedAt, false)} · {formatTime(session.startedAt, true)} –{' '}
          {open ? 'идёт' : formatTime(session.finishedAt, true)} · {fmtSpan(length)}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="Сварщик" wide>
          {session.welderName || 'не опознан'}
        </Field>
        <Field label="Режим работы">{modeLabel(session.mode)}</Field>
        <Field label="Деталь" mono={byCard && !!session.partNumber}>
          {byCard && session.partNumber ? session.partNumber : 'без привязки'}
        </Field>
        <Field label="Зав. №" mono>
          {session.serialNo || '—'}
        </Field>
        <Field label="Шов · операция" mono>
          {session.seamNumber ? `${session.seamNumber} · ${session.operationNumber || '—'}` : '—'}
        </Field>
      </dl>
      {stale && (
        <p className="mt-3 text-[14px] text-warn">
          Сеанс открыт дольше смены. Скорее всего, узел не прислал его окончание, и сеанс надо закрыть.
        </p>
      )}
    </section>
  )
}
