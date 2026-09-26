import type { DecimalString } from '@/shared/types/common'

const DASH = '—'

/** Строку DecimalField в число. null, если пусто или не число. */
export function toNumber(value: DecimalString | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** 11.8 → «11,8». Лишние нули не показываем: 132.0 → «132». */
export function formatNumber(
  value: DecimalString | number | null | undefined,
  maxFractionDigits = 1,
): string {
  const n = toNumber(value)
  if (n === null) return DASH
  return n.toLocaleString('ru-RU', { maximumFractionDigits: maxFractionDigits })
}

export function formatRange(
  min: DecimalString | number | null | undefined,
  max: DecimalString | number | null | undefined,
): string {
  const lo = toNumber(min)
  const hi = toNumber(max)
  if (lo === null && hi === null) return DASH
  if (lo === null) return `до ${formatNumber(hi)}`
  if (hi === null) return `от ${formatNumber(lo)}`
  return `${formatNumber(lo)}–${formatNumber(hi)}`
}

/** «24.09» — для коротких списков */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return DASH
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return DASH
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

/** «24.09.2026» */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return DASH
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return DASH
  return d.toLocaleDateString('ru-RU')
}

/** «24 сентября 2026, среда» */
export function formatLongDate(date: Date): string {
  const day = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  const weekday = date.toLocaleDateString('ru-RU', { weekday: 'long' })
  return `${day.replace(/\s*г\.$/, '')}, ${weekday}`
}

/** Целых дней от сегодня до даты: отрицательное — уже прошла */
export function daysUntil(isoDate: string, today = new Date()): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  const target = Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((target - now) / 86_400_000)
}

/** Склонение: plural(3, ['установка', 'установки', 'установок']) */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '')
  return letters.join('') || '?'
}
