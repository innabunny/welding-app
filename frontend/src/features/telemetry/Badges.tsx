// Плашки экранов телеметрии — разметка и цвета из референса заказчика
// (docs/telemetry-demo.html).

import { CircleAlert, CircleCheck, CircleDashed, CircleMinus, CirclePause, FileText, Radio, Spline, WifiOff, Wrench, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import type { PostStatus, Tolerance } from './posts'

const MODE: Record<string, { label: string; cls: string; icon: ReactNode }> = {
  'по техпроцессу': { label: 'По техкарте', cls: 'bg-panel2 text-fg ring-fg2/40', icon: <FileText /> },
  'прихватка': { label: 'Прихватка', cls: 'bg-warn/10 text-warn ring-warn/45', icon: <Spline /> },
  'отработка': { label: 'Отработка', cls: 'bg-panel2 text-fg2 ring-line border-dashed', icon: <Wrench /> },
  // узел не сообщил режим, к операции сеанс не привязан
  'не указан': { label: 'Режим не указан', cls: 'bg-panel2 text-fg2 ring-line border-dashed', icon: <CircleDashed /> },
}

export const modeLabel = (mode: string) => MODE[mode]?.label ?? (mode || 'режим не указан')

/** Режим сеанса: «По техкарте» / «Прихватка» / «Отработка» */
export function ModeChip({ mode, size = 'sm' }: { mode: string; size?: 'sm' | 'md' }) {
  const m = MODE[mode] ?? { label: mode || 'режим не указан', cls: 'bg-panel2 text-fg2 ring-line', icon: <FileText /> }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full ring-1',
        m.cls,
        size === 'md' ? 'px-2.5 py-1 text-[14px] [&_svg]:size-4' : 'px-2 py-0.5 text-xs [&_svg]:size-3.5',
      )}
    >
      {m.icon}
      {m.label}
    </span>
  )
}

/** Цветная точка типа оборудования перед «TIG · Цех 5» */
export function TypeLine({ method, workshop }: { method: string; workshop: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-fg2">
      <i className="inline-block size-2 rounded-full bg-t-arc" aria-hidden />
      {[method, workshop].filter(Boolean).join(' · ')}
    </span>
  )
}

type PostState = 'welding' | 'idle' | 'offline'

export function postState(status: PostStatus): PostState {
  if (status === 'arc') return 'welding'
  if (status === 'offline' || status === 'no-node') return 'offline'
  return 'idle'
}

/** «Варит» / «Стоит» / «Нет связи» рядом с названием аппарата */
export function PostStateChip({ status, size = 'md' }: { status: PostStatus; size?: 'md' | 'lg' }) {
  const state = postState(status)
  const pad = size === 'lg' ? 'px-3 py-1.5 text-[16px]' : 'px-2.5 py-1 text-[14px]'
  if (state === 'welding') {
    return (
      <span className={cn('label inline-flex items-center gap-2 rounded-[6px] bg-arc/10 text-arc ring-1 ring-arc/40', pad)}>
        <span className="arc-dot inline-block size-2.5 rounded-full bg-arc" aria-hidden />
        <Zap className="size-4" aria-hidden />
        Варит
      </span>
    )
  }
  if (state === 'idle') {
    return (
      <span className={cn('label inline-flex items-center gap-2 rounded-[6px] bg-panel2 text-fg2 ring-1 ring-line', pad)}>
        <CirclePause className="size-4" aria-hidden />
        Стоит
      </span>
    )
  }
  return (
    <span className={cn('label inline-flex items-center gap-2 rounded-[6px] bg-panel2 text-muted ring-1 ring-line', pad)}>
      <WifiOff className="size-4" aria-hidden />
      Нет связи
    </span>
  )
}

const STATE: Record<PostStatus, { label: string; cls: string; icon: ReactNode }> = {
  arc: { label: 'Варит', cls: 'bg-arc/10 text-arc ring-arc/40', icon: <span className="arc-dot inline-block size-2 rounded-full bg-arc" /> },
  standby: { label: 'Режим ожидания', cls: 'bg-panel2 text-fg ring-fg2/40', icon: <CirclePause /> },
  session: { label: 'Режим ожидания', cls: 'bg-panel2 text-fg ring-fg2/40', icon: <CirclePause /> },
  free: { label: 'На связи', cls: 'bg-ok-bg text-ok ring-ok/40', icon: <Radio /> },
  offline: { label: 'Нет связи', cls: 'bg-panel2 text-muted ring-line', icon: <WifiOff /> },
  'no-node': { label: 'Узел не заведён', cls: 'bg-panel2 text-muted ring-line', icon: <CircleDashed /> },
}

/** Состояние поста в строке списка: варит / ожидание / на связи / нет связи / узел не заведён */
export function StateCell({ status }: { status: PostStatus }) {
  const s = STATE[status]
  return (
    <span className={cn('label inline-flex items-center gap-1.5 whitespace-nowrap rounded-[6px] px-2 py-1 text-xs ring-1 [&_svg]:size-3.5', s.cls)}>
      {s.icon}
      {s.label}
    </span>
  )
}

/** «В допуске» / «Вне допуска» в углу плитки живого значения */
export function FitChip({ fit }: { fit: 'in' | 'out' | 'none' }) {
  if (fit === 'in') {
    return (
      <span className="label inline-flex items-center gap-1.5 rounded-[6px] bg-ok-bg px-2.5 py-1 text-[14px] text-ok ring-1 ring-ok/40">
        <CircleCheck className="size-4" aria-hidden />В допуске
      </span>
    )
  }
  if (fit === 'out') {
    return (
      <span className="label inline-flex items-center gap-1.5 rounded-[6px] bg-crit-strong px-2.5 py-1 text-[14px] text-surface">
        <CircleAlert className="size-4" aria-hidden />
        Вне допуска
      </span>
    )
  }
  return null
}

/**
 * Колонка «Допуск» списка. Вне допуска и было отклонение — сплошная
 * красная плашка: за ним может стоять переварка
 */
export function ToleranceCell({ tolerance }: { tolerance: Tolerance }) {
  if (tolerance === 'uncontrolled') return <span className="whitespace-nowrap text-[14px] text-muted">не контролируется</span>
  if (tolerance === 'ok') {
    return (
      <span className="label inline-flex items-center gap-1.5 whitespace-nowrap text-[14px] text-ok">
        <CircleCheck className="size-4" aria-hidden />В допуске
      </span>
    )
  }
  return (
    <span className="label inline-flex items-center gap-1.5 whitespace-nowrap rounded-[4px] bg-crit-strong px-2 py-1 text-[14px] text-surface">
      <CircleAlert className="size-4" aria-hidden />
      {tolerance === 'out-now' ? 'Вне допуска' : 'Было отклонение'}
    </span>
  )
}

export type ArcVerdict = 'ok' | 'deviation' | 'unassigned' | 'no-plan'

/** Итог участка дуги */
export function VerdictCell({ v }: { v: ArcVerdict }) {
  if (v === 'ok') {
    return (
      <span className="label inline-flex items-center gap-1.5 text-[14px] text-ok">
        <CircleCheck className="size-4" aria-hidden />В допуске
      </span>
    )
  }
  if (v === 'deviation') {
    return (
      <span className="label inline-flex items-center gap-1.5 rounded-[4px] bg-crit-strong px-2 py-0.5 text-[14px] text-surface">
        <CircleAlert className="size-4" aria-hidden />
        Отклонение
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[14px] text-muted">
      <CircleMinus className="size-4" aria-hidden />
      {v === 'unassigned' ? 'Не оценивается' : 'Нет режима в техкарте'}
    </span>
  )
}
