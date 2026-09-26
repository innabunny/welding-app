import type { DecimalString } from './common'

export interface MaterialGroup {
  id: number
  code: string
}

export type MaterialGroupWrite = Omit<MaterialGroup, 'id'>

export interface Material {
  id: number
  marka: string
  groupId: number | null
  groupCode: string | null
  /** Предел прочности, кгс/мм² */
  tensileStrength: DecimalString | null
}

export interface MaterialWrite {
  marka: string
  groupId: number | null
  tensileStrength: DecimalString | null
}

/** Значения — русские строки, как в choices модели */
export type FillerKind = 'присадочная проволока' | 'электрод' | 'вольфрам'

export interface FillerMaterial {
  id: number
  marka: string
  kind: FillerKind
  /** Диаметр, мм */
  diameter: DecimalString | null
  /** «Св-08Г2С Ø1.2» — собирает бэк */
  label: string
}

export interface FillerMaterialWrite {
  marka: string
  kind: FillerKind
  diameter: DecimalString | null
}

export type GasFluxKind = 'gas' | 'flux'

export interface GasFlux {
  id: number
  kind: GasFluxKind
  value: string
}

export type GasFluxWrite = Omit<GasFlux, 'id'>
