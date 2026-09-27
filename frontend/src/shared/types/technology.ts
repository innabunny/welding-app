import type { DecimalString } from './common'

export interface Part {
  id: number
  number: string
  name: string
  drawingNo: string
  note: string
  isActive: boolean
  seamsCount: number
  operationsCount: number
}

export interface Operation {
  id: number
  partId: number
  partNumber: string
  seamId: number
  seamNumber: string
  seamThickness1: DecimalString | null
  seamThickness2: DecimalString | null
  number: string
  name: string
  order: number
  /** Контроль после операции: ['РК', 'ВИК'] */
  requiredControls: string[]
  /** Есть ли уже карта: на операцию можно завести только одну */
  hasCard: boolean
  cardId: number | null
  cardNo: string
  cardIsReleased: boolean
}

export interface SeamSpec {
  id: number
  partId: number
  partNumber: string
  number: string
  jointType: string
  material1Id: number | null
  material1Marka: string
  material2Id: number | null
  material2Marka: string
  thickness1: DecimalString | null
  thickness2: DecimalString | null
  /** «прямой» / «кольцевой» / пусто */
  seamType: string
  seamDiameter: DecimalString | null
  seamLength: DecimalString | null
  pos1: string
  pos2: string
  mass1: DecimalString | null
  mass2: DecimalString | null
  operationsCount: number
}

/** Карточка детали: швы и операции вложенными списками */
export interface PartDetail extends Part {
  seams: SeamSpec[]
  operations: Operation[]
}

export interface PartWrite {
  number: string
  name: string
  drawingNo: string
  note: string
  isActive: boolean
}

export interface SeamWrite {
  partId: number
  number: string
  jointType: string
  material1Id: number | null
  material2Id: number | null
  thickness1: DecimalString | null
  thickness2: DecimalString | null
  pos1: string
  pos2: string
  mass1: DecimalString | null
  mass2: DecimalString | null
  seamType: string
  seamDiameter: DecimalString | null
  seamLength: DecimalString | null
}

export interface OperationWrite {
  partId: number
  seamId: number | null
  number: string
  name: string
  order: number
  requiredControls: string[]
}

export interface PartFilters {
  search?: string
  active?: boolean
  /** Только детали, где есть операции без техкарты */
  withoutCards?: boolean
}
