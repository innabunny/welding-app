// Отклонения и решения: /api/deviations/, /api/weld-decisions/

/** Параметр, по которому зафиксировано отклонение. */
export type DeviationParameter =
  | 'ток'
  | 'напряжение'
  | 'скорость'
  | 'ток_импульса'
  | 'ток_паузы'
  | 'межслойная'
  // ниже — нарушения порядка, а не режима
  | 'без_карты'
  | 'без_допуска';

export type Severity = 'замечание' | 'предупреждение' | 'нарушение';

export type SessionMode = 'по техпроцессу' | 'отработка' | 'прихватка';

export interface Deviation {
  id: number;
  session: number;
  passRun: number | null;

  parameter: DeviationParameter;
  parameterName: string;
  severity: Severity;
  severityName: string;
  /** true — нарушение порядка: идёт мастеру, а не технологу */
  isOrganizational: boolean;

  /** числа приходят строками — DecimalField */
  plannedMin: string | null;
  plannedMax: string | null;
  actualValue: string | null;
  deviationPercent: string | null;

  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;

  /** есть ли по нему решение */
  reviewed: boolean;

  equipmentName: string;
  welderName: string;
  mode: SessionMode | '';

  /** цепочка до детали заполнена только при сварке по техпроцессу */
  partNumber: string;
  serialNo: string;
  seamNumber: string;
  operationNumber: string;
  passNo: number | null;
  /** куда отправлять решение */
  weldId: number | null;
  runId: number | null;
}

export type DecisionResult =
  | 'допущено'
  | 'на контроль'
  | 'на переварку'
  | 'разобрано';

export interface WeldDecision {
  id: number;
  session: number;
  weld: number | null;
  run: number | null;

  result: DecisionResult;
  resultName: string;
  /** идентификаторы закрытых отклонений */
  deviations: number[];

  author: number;
  /** снимок подписи на момент решения */
  authorName: string;
  createdAt: string;

  reason: string;
  /** обязательно при result = 'на контроль' */
  assignedControl: string;

  equipmentName: string;
  partNumber: string;
  serialNo: string;
  seamNumber: string;
  operationNumber: string;
}

/** То, что уходит на сервер при создании решения. */
export interface WeldDecisionDraft {
  session: number;
  weld?: number | null;
  run?: number | null;
  result: DecisionResult;
  deviations: number[];
  reason?: string;
  assignedControl?: string;
}

export interface DeviationSummary {
  /** отклонения режима — очередь технолога */
  regime: {
    total: number;
    pending: number;
    info: number;
    warning: number;
    critical: number;
  };
  /** нарушения порядка — мастеру */
  order: {
    total: number;
    pending: number;
    noCard: number;
    noAttestation: number;
  };
}

export const DECISION_LABELS: Record<DecisionResult, string> = {
  'допущено': 'Допущено без мероприятий',
  'на контроль': 'Назначен дополнительный контроль',
  'на переварку': 'Выборка и переварка',
  'разобрано': 'Разобрано, мероприятия приняты',
};

/** Решения, применимые к отклонению режима. */
export const REGIME_RESULTS: DecisionResult[] = [
  'допущено', 'на контроль', 'на переварку',
];

/** Решения, применимые к нарушению порядка. */
export const ORDER_RESULTS: DecisionResult[] = ['разобрано'];