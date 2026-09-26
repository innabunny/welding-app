import { Zap } from 'lucide-react'
import { Link } from 'react-router'
import { useEquipmentList } from '@/features/equipment/queries'
import { paths } from '@/layouts/navigation'
import { cn } from '@/shared/lib/cn'
import { plural } from '@/shared/lib/format'
import type { Equipment } from '@/shared/types/equipment'
import type { WeldingSession } from '@/shared/types/welding'
import { Panel } from '@/shared/ui/Card'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'
import { useActiveSessions } from './queries'

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function Machine({ item, session }: { item: Equipment; session: WeldingSession | undefined }) {
  const live = Boolean(session)
  const hasNode = Boolean(item.nodeId)
  const state = !item.isActive
    ? 'Не в работе'
    : live
      ? 'Варит'
      : hasNode
        ? 'Простой'
        : 'Без телеметрии'
  const place = [item.workshopName, item.workstationNumber && `пост ${item.workstationNumber}`]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      className={cn(
        'rounded-box border p-[13px]',
        live ? 'border-success/45' : 'border-border',
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-heading">{item.name}</div>
          <div className="mt-0.5 text-xs text-muted">
            {[item.methodDesignation || item.methodName, place || 'без поста'].join(' · ')}
          </div>
        </div>
        <div className={cn('flex shrink-0 items-center gap-[5px] text-xs', live ? 'text-success' : 'text-muted')}>
          <i className={cn('size-[7px] rounded-full', live ? 'bg-success' : 'bg-muted')} />
          {state}
        </div>
      </div>
      {session ? (
        <div className="mt-[11px] flex gap-4">
          <div>
            <b className="block font-mono text-base font-semibold">{timeOf(session.startedAt)}</b>
            <span className="text-xs text-muted">начало сеанса</span>
          </div>
          <div className="min-w-0">
            <b className="block truncate text-base font-semibold">{session.welderName || '—'}</b>
            <span className="text-xs text-muted">сварщик</span>
          </div>
        </div>
      ) : (
        <div className="mt-[11px] text-caption text-muted">
          {hasNode ? `Узел ${item.nodeId}` : 'Узел не подключён'}
        </div>
      )}
    </div>
  )
}

export function EquipmentFleet() {
  const equipment = useEquipmentList({})
  const sessions = useActiveSessions()

  const items = equipment.data ?? []
  const withNode = items.filter((e) => e.nodeId).length
  const sessionByEquipment = new Map((sessions.data ?? []).map((s) => [s.equipmentId, s]))

  let body
  if (equipment.isPending) body = <SkeletonRows rows={2} />
  else if (equipment.isError)
    body = <ErrorState error={equipment.error} onRetry={() => equipment.refetch()} />
  else if (items.length === 0)
    body = (
      <EmptyState
        icon={<Zap />}
        title="Установки не заведены"
        description="Добавьте установки в реестре оборудования."
        action={
          <Link to={paths.equipment} className="text-sm text-primary hover:underline">
            Открыть реестр
          </Link>
        }
      />
    )
  else
    body = (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2.5">
        {items.map((item) => (
          <Machine key={item.id} item={item} session={sessionByEquipment.get(item.id)} />
        ))}
      </div>
    )

  const subtitle = equipment.data
    ? `${items.length} ${plural(items.length, ['установка', 'установки', 'установок'])} · телеметрия подключена к ${withNode}`
    : undefined

  return (
    <Panel
      title="Парк оборудования"
      subtitle={subtitle}
      className="mt-[18px]"
      action={
        <Link to={paths.equipment} className="px-1 py-0.5 text-sm text-primary hover:text-primary-hover hover:underline">
          Реестр
        </Link>
      }
    >
      {body}
    </Panel>
  )
}
