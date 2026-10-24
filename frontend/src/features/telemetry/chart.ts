// Точки графика сеанса в том виде, который нужен recharts.

import type { SessionSamplePoint } from '@/shared/types/telemetry'

export interface ChartRow {
  /** начало корзины, мс */
  t: number
  /** среднее по корзине; null — разрыв, линия здесь не рисуется */
  i: number | null
  /** разброс внутри корзины [min, max] для полосы вокруг среднего */
  band: [number, number] | null
  u: number | null
  arcId: number | null
}

/**
 * Пустые корзины сервер не присылает: между проходами просто нет точек.
 * Без вставки recharts соединил бы проходы прямой. Если между соседними
 * точками больше двух ширин корзины — вставляем пустую точку, и линия
 * обрывается. Пустые корзины с сервера не запрашиваем: между проходами
 * деталь крутят минутами, это тысячи бесполезных точек.
 */
export function toChartRows(points: SessionSamplePoint[], stepMs: number): ChartRow[] {
  const rows: ChartRow[] = []
  let prev: SessionSamplePoint | undefined
  for (const p of points) {
    if (prev && stepMs > 0 && p.t - prev.t > 2 * stepMs) {
      rows.push({ t: prev.t + stepMs, i: null, band: null, u: null, arcId: null })
    }
    rows.push({ t: p.t, i: p.i, band: [p.iMin, p.iMax], u: p.u, arcId: p.arcId })
    prev = p
  }
  return rows
}

export function isChartRow(v: unknown): v is ChartRow {
  return typeof v === 'object' && v !== null && 't' in v && 'i' in v && 'u' in v
}

const MINUTE = 60_000
const TICK_STEPS_MIN = [1, 2, 5, 10, 15, 30, 60, 120]

/** Ровные метки времени на оси: 13:15, 13:20, 13:25… — около target штук */
export function timeTicks(from: number, to: number, target = 8): number[] {
  if (!(to > from)) return []
  const spanMin = (to - from) / MINUTE
  const step = (TICK_STEPS_MIN.find((s) => spanMin / s <= target) ?? 240) * MINUTE
  // метки по местному времени: смещение пояса, чтобы 13:15 было ровно 13:15
  const offset = new Date(from).getTimezoneOffset() * MINUTE
  const ticks: number[] = []
  for (let t = Math.ceil((from - offset) / step) * step + offset; t <= to; t += step) ticks.push(t)
  return ticks
}
