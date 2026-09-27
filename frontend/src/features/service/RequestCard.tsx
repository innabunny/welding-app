import { CheckCheck, CircleSlash, Clock, Play } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { formatDate, formatWhen } from '@/shared/lib/format'
import type { ServiceRequest } from '@/shared/types/service'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { priorityMeta, reasonMeta, statusMeta } from './labels'
import type { Outcome } from './CloseRequestModal'

interface Props {
  request: ServiceRequest
  /** Механик и администратор ведут заявки; мастер только подаёт */
  canHandle: boolean
  busy: boolean
  onTake: () => void
  onClose: (outcome: Outcome) => void
}

// полоса слева по срочности: карточку с высокой видно краем глаза
const stripe = { низкая: 'border-l-border', средняя: 'border-l-warning', высокая: 'border-l-danger' } as const

export function RequestCard({ request, canHandle, busy, onTake, onClose }: Props) {
  const reason = reasonMeta[request.reason]
  const priority = priorityMeta[request.priority]
  const status = statusMeta[request.status]

  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-card border border-l-4 border-border bg-surface p-4 shadow-card',
        stripe[request.priority],
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold" title={request.equipmentName}>
            {request.equipmentName}
          </h3>
          <p className="truncate text-xs text-muted">{request.methodName || 'способ не указан'}</p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold">
          <reason.icon className="size-3.5 text-muted" aria-hidden />
          {reason.label}
        </span>
        {/* срочность — цветом и словом: цвет не считывается при дальтонизме */}
        <Badge tone={priority.tone}>{priority.label} срочность</Badge>
      </div>

      <p className="line-clamp-4 whitespace-pre-line break-words text-sm">
        {request.description || <span className="text-muted">Без описания</span>}
      </p>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-3">
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Clock className="size-3.5" aria-hidden />
          <span>
            {request.authorName || 'Без автора'} ·{' '}
            <time dateTime={request.createdAt} title={formatDate(request.createdAt)}>
              {formatWhen(request.createdAt)}
            </time>
          </span>
        </p>
        {canHandle && (
          <div className="flex flex-wrap gap-1.5">
            {/* опасное действие — серое, красное только под курсором */}
            <Button
              variant="ghost"
              onClick={() => onClose('rejected')}
              disabled={busy}
              className="h-8 px-2.5 hover:bg-danger-soft hover:text-danger"
            >
              <CircleSlash aria-hidden />
              Отклонить
            </Button>
            {request.status === 'open' ? (
              <Button onClick={onTake} disabled={busy} className="h-8 px-3" icon={<Play />}>
                Взять в работу
              </Button>
            ) : (
              <Button onClick={() => onClose('done')} disabled={busy} className="h-8 px-3" icon={<CheckCheck />}>
                Закрыть
              </Button>
            )}
          </div>
        )}
      </footer>
    </article>
  )
}
