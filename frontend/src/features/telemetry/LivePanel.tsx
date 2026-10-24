import { Flame, Unplug } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'
import type { SocketStatus } from '@/shared/types/telemetry'
import { Card } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/States'
import { formatDuration, formatLive, formatTime } from './format'
import type { Range } from './plan'
import { isFresh, type Post } from './posts'
import { SocketStatusLine } from './SocketStatusLine'

/** Допуск прохода, на котором сейчас варят: по последнему участку дуги идущего сеанса */
export interface LiveTolerance {
  passNo: number | null
  current: Range | null
  voltage: Range | null
}

interface Props {
  post: Post
  socketStatus: SocketStatus
  now: number
  large: boolean
  tolerance?: LiveTolerance | null
}

function Tile({ label, children, large, note }: { label: string; children: ReactNode; large: boolean; note?: ReactNode }) {
  return (
    <div className="min-w-0 px-5 py-4 [&+&]:border-t [&+&]:border-border md:[&+&]:border-l md:[&+&]:border-t-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className={cn('mt-1 font-heading tracking-number', large ? 'text-[88px] leading-none' : 'text-[44px] leading-tight')}>
        {children}
      </div>
      {note && <p className={cn('mt-1 text-muted', large ? 'text-lg' : 'text-caption')}>{note}</p>}
    </div>
  )
}

/** Допуск словами под цифрой. Сравнивает человек: фронт вердикт не выносит */
function toleranceNote(r: Range | null | undefined, unit: string, passNo: number | null | undefined): ReactNode {
  if (r === undefined) return undefined
  if (r === null) return 'допуска по карте нет'
  return `допуск ${formatNumber(r[0])}–${formatNumber(r[1])} ${unit}${passNo != null ? ` · проход ${passNo}` : ''}`
}

function Value({ text, unit, large }: { text: string | null; unit: string; large: boolean }) {
  if (text === null) return <span className={cn('text-muted', large ? 'text-5xl' : 'text-2xl')}>нет данных</span>
  return (
    <>
      {text}
      <span className={cn('text-muted', large ? 'ml-3 text-5xl' : 'ml-1.5 text-xl')}>{unit}</span>
    </>
  )
}

/** Что сказать под цифрами: откуда они и насколько свежие */
function Note({ post, socketStatus, now }: Omit<Props, 'large'>) {
  if (socketStatus !== 'open') return <SocketStatusLine status={socketStatus} />
  if (isFresh(post.tick, now)) {
    return <p className="text-caption text-muted">Обновлено в {formatTime(post.tick.receivedAt, true)}</p>
  }
  if (post.status === 'offline') {
    const silent = post.node?.silentSeconds
    return (
      <p className="text-caption text-warning">
        Нет связи с узлом {post.equipment.nodeId}
        {silent != null ? `: последнее сообщение ${formatDuration(silent)} назад` : ': сообщений ещё не было'}
      </p>
    )
  }
  return (
    <p className="text-caption text-muted">
      Узел {post.equipment.nodeId} на связи, но живые показания не приходят: аппарат выключен или узел их не шлёт.
    </p>
  )
}

export function LivePanel({ post, socketStatus, now, large, tolerance }: Props) {
  if (!post.equipment.nodeId) {
    return (
      <EmptyState
        icon={<Unplug />}
        title="Узел телеметрии не подключён"
        description="Живых показаний у этого аппарата нет. Номер узла задаётся в разделе «Оборудование»."
      />
    )
  }

  const tick = isFresh(post.tick, now) ? post.tick : null
  return (
    <Card>
      <div className="grid md:grid-cols-3">
        <Tile label="Ток" large={large} note={toleranceNote(tolerance && tolerance.current, 'А', tolerance?.passNo)}>
          <Value text={formatLive(tick?.i)} unit="А" large={large} />
        </Tile>
        <Tile label="Напряжение" large={large} note={toleranceNote(tolerance && tolerance.voltage, 'В', tolerance?.passNo)}>
          <Value text={formatLive(tick?.u)} unit="В" large={large} />
        </Tile>
        <Tile label="Дуга" large={large}>
          {tick === null ? (
            <Value text={null} unit="" large={large} />
          ) : tick.arc ? (
            <span className="inline-flex items-center gap-2 text-success">
              <Flame className={large ? 'size-16' : 'size-9'} aria-hidden />
              Горит
            </span>
          ) : (
            <span className="text-muted">Не горит</span>
          )}
        </Tile>
      </div>
      <div className="border-t border-border px-5 py-2.5">
        <Note post={post} socketStatus={socketStatus} now={now} />
      </div>
    </Card>
  )
}
