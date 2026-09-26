import type { DecimalString } from './common'

export interface SpeedUnit {
  id: number
  code: string
  name: string
  /** Угловая единица (об/мин): для пересчёта в м/ч нужен диаметр шва */
  isAngular: boolean
  toMPerH: DecimalString | null
}

export type EquipmentParameterLevel = 'card' | 'pass'

export interface EquipmentParameter {
  id: number
  code: string
  name: string
  unit: string
  level: EquipmentParameterLevel
  printed: boolean
  order: number
}

export interface Equipment {
  id: number
  name: string
  methodId: string
  methodName: string
  methodDesignation: string
  workstationId: number | null
  /** Пустая строка, если установка не привязана к посту */
  workstationNumber: string
  sectionName: string
  workshopName: string
  nodeId: string | null
  nodeIp: string | null
  /** id единиц скорости, связь многие-ко-многим */
  speedUnits: number[]
  /** id дополнительных параметров, связь многие-ко-многим */
  parameters: number[]
  hasPulse: boolean
  isActive: boolean
}

/**
 * Тело POST/PUT. speedUnits и parameters обязательны: бэк заменяет связи
 * тем, что пришло, и пустой массив сотрёт их у установки.
 */
export interface EquipmentWrite {
  name: string
  methodId: string
  workstationId: number | null
  nodeId: string | null
  nodeIp: string | null
  speedUnits: number[]
  parameters: number[]
  hasPulse: boolean
  isActive: boolean
}

export interface EquipmentFilters {
  method?: string
  workshop?: number
  active?: boolean
}
