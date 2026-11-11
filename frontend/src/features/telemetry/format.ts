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

/** Молчание узла: дольше суток — «6 сут», иначе как formatDuration */
export function formatSilence(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return DASH
  if (seconds >= 86_400) return `${Math.floor(seconds / 86_400)} сут`
  return formatDuration(seconds)
}

/** «пт, 16.10.2026 11:47»; без времени — «пт, 16.10.2026» */
export function formatDay(iso: string | null | undefined, withTime = true): string {
  if (!iso) return DASH
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return DASH
  const day = `${d.toLocaleDateString('ru-RU', { weekday: 'short' })}, ${d.toLocaleDateString('ru-RU')}`
  return withTime ? `${day} ${formatTime(iso)}` : day
}

// ───────────── как в референсе заказчика ─────────────

const ONE = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const INT = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Значение с одной десятой: «150,6», «140,0» */
export function fmt1(v: number | string | null | undefined): string {
  const n = num(v)
  return n === null ? DASH : ONE.format(n)
}

/** Допуск: «140–160 А», «≤ 10 А»; целые без десятых */
export function fmtTol(min: number | string | null | undefined, max: number | string | null | undefined, unit: string): string {
  const lo = num(min)
  const hi = num(max)
  const f = (n: number) => (Number.isInteger(n) ? INT.format(n) : ONE.format(n))
  const u = unit ? ` ${unit}` : ''
  if (lo === null && hi === null) return DASH
  if (lo === null && hi !== null) return `≤ ${f(hi)}${u}`
  if (hi === null && lo !== null) return `≥ ${f(lo)}${u}`
  return `${f(lo as number)}–${f(hi as number)}${u}`
}

/** Длительность: «4,2 с», «42 с», «27 мин 24 с», «1 ч 05 мин» */
export function fmtSpan(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return DASH
  if (seconds < 10) return `${ONE.format(seconds)} с`
  const t = Math.round(seconds)
  if (t < 60) return `${t} с`
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h} ч ${pad(m)} мин` : `${m} мин ${pad(t % 60)} с`
}

/** Целое: «1 697» */
export function fmtInt(v: number | null | undefined): string {
  return v === null || v === undefined || !Number.isFinite(v) ? DASH : INT.format(v)
}

/** Доля в процентах: 0,537 → «54 %» */
export const fmtPct = (share: number) => `${INT.format(share * 100)} %`

/** Часы и минуты: «5 ч 16 мин», «44 мин» */
export function fmtHM(seconds: number): string {
  const m = Math.round(seconds / 60)
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r} мин`
  return r === 0 ? `${h} ч` : `${h} ч ${r} мин`
}

/** Часы: «2,8 ч», «160 ч» */
export function fmtHours(seconds: number): string {
  const t = seconds / 3600
  const n = Math.round(t * 10) / 10
  return t < 10 && !Number.isInteger(n) ? `${ONE.format(t)} ч` : `${INT.format(t)} ч`
}

/** До суток — часы и минуты, дольше — часы */
export const fmtTime = (seconds: number) => (seconds < 86_400 ? fmtHM(seconds) : fmtHours(seconds))

/** «пт, 16.10» — подпись столбика по дням */
export function fmtDayShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return `${d.toLocaleDateString('ru-RU', { weekday: 'short' })}, ${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}`
}

/** «пятница, 16.10.2026» или «пт, 16.10.2026» */
export function fmtDate(value: string | number, long = false): string {
  const d = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value)
  return `${d.toLocaleDateString('ru-RU', { weekday: long ? 'long' : 'short' })}, ${d.toLocaleDateString('ru-RU')}`
}
