// Решение по отклонениям: правила формы. Те же правила проверяет сервер,
// здесь они нужны, чтобы не предлагать человеку недоступное.

import type { UserRole } from '@/shared/types/auth'
import {
  ORDER_RESULTS,
  REGIME_RESULTS,
  type DecisionResult,
  type Deviation,
  type WeldDecisionDraft,
} from '@/shared/types/deviations'

/** Отклонения режима — технологу, нарушения порядка — мастеру */
export type DeviationKind = 'regime' | 'order'

export const kindOf = (d: Deviation): DeviationKind => (d.isOrganizational ? 'order' : 'regime')

export const RESULTS: Record<DeviationKind, DecisionResult[]> = {
  regime: REGIME_RESULTS,
  order: ORDER_RESULTS,
}

/** Кто какой список может решать. Технолог разбирает и нарушения порядка — так было до мастера */
const SIGNERS: Record<DeviationKind, UserRole[]> = {
  regime: ['admin', 'technologist'],
  order: ['admin', 'technologist', 'master'],
}

export const canDecide = (role: UserRole | undefined, kind: DeviationKind) =>
  role !== undefined && SIGNERS[kind].includes(role)

export const WHO_DECIDES: Record<DeviationKind, string> = {
  regime: 'Решение по отклонениям режима принимает технолог.',
  order: 'Нарушения порядка разбирает мастер.',
}

/** Черновик формы: решение ещё не выбрано — пустая строка */
export interface DecisionForm extends Omit<WeldDecisionDraft, 'result' | 'reason' | 'assignedControl'> {
  result: DecisionResult | ''
  reason: string
  assignedControl: string
}

/**
 * Одно решение — один шов и одна операция: технолог решает судьбу
 * шва, а не каждой просадки. Отклонения другой операции решаются отдельно.
 */
export const sameWork = (a: Deviation, b: Deviation) => a.runId === b.runId && a.weldId === b.weldId

export function newDecision(sessionId: number, kind: DeviationKind, picked: Deviation[]): DecisionForm {
  const first = picked[0]
  return {
    session: sessionId,
    weld: first?.weldId ?? null,
    run: first?.runId ?? null,
    deviations: picked.map((d) => d.id),
    // у нарушения порядка решение одно — выбирать нечего
    result: kind === 'order' ? 'разобрано' : '',
    reason: '',
    assignedControl: '',
  }
}

export function toDraft(form: DecisionForm): WeldDecisionDraft {
  if (form.result === '') throw new Error('Выберите решение')
  return {
    ...form,
    result: form.result,
    reason: form.reason.trim(),
    // вид контроля нужен только при «на контроль»; иначе не отправляем мусор
    assignedControl: form.result === 'на контроль' ? form.assignedControl.trim() : '',
  }
}
