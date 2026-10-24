// Точки графика в том виде, который нужен recharts.

import { range, type Range } from './plan'
import type { PassPlan } from '@/shared/types/telemetry'

/** Общее у точек сеанса и точек одного участка */
export interface SamplePointLike {
  t: number
  i: number
  iMin: number
  iMax: number
  u: number
  uMin?: number
  uMax?: number
  arcId?: number
}

export interface ChartRow {
  /** начало корзины, мс */
  t: number
  /** среднее по корзине; null — разрыв, линия здесь не рисуется */
  i: number | null
  /** разброс тока внутри корзины [min, max] */
  band: Range | null
  u: number | null
  /** разброс напряжения; есть только у графика одного участка */
  uBand: Range | null
  /** допуск по току из карты для прохода этой точки */
  iTol: Range | null
  /** допуск по напряжению из карты */
  uTol: Range | null
  arcId: number | null
}

const GAP: Omit<ChartRow, 't'> = { i: null, band: null, u: null, uBand: null, iTol: null, uTol: null, arcId: null }

/**
 * Пустые корзины сервер не присылает: между проходами просто нет точек.
 * Без вставки recharts соединил бы проходы прямой. Если между соседними
 * точками больше двух ширин корзины — вставляем пустую точку, и линия
 * обрывается. Пустые корзины с сервера не запрашиваем: между проходами
 * деталь крутят минутами, это тысячи бесполезных точек.
 *
 * passFor — проход по карте для точки (по её участку дуги). Коридор
 * допуска рисуется по проходу, а не один на весь сеанс.
 */
export function toChartRows(
  points: SamplePointLike[],
  stepMs: number,
  passFor: (p: SamplePointLike) => PassPlan | null = () => null,
): ChartRow[] {
  const rows: ChartRow[] = []
  let prev: SamplePointLike | undefined
  for (const p of points) {
    if (prev && stepMs > 0 && p.t - prev.t > 2 * stepMs) rows.push({ t: prev.t + stepMs, ...GAP })
    const pass = passFor(p)
    rows.push({
      t: p.t,
      i: p.i,
      band: [p.iMin, p.iMax],
      u: p.u,
      uBand: p.uMin !== undefined && p.uMax !== undefined ? [p.uMin, p.uMax] : null,
      iTol: pass ? range(pass.currentMin, pass.currentMax) : null,
      uTol: pass ? range(pass.voltageMin, pass.voltageMax) : null,
      arcId: p.arcId ?? null,
    })
    prev = p
  }
  return rows
}

export function isChartRow(v: unknown): v is ChartRow {
  return typeof v === 'object' && v !== null && 't' in v && 'i' in v && 'u' in v
}

const MINUTE = 60_000
const SECOND = 1_000
// для графика одного участка шкала мельче минуты
const TICK_STEPS_MS = [10, 15, 30].map((s) => s * SECOND).concat([1, 2, 5, 10, 15, 30, 60, 120].map((m) => m * MINUTE))

/** Ровные метки времени на оси: 13:15, 13:20, 13:25… — около target штук */
export function timeTicks(from: number, to: number, target = 8): number[] {
  if (!(to > from)) return []
  const span = to - from
  const step = TICK_STEPS_MS.find((s) => span / s <= target) ?? 240 * MINUTE
  // метки по местному времени: смещение пояса, чтобы 13:15 было ровно 13:15
  const offset = new Date(from).getTimezoneOffset() * MINUTE
  const ticks: number[] = []
  for (let t = Math.ceil((from - offset) / step) * step + offset; t <= to; t += step) ticks.push(t)
  return ticks
}
