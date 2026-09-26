import { Check, Clock, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { paths } from '@/layouts/navigation'
import { formatShortDate, plural } from '@/shared/lib/format'
import type { WeldStatus } from '@/shared/types/welding'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'
import { Panel } from '@/shared/ui/Card'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'
import { weldTitle } from './deviation'
import { useWelds } from './queries'

const statusView: Record<WeldStatus, { tone: BadgeTone; label: string; icon?: ReactNode }> = {
  accepted: { tone: 'green', label: 'Принят', icon: <Check strokeWidth={2.4} /> },
  rejected: { tone: 'red', label: 'Забракован', icon: <X strokeWidth={2.4} /> },
  done: { tone: 'gray', label: 'Ждёт контроля', icon: <Clock strokeWidth={2.4} /> },
  in_work: { tone: 'blue', label: 'В работе' },
}

export function RecentWelds() {
  const query = useWelds()

  let body
  if (query.isPending) body = <SkeletonRows rows={4} />
  else if (query.isError) body = <ErrorState error={query.error} onRetry={() => query.refetch()} />
  else if (query.data.length === 0)
    body = (
      <EmptyState
        title="Швов пока нет"
        description="Шов появляется, когда на изделие заводят первую операцию."
      />
    )
  else
    body = (
      <ul>
        {query.data.slice(0, 5).map((weld) => {
          const view = statusView[weld.status]
          return (
            <li
              key={weld.id}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border py-[11px] last:border-b-0"
            >
              <div className="min-w-0">
                <strong className="block truncate text-sm font-semibold">{weldTitle(weld)}</strong>
                <span className="text-xs text-muted">
                  {weld.runsCount} {plural(weld.runsCount, ['операция', 'операции', 'операций'])}
                </span>
              </div>
              <Badge tone={view.tone} icon={view.icon}>
                {view.label}
              </Badge>
              <span className="font-mono text-xs text-muted">{formatShortDate(weld.createdAt)}</span>
            </li>
          )
        })}
      </ul>
    )

  return (
    <Panel
      title="Последние швы"
      subtitle="Статус шва"
      action={
        <Link to={paths.welds} className="px-1 py-0.5 text-sm text-primary hover:text-primary-hover hover:underline">
          Журнал
        </Link>
      }
    >
      {body}
    </Panel>
  )
}
