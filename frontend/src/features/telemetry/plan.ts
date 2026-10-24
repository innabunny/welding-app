// Допуски из техкарты: только поиск по ссылкам, ничего не считается.
// Участок дуги → plannedPassId → проход в passPlan сеанса.

import { toNumber } from '@/shared/lib/format'
import type { DecimalString } from '@/shared/types/common'
import type { Deviation } from '@/shared/types/deviations'
import type { ArcRun, PassPlan } from '@/shared/types/telemetry'
import type { WeldingSession } from '@/shared/types/welding'

export type Range = [number, number]

/** Диапазон из двух DecimalField; null, если хоть одной границы нет */
export function range(min: DecimalString | null, max: DecimalString | null): Range | null {
  const lo = toNumber(min)
  const hi = toNumber(max)
  return lo === null || hi === null ? null : [lo, hi]
}

export interface PlanIndex {
  /** проход по карте для участка дуги; null — проход не определён или карты нет */
  passForArc: (arcId: number | null | undefined) => PassPlan | null
  passById: (id: number | null | undefined) => PassPlan | null
}

export function indexPlan(plan: PassPlan[], arcs: ArcRun[]): PlanIndex {
  const byId = new Map(plan.map((p) => [p.id, p]))
  const arcPass = new Map(arcs.map((a) => [a.id, a.plannedPassId]))
  const passById = (id: number | null | undefined) => (id == null ? null : (byId.get(id) ?? null))
  return {
    passById,
    passForArc: (arcId) => (arcId == null ? null : passById(arcPass.get(arcId))),
  }
}

/** Отклонения, которые пришлись на участок: тот же проход или то же время */
export function deviationsOnArc(arc: ArcRun, deviations: Deviation[], now: number): Deviation[] {
  const start = Date.parse(arc.startedAt)
  const end = arc.finishedAt ? Date.parse(arc.finishedAt) : now
  return deviations.filter((d) => {
    if (d.isOrganizational) return false
    if (arc.passRun !== null && d.passRun !== null) return d.passRun === arc.passRun
    const ds = Date.parse(d.startedAt)
    const de = d.finishedAt ? Date.parse(d.finishedAt) : now
    return ds <= end && de >= start
  })
}


// ───────────── живая подсветка ─────────────
// Сравнение живого значения с коридором — отображение, а не расчёт:
// нигде не хранится и живёт до следующего значения. Отклонения
// по-прежнему фиксирует только бэкенд при разборе.

export type LiveCorridor =
  /** техкарты нет: сравнивать не с чем */
  | { kind: 'uncontrolled' }
  /** коридор известного прохода; passNo null — у всех проходов он одинаковый */
  | { kind: 'pass'; passNo: number | null; current: Range | null; voltage: Range | null }
  /**
   * проход горящего участка неизвестен (его назначит разбор после сеанса):
   * крайние границы всех проходов. Вне них — точно вне любого прохода
   */
  | { kind: 'envelope'; current: Range | null; voltage: Range | null }

function envelope(ranges: (Range | null)[]): Range | null {
  const known = ranges.filter((r): r is Range => r !== null)
  if (known.length === 0) return null
  return [Math.min(...known.map((r) => r[0])), Math.max(...known.map((r) => r[1]))]
}

const sameRanges = (a: PassPlan, b: PassPlan) =>
  a.currentMin === b.currentMin && a.currentMax === b.currentMax &&
  a.voltageMin === b.voltageMin && a.voltageMax === b.voltageMax

export function liveCorridor(session: WeldingSession): LiveCorridor {
  const plan = session.passPlan
  const first = plan[0]
  if (!first) return { kind: 'uncontrolled' }

  const current = plan.find((p) => p.id === session.currentPlannedPassId)
  const known = current ?? (plan.length === 1 ? first : undefined)
  if (known) {
    return {
      kind: 'pass',
      passNo: known.no,
      current: range(known.currentMin, known.currentMax),
      voltage: range(known.voltageMin, known.voltageMax),
    }
  }
  if (plan.every((p) => sameRanges(p, first))) {
    return {
      kind: 'pass',
      passNo: null,
      current: range(first.currentMin, first.currentMax),
      voltage: range(first.voltageMin, first.voltageMax),
    }
  }
  return {
    kind: 'envelope',
    current: envelope(plan.map((p) => range(p.currentMin, p.currentMax))),
    voltage: envelope(plan.map((p) => range(p.voltageMin, p.voltageMax))),
  }
}

/** Попадание в коридор: 'none' — сравнивать не с чем */
export type Fit = 'in' | 'out' | 'none'

export function fit(value: number | null | undefined, r: Range | null | undefined): Fit {
  if (value === null || value === undefined || !r) return 'none'
  return value < r[0] || value > r[1] ? 'out' : 'in'
}
