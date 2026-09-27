import {
  FIELDS,
  extraName,
  isExtra,
  type FieldSpec,
  type MethodCode,
  type WeldingMode,
} from '@/shared/config/methodFields'
import type { SeamSpec } from '@/shared/types/technology'
import type { WeldingCard, WeldingCardWrite, WeldPass } from '@/shared/types/weldingCards'

/** 'material_1_id' → 'material1Id' — так же, как мост camelCase на бэке */
export function camel(snake: string): string {
  return snake.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

export function isMethodCode(value: string): value is MethodCode {
  return FIELDS.some((f) => f.methods.includes(value as MethodCode))
}

export function modeOf(weldingMode: string): WeldingMode {
  return weldingMode === 'импульсный' ? 'pulse' : 'continuous'
}

export interface DecimalFormat {
  kind: 'decimal'
  /** max_digits из DecimalField */
  digits: number
  /** decimal_places из DecimalField */
  places: number
  negative?: boolean
}

export type InputFormat =
  | DecimalFormat
  | { kind: 'text'; maxLength: number }
  | { kind: 'tungsten' }
  | { kind: 'filler' }
  | { kind: 'gas' }
  | { kind: 'flux' }
  | { kind: 'mode' }

const dec = (digits: number, places: number, negative = false): DecimalFormat => ({
  kind: 'decimal',
  digits,
  places,
  negative,
})

/**
 * Разрядность — как в DecimalField моделей WeldingCard и WeldPass.
 * У полей из extra (JSON) базы нет, разрядность — наша договорённость.
 */
const FORMATS: Record<string, InputFormat> = {
  // карта
  tungsten_id: { kind: 'tungsten' },
  filler_id: { kind: 'filler' },
  shield_gas_id: { kind: 'gas' },
  backing_gas_id: { kind: 'gas' },
  plasma_gas_id: { kind: 'gas' },
  flux_id: { kind: 'flux' },
  welding_mode: { kind: 'mode' },
  plasma_nozzle_d: dec(5, 1),
  heat_treatment: { kind: 'text', maxLength: 200 },
  'extra.electrode_angle': dec(5, 1),
  'extra.stickout': dec(5, 1),
  'extra.offset': dec(5, 1, true),
  'extra.focus_distance': dec(6, 1),
  'extra.accel_voltage': dec(5, 1),
  // вакуум пишут и как «1·10⁻²», и сопло как «№8» — текстом
  'extra.vacuum': { kind: 'text', maxLength: 50 },
  'extra.nozzle': { kind: 'text', maxLength: 50 },
  // проход
  current: dec(7, 1),
  voltage: dec(6, 1),
  speed_raw: dec(10, 3),
  wire_speed: dec(7, 2),
  gas_flow: dec(6, 1),
  backing_flow: dec(6, 1),
  plasma_flow: dec(6, 1),
  pass_filler_id: { kind: 'filler' },
  filler_diameter: dec(5, 1),
  pulse_current: dec(7, 1),
  pulse_time: dec(7, 3),
  pause_current: dec(7, 1),
  pause_time: dec(7, 3),
  beam_current: dec(8, 2),
  'extra.voltage_start': dec(5, 1),
  'extra.arc_gap': dec(5, 1),
  'extra.focus_current': dec(7, 1),
  'extra.temperature': dec(6, 0),
  'extra.pressure': dec(7, 2),
  'extra.hold_time': dec(6, 1),
}

export function formatOf(f: FieldSpec): InputFormat {
  return FORMATS[f.key] ?? { kind: 'text', maxLength: 200 }
}

/** Ключ в объекте: extra.env_welding → envWelding (внутри extra), pass_filler_id → fillerId */
export function propName(f: FieldSpec): string {
  if (isExtra(f)) return camel(extraName(f))
  if (f.key === 'pass_filler_id') return 'fillerId'
  return camel(f.key)
}

/** Ключи «от» и «до» для диапазона: current → currentMin / currentMax */
export function rangeProps(f: FieldSpec): [string, string] {
  const base = camel(f.key)
  return [`${base}Min`, `${base}Max`]
}

type Bag = Record<string, unknown>

function asText(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null
}

/** Значение поля карты или прохода: extra смотрится внутри extra */
export function readValue(obj: WeldingCardWrite | WeldPass, f: FieldSpec): unknown {
  if (isExtra(f)) return obj.extra[propName(f)]
  return (obj as unknown as Bag)[propName(f)]
}

export function readText(obj: WeldingCardWrite | WeldPass, f: FieldSpec, prop?: string): string | null {
  if (prop) return asText((obj as unknown as Bag)[prop])
  return asText(readValue(obj, f))
}

/** Новое значение поля: extra обновляется целиком, пустое из extra удаляем */
export function writeValue<T extends WeldingCardWrite | WeldPass>(obj: T, f: FieldSpec, value: unknown): T {
  if (isExtra(f)) {
    const extra = { ...obj.extra }
    const name = propName(f)
    if (value === null || value === '') delete extra[name]
    else extra[name] = String(value)
    return { ...obj, extra }
  }
  return { ...obj, [propName(f)]: value }
}

/** Поля шва — только чтение, приходят по цепочке операция → шов */
export function seamValue(f: FieldSpec, card: Partial<WeldingCard>, seam: SeamSpec | undefined): string | null {
  switch (f.key) {
    case 'material_1_id':
      return seam?.material1Marka || card.material1Marka || null
    case 'material_2_id':
      return seam?.material2Marka || card.material2Marka || null
    case 'thickness_1':
      return asText(seam?.thickness1 ?? card.seamThickness1)
    case 'thickness_2':
      return asText(seam?.thickness2 ?? card.seamThickness2)
    case 'seam_type':
      return seam?.seamType || card.seamType || null
    case 'seam_diameter':
      return asText(seam?.seamDiameter ?? card.seamDiameter)
    default:
      return seam ? asText((seam as unknown as Bag)[camel(f.key)]) : null
  }
}
