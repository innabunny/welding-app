import { ShieldCheck } from 'lucide-react'
import { Link } from 'react-router'
import { paths } from '@/layouts/navigation'
import { daysUntil } from '@/shared/lib/format'
import type { AttestationListItem } from '@/shared/types/attestation'
import { Pill } from '@/shared/ui/Badge'
import { Panel } from '@/shared/ui/Card'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'
import { useExpiringAttestations } from './queries'

function termLabel(days: number): string {
  if (days < 0) return `−${Math.abs(days)} дн`
  if (days < 60) return `${days} дн`
  return `${Math.round(days / 30)} мес`
}

function Row({ item }: { item: AttestationListItem }) {
  const days = item.validUntil ? daysUntil(item.validUntil) : null
  const tone = item.expiryState === 'expired' ? 'red' : item.expiryState === 'soon' ? 'yellow' : 'green'
  const details = [item.methodName, item.groupCode && `группа ${item.groupCode}`]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="flex items-center gap-[11px] rounded-tile bg-surface-2 px-3 py-[11px]">
      <Pill tone={tone}>{days === null ? '—' : termLabel(days)}</Pill>
      <div className="min-w-0">
        <strong className="block truncate text-sm font-semibold">{item.welderFio}</strong>
        <span className="text-xs text-muted">{details}</span>
      </div>
    </li>
  )
}

export function AttestationPanel() {
  const query = useExpiringAttestations()

  let body
  if (query.isPending) body = <SkeletonRows rows={4} />
  else if (query.isError) body = <ErrorState error={query.error} onRetry={() => query.refetch()} />
  else if (query.data.items.length === 0)
    body = (
      <EmptyState
        icon={<ShieldCheck />}
        title="Сроки в порядке"
        description="Нет просроченных допусков и таких, что истекают в ближайшие 60 дней."
      />
    )
  else
    body = (
      <ul className="grid gap-2">
        {query.data.items.slice(0, 5).map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </ul>
    )

  return (
    <Panel
      title="Допуски сварщиков"
      subtitle="Ближайшие сроки"
      action={
        <Link to={paths.attestation} className="px-1 py-0.5 text-sm text-primary hover:text-primary-hover hover:underline">
          Реестр
        </Link>
      }
    >
      {body}
    </Panel>
  )
}
