import type { DecimalString, IsoDate, IsoDateTime } from './common'

export type WeldStatus = 'in_work' | 'done' | 'accepted' | 'rejected'

export interface Weld {
  id: number
  instanceId: number
  seamId: number
  partNumber: string
  serialNo: string
  seamNumber: string
  seamThickness1: DecimalString | null
  seamThickness2: DecimalString | null
  status: WeldStatus
  runsCount: number
  createdAt: IsoDateTime
}

export type InstanceKind = 'штатное' | 'свидетель'

/** Паспорт шва: план, факт и контроль одним ответом — собирается из связей */
export interface WeldPassport extends Weld {
  partName: string
  instanceKind: InstanceKind
  material1Marka: string
  material2Marka: string
  jointType: string
  seamType: string
  seamLength: DecimalString | null
  operations: OperationRun[]
}

export interface WeldFilters {
  search?: string
  part?: string
  status?: WeldStatus | ''
}

/** GET /welds/awaiting_control/ — операция выполнена, заключения нет */
export interface AwaitingControlItem {
  runId: number
  weldId: number
  partNumber: string
  serialNo: string
  seamNumber: string
  operationNumber: string
  finishedAt: IsoDateTime | null
  missing: string[]
}

export interface AwaitingControl {
  count: number
  items: AwaitingControlItem[]
}

export type InspectionResult = 'годен' | 'исправление' | 'брак'
export type InspectionKind = 'промежуточный' | 'окончательный'
export type InspectionMethod = 'ВИК' | 'РК' | 'УЗК' | 'ПВК' | 'МК'
export type InspectionSpecimen = 'шов' | 'свидетель' | 'вырезка'

/** Дефект: набор полей у разных типов разный, классификатора пока нет */
export type Defect = Record<string, unknown>

export interface Inspection {
  id: number
  runId: number
  kind: InspectionKind
  kindDisplay: string
  method: InspectionMethod
  methodDisplay: string
  specimen: InspectionSpecimen
  result: InspectionResult
  resultDisplay: string
  defects: Defect[]
  reportNo: string
  inspectedAt: IsoDate | null
  inspectorName: string
  conclusion: string
}

/** Тело POST: контролёра сервер подставит сам */
export interface InspectionCreate {
  runId: number
  kind: InspectionKind
  method: InspectionMethod
  specimen: InspectionSpecimen
  result: InspectionResult
  defects: Defect[]
  reportNo: string
  inspectedAt: IsoDate | null
  conclusion: string
}

/** Считается сериализатором на лету, числа здесь — уже number */
export interface CurrentRange {
  min: number | null
  max: number | null
}

export interface ActualCurrent {
  avg: number
  /** Могут не прийти от узла — тогда null */
  min: number | null
  max: number | null
}

export interface Deviation {
  state: 'в допуске' | 'выше' | 'ниже'
  percent: number
}

export interface WeldPassRun {
  id: number
  no: number
  plannedPassId: number | null
  startedAt: IsoDateTime | null
  finishedAt: IsoDateTime | null
  arcTime: string | null
  matchSource: string
  matchSourceDisplay: string
  plannedCurrent: CurrentRange | null
  actualCurrent: ActualCurrent | null
  deviation: Deviation | null
}

export type OperationRunStatus = 'in_work' | 'done'

export interface OperationRun {
  id: number
  weldId: number
  operationId: number
  operationNumber: string
  cardId: number
  cardNo: string
  methodName: string
  welderId: number | null
  welderFio: string
  equipmentId: number | null
  equipmentName: string
  startedAt: IsoDateTime | null
  finishedAt: IsoDateTime | null
  status: OperationRunStatus
  sizeBefore: DecimalString | null
  sizeAfter: DecimalString | null
  measuredAt: IsoDateTime | null
  shrinkage: DecimalString | number | null
  requiredControls: string[]
  controlsMissing: string[]
  note: string
  passes: WeldPassRun[]
  inspections: Inspection[]
}

export interface WeldingSession {
  id: number
  equipmentId: number
  equipmentName: string
  welderId: number | null
  welderName: string
  mode: string
  modeDisplay: string
  operationRunId: number | null
  routeCodeRaw: string
  startedAt: IsoDateTime
  finishedAt: IsoDateTime | null
  arcsCount: number
}
