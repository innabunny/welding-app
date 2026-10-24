import { AlertOctagon, Calculator, CheckCircle2, CircleSlash, Crosshair, Flame, Hourglass, PlugZap, Unplug, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Deviation } from '@/shared/types/deviations'
import type { MatchSource } from '@/shared/types/telemetry'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'
import type { PostStatus } from './posts'

const STATUS: Record<PostStatus, { label: string; tone: BadgeTone; icon: ReactNode }> = {
  arc: { label: 'Варит', tone: 'green', icon: <Flame /> },
  standby: { label: 'Режим ожидания', tone: 'blue', icon: <Hourglass /> },
  session: { label: 'Сеанс открыт', tone: 'blue', icon: <Hourglass /> },
  free: { label: 'Нет сеанса', tone: 'gray', icon: <CircleSlash /> },
  offline: { label: 'Нет связи', tone: 'yellow', icon: <WifiOff /> },
  'no-node': { label: 'Узел не подключён', tone: 'gray', icon: <Unplug /> },
}

export function PostStatusBadge({ status }: { status: PostStatus }) {
  const s = STATUS[status]
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {s.label}
    </Badge>
  )
}

/** Режим сеанса: по техпроцессу / отработка / прихватка */
export function ModeBadge({ mode, label }: { mode: string; label: string }) {
  const tone: BadgeTone = mode === 'по техпроцессу' ? 'blue' : 'gray'
  return <Badge tone={tone}>{label || mode || 'режим не указан'}</Badge>
}

/**
 * Нерассмотренные отклонения. Оформлено как тревога, а не подсказка:
 * за ним может стоять переварка дорогой детали.
 */
export function PendingDeviations({ regime, order }: { regime: number; order: number }) {
  if (regime === 0 && order === 0) return <span className="text-muted">нет</span>
  return (
    <div className="flex flex-col items-start gap-1">
      {regime > 0 && (
        <Badge tone="red" icon={<AlertOctagon />}>
          Отклонение режима: {regime}
        </Badge>
      )}
      {order > 0 && (
        <Badge tone="red" icon={<PlugZap />}>
          Нарушение порядка: {order}
        </Badge>
      )}
    </div>
  )
}

/**
 * Как определена граница прохода. Тон — достоверность: датчик и человек
 * надёжны, ток и пауза — косвенное подтверждение, расчёт — только время.
 */
const MATCH_TONE: Record<MatchSource, BadgeTone> = {
  'вручную': 'green',
  'датчик': 'green',
  'ток': 'blue',
  'пауза': 'blue',
  'расчёт': 'yellow',
}

export function MatchSourceBadge({ source, label }: { source: MatchSource | ''; label: string }) {
  if (source === '') return <Badge tone="gray">проход не определён</Badge>
  return (
    <Badge tone={MATCH_TONE[source]} icon={source === 'расчёт' ? <Calculator /> : <Crosshair />}>
      {label || source}
    </Badge>
  )
}

/** Судьба отклонения: решения ещё нет — это тревога, а не подсказка */
export function DeviationStatusBadge({ deviation }: { deviation: Deviation }) {
  if (deviation.reviewed) {
    return (
      <Badge tone="gray" icon={<CheckCircle2 />}>
        Решение принято
      </Badge>
    )
  }
  return (
    <Badge tone="red" icon={<AlertOctagon />}>
      {deviation.finishedAt === null ? 'Продолжается' : 'Ждёт решения'}
    </Badge>
  )
}
