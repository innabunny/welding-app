import { AlertTriangle, Clock, FileText, Wrench, type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router'
import { paths } from '@/layouts/navigation'
import { cn } from '@/shared/lib/cn'
import { Skeleton } from '@/shared/ui/States'
import {
  useAwaitingControl,
  useDraftCards,
  useExpiringAttestations,
  useServiceSummary,
} from './queries'

type Tone = 'urgent' | 'soon' | 'neutral' | 'ok'

const borderTone: Record<Tone, string> = {
  urgent: 'border-l-danger',
  soon: 'border-l-warning',
  neutral: 'border-l-border',
  ok: 'border-l-success',
}

const numberTone: Record<Tone, string> = {
  urgent: 'text-danger',
  soon: 'text-warning',
  neutral: 'text-text',
  ok: 'text-text',
}

interface TileProps {
  icon: LucideIcon
  title: string
  count: number | undefined
  note: string
  tone: Tone
  loading: boolean
  failed: boolean
  to: string
}

function Tile({ icon: Icon, title, count, note, tone, loading, failed, to }: TileProps) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className={cn(
        'flex w-full flex-col items-start rounded-card border border-l-[3px] border-border bg-surface px-[18px] py-4 text-left shadow-card',
        'hover:border-l-primary',
        failed ? 'border-l-border' : borderTone[tone],
      )}
    >
      <span className="flex items-center gap-2 text-caption text-muted">
        <Icon className="size-[15px]" strokeWidth={1.8} aria-hidden />
        {title}
      </span>
      {loading ? (
        <Skeleton className="mb-1 mt-2 h-9 w-12" />
      ) : (
        <span
          className={cn(
            'mb-0.5 mt-1.5 block text-3xl font-heading tracking-number',
            failed ? 'text-muted' : numberTone[tone],
          )}
        >
          {failed ? '—' : count}
        </span>
      )}
      <span className="block text-caption text-muted">{failed ? 'данные не загрузились' : note}</span>
    </button>
  )
}

export function AttentionTiles() {
  const awaiting = useAwaitingControl()
  const expiring = useExpiringAttestations()
  const drafts = useDraftCards()
  const service = useServiceSummary()

  const expired = expiring.data?.expiredCount ?? 0
  const soon = expiring.data?.soonCount ?? 0
  const attestationCount = expired + soon
  const serviceOpen = service.data?.open ?? 0

  return (
    <section
      aria-label="Требуют действия"
      className="mb-[18px] grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4"
    >
      <Tile
        icon={AlertTriangle}
        title="Швы ждут контроля"
        count={awaiting.data?.count}
        note="операции выполнены, заключения нет"
        tone={awaiting.data?.count ? 'urgent' : 'ok'}
        loading={awaiting.isPending}
        failed={awaiting.isError}
        to={paths.welds}
      />
      <Tile
        icon={Clock}
        title="Аттестации истекают"
        count={attestationCount}
        note={expired > 0 ? `в ближайшие 60 дней, просрочено: ${expired}` : 'в ближайшие 60 дней'}
        tone={expired > 0 ? 'urgent' : soon > 0 ? 'soon' : 'ok'}
        loading={expiring.isPending}
        failed={expiring.isError}
        to={paths.attestation}
      />
      <Tile
        icon={FileText}
        title="Карты в черновиках"
        count={drafts.data?.length}
        note="не выпущены в производство"
        tone="neutral"
        loading={drafts.isPending}
        failed={drafts.isError}
        to={paths.cards}
      />
      <Tile
        icon={Wrench}
        title="Заявки на ремонт"
        count={serviceOpen}
        note="открыты, ждут механика"
        tone={service.data?.high ? 'urgent' : serviceOpen > 0 ? 'soon' : 'ok'}
        loading={service.isPending}
        failed={service.isError}
        to={paths.service}
      />
    </section>
  )
}
