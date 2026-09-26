import type { DecimalString, IsoDateTime } from './common'

export type WeldStatus = 'in_work' | 'done' | 'accepted' | 'rejected'

export interface Weld {
  id: number
  instanceId: number
  seamId: number
  partNumber: string
  serialNo: string
  seamNumber: string
  status: WeldStatus
  runsCount: number
  createdAt: IsoDateTime
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

export interface Inspection {
  id: number
  runId: number
  kind: string
  kindDisplay: string
  method: string
  methodDisplay: string
  specimen: string
  result: InspectionResult
  resultDisplay: string
  defects: string
  reportNo: string
  inspectedAt: IsoDateTime | null
  inspectorName: string
  conclusion: string
}

/** Считается сериализатором на лету, числа здесь — уже number */
export interface CurrentRange {
  min: number | null
  max: number | null
}

export interface ActualCurrent {
  avg: number
  min: number
  max: number
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
