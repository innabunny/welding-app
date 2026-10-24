// Форматирование для экранов телеметрии. Общие числа — в shared/lib/format.

import { formatNumber } from '@/shared/lib/format'

const DASH = '—'

/** 19 380 → «5 ч 23 мин», 960 → «16 мин», 42 → «42 с» */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return DASH
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return m > 0 ? `${h} ч ${m} мин` : `${h} ч`
  if (m > 0) return `${m} мин`
  return `${s} с`
}

/** Секундомер: 883 → «14:43», 3723 → «1:02:03» */
export function formatClock(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return DASH
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h > 0 ? 2 : 1, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Время суток «13:31» из ISO или миллисекунд */
export function formatTime(value: string | number | null | undefined, withSeconds = false): string {
  if (value === null || value === undefined || value === '') return DASH
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return DASH
  return d.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
  })
}

/** «24.10 13:31» — когда сеанс начался не сегодня, дата нужна */
export function formatStart(iso: string | null | undefined, now: number): string {
  if (!iso) return DASH
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return DASH
  const today = new Date(now).toDateString() === d.toDateString()
  if (today) return formatTime(iso)
  return `${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} ${formatTime(iso)}`
}

/** Секунды от момента до сейчас; null, если даты нет */
export function secondsSince(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? null : (now - t) / 1000
}

/** Живое значение: «142,5». null — «нет данных» показывает вызывающий */
export function formatLive(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : formatNumber(value, 1)
}

/** «Иванов Иван Петрович» → «Иванов И.П.» — для узких столбцов */
export function shortName(full: string): string {
  const [last, ...rest] = full.trim().split(/\s+/)
  if (!last) return ''
  const init = rest.map((p) => `${p[0]?.toUpperCase() ?? ''}.`).join('')
  return init ? `${last} ${init}` : last
}
