import { Link } from 'react-router'
import { LOGIN_PAGE } from '@/shared/api/client'
import { cn } from '@/shared/lib/cn'
import type { SocketStatus } from '@/shared/types/telemetry'

const TEXT: Record<SocketStatus, string> = {
  open: 'Живые показания идут',
  connecting: 'Подключение к живым показаниям…',
  reconnecting: 'Связь с порталом прервалась, переподключаюсь…',
  unauthorized: 'Вход в портал истёк, живые показания не приходят.',
}

/** Состояние соединения с порталом — не путать со связью узла с порталом */
export function SocketStatusLine({ status, className }: { status: SocketStatus; className?: string }) {
  const dot =
    status === 'open' ? 'bg-success' : status === 'unauthorized' ? 'bg-danger' : 'animate-pulse bg-warning'
  const next = window.location.pathname + window.location.search
  return (
    <p className={cn('flex items-center gap-2 text-caption text-muted', className)} role="status">
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', dot)} />
      {TEXT[status]}
      {status === 'unauthorized' && (
        <Link className="font-semibold text-primary hover:underline" to={`${LOGIN_PAGE}?next=${encodeURIComponent(next)}`}>
          Войти заново
        </Link>
      )}
    </p>
  )
}
