import { formatNumber } from '@/shared/lib/format'

/** «2» или «2 / 3», если позиции разной толщины */
export function thicknessText(t1: string | null, t2: string | null): string {
  const a = formatNumber(t1, 2)
  const b = formatNumber(t2, 2)
  if (t2 === null || a === b) return a
  if (t1 === null) return b
  return `${a} / ${b}`
}

export function materialsText(m1: string, m2: string): string {
  if (m1 && m2 && m1 !== m2) return `${m1} + ${m2}`
  return m1 || m2 || '—'
}

export function rangeError(min: string | null, max: string | null): string | undefined {
  if (min === null || max === null) return undefined
  const lo = Number(min)
  const hi = Number(max)
  if (Number.isFinite(lo) && Number.isFinite(hi) && lo > hi) return '«От» больше «до»'
  return undefined
}

/** 120.0 → «120», 1.250 → «1,25» */
export function num(value: string | null): string {
  if (value === null) return ''
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString('ru-RU', { maximumFractionDigits: 3 }) : value
}

/** «120–140»; если «от» и «до» совпали — одним числом */
export function rangeText(min: string | null, max: string | null): string {
  const a = num(min)
  const b = num(max)
  if (!a || !b) return a || b
  return a === b ? a : `${a}–${b}`
}
