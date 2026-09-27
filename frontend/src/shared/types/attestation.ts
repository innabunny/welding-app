import type { DecimalString, IsoDate, IsoDateTime } from './common'

/** Считается на бэке: '' — срока нет, soon — 60 дней и меньше */
export type ExpiryState = '' | 'valid' | 'soon' | 'expired'

export interface AttestationListItem {
  id: number
  welderFio: string
  welderWorkshop: string
  methodName: string
  groupCode: string
  kind: string
  status: string
  statusDisplay: string
  attestedAt: IsoDate | null
  validUntil: IsoDate | null
  expiryState: ExpiryState
  protocolNo: string
  certificateNo: string
  itemsCount: number
  createdAt: IsoDateTime
}

/** GET /attestations/expiring/ — просроченные и истекающие в 60 дней */
export interface AttestationExpiring {
  expiredCount: number
  soonCount: number
  items: AttestationListItem[]
}

export type AttestationStatus = 'draft' | 'testing' | 'protocol' | 'review' | 'done'
export type AttestationKind = 'первичная' | 'периодическая'

/** Образец: пара материалов, на которой варят пробу */
export interface AttestationItem {
  /** Нет у нового образца; по id сервер правит образец на месте */
  id?: number
  sampleNo: string
  // имена material1/material2 — так их отдаёт бэк, мост camelCase иначе ломает цифру
  material1: number | null
  material1Marka?: string
  material2: number | null
  material2Marka?: string
  /** Однородное соединение: вторая марка не заполняется */
  uniform: boolean
  thicknessMin: DecimalString | null
  thicknessMax: DecimalString | null
  wireId: number | null
  wireText?: string
  fluxId: number | null
  fluxText?: string
  gasId: number | null
  gasText?: string
  position: string
  preheat: string
  heatTreatment: string
  // результаты испытаний — поля 19–25 протокола
  vikResult: string
  physicalProtocol: string
  metallographyProtocol: string
  tensileStrength: DecimalString | null
  bendAngle: DecimalString | null
  impactStrength: string
  otherMethods: string
  /** Требования правила на момент отправки на испытания — только чтение */
  requirementsSnapshot?: Record<string, unknown>
}

/** Реквизиты и итоги — правятся и после отправки на испытания */
export interface AttestationPhase2 {
  status: AttestationStatus
  attestedAt: IsoDate | null
  protocolNo: string
  certificateNo: string
  practicalEval: string
  conclusion: string
  chairman: string
  headShop: string
  headBtk: string
  items: AttestationItem[]
}

export interface AttestationWrite extends AttestationPhase2 {
  welderId: number | null
  methodId: string
  groupId: number | null
  kind: AttestationKind
  /** Виды контроля строчными: ['вик', 'рк'] */
  controls: string[]
}

export interface Attestation extends AttestationWrite {
  id: number
  welderId: number
  welderFio: string
  welderWorkshop: string
  methodName: string
  groupId: number
  groupCode: string
  statusDisplay: string
  /** Считает сервер: дата аттестации + 3 года */
  validUntil: IsoDate | null
  expiryState: ExpiryState
  createdAt: IsoDateTime
}

export interface AttestationFilters {
  search?: string
  status?: AttestationStatus | ''
  method?: string
  workshop?: string
  expiry?: Exclude<ExpiryState, ''> | ''
  welder?: string
}

export interface AttestationRule {
  id: number
  methodId: string
  methodName: string
  groupId: number
  groupCode: string
  thFrom: DecimalString
  /** null — «и выше» */
  thTo: DecimalString | null
  requiredOutput: Record<string, unknown>
  isActive: boolean
}

export interface WelderListItem {
  id: number
  fio: string
  personnelNo: string
  workshopName: string
  rank: string
  experienceYears: number | null
  isAttested: boolean
  attestationsCount: number
  /** Худший срок среди допусков */
  expiryState: ExpiryState
  isActive: boolean
}

export interface WelderWrite {
  fio: string
  personnelNo: string
  birthDate: IsoDate | null
  education: string
  workshopId: number | null
  weldingSince: IsoDate | null
  rank: string
  rfidUid: string | null
  isActive: boolean
}

export interface Welder extends WelderWrite {
  id: number
  workshopName: string
  age: number | null
  experienceYears: number | null
}
