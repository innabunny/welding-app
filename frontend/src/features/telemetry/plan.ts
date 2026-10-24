// Допуски из техкарты: только поиск по ссылкам, ничего не считается.
// Участок дуги → plannedPassId → проход в passPlan сеанса.

import { toNumber } from '@/shared/lib/format'
import type { DecimalString } from '@/shared/types/common'
import type { Deviation } from '@/shared/types/deviations'
import type { ArcRun, PassPlan } from '@/shared/types/telemetry'

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
