// Сводка «Сварочное производство»: /api/telemetry-summary/
// Всё посчитано на бэкенде (apps/welding/summary.py), фронт только показывает.

/** Тип оборудования: дуговая, контактная, электронно-лучевая, диффузионная */
export type EquipmentType = 'arc' | 'contact' | 'ebw' | 'diff'

export interface LoadTotals {
  /** полный фонд времени по графику */
  fundSeconds: number
  /** прошедшая часть фонда */
  elapsedSeconds: number
  arcSeconds: number
  standbySeconds: number
  idleSeconds: number
  noDataSeconds: number
  /** время горения дуги от прошедшей части фонда, 0…1 */
  kz: number
}

export interface SummaryLoad extends LoadTotals {
  remainingSeconds: number
  equipmentCount: number
  daily: { date: string; kz: number; arcSeconds: number; fundSeconds: number }[]
  /** только за сегодня, если смена по графику есть */
  shift: {
    startsAt: string
    endsAt: string
    elapsedSeconds: number
    fundSeconds: number
    inShift: boolean
    onBreak: boolean
  } | null
}

export interface SummaryDeviations {
  total: number
  analyzed: number
  pending: number
  byMethod: { method: string; type: EquipmentType; count: number }[]
  latest: {
    id: number
    startedAt: string
    equipmentName: string
    parameter: string
    parameterName: string
    actualValue: string | null
    plannedMin: string | null
    plannedMax: string | null
    reviewed: boolean
  }[]
}

export interface MaterialLine {
  name: string
  unit: string
  amount: number
}

export type QualityGroup = 'без отклонений' | 'допущено' | 'на контроль' | 'не рассмотрено' | 'на переварку'

export interface TypeWorks {
  seams: number
  lengthM: number
  parts: number
  partsFinished: number
  inProgress: number
  byProcess: { process: string; label: string; seams: number; lengthM: number }[]
  joints: number
  quality: Record<QualityGroup, number>
  coverage: {
    techSeconds: number
    trialSeconds: number
    tackSeconds: number
    noCardSeconds: number
    totalSeconds: number
  }
  daily: { date: string; seams: number; lengthM: number }[]
}

export interface TypeSlice extends LoadTotals {
  type: EquipmentType
  units: number
  activeNow: number
  offline: number
  deviations: number
  unreviewed: number
}

export interface TelemetrySummary {
  from: string
  to: string
  load: SummaryLoad
  deviations: SummaryDeviations
  materials: MaterialLine[]
  works: Record<EquipmentType, TypeWorks>
  types: TypeSlice[]
}

export interface SummaryFilters {
  from: string
  to: string
  workshop?: number
  type?: EquipmentType
  equipment?: number
  welder?: number
}
