import { AxiosError } from 'axios'
import { FIELDS, editableFieldsFor, isExtra, type MethodCode, type WeldingMode } from '@/shared/config/methodFields'
import { fieldErrors } from '@/shared/api/errors'
import type { WeldingCard, WeldingCardWrite, WeldPass } from '@/shared/types/weldingCards'
import { formatOf, propName, rangeProps, writeValue } from './fields'

export function emptyPass(no: number): WeldPass {
  return {
    no,
    currentMin: null,
    currentMax: null,
    voltageMin: null,
    voltageMax: null,
    speedUnitId: null,
    speedRawMin: null,
    speedRawMax: null,
    speedRequired: false,
    wireSpeedMin: null,
    wireSpeedMax: null,
    gasFlowMin: null,
    gasFlowMax: null,
    backingFlowMin: null,
    backingFlowMax: null,
    plasmaFlowMin: null,
    plasmaFlowMax: null,
    fillerId: null,
    fillerDiameter: null,
    pulseCurrent: null,
    pulseTime: null,
    pauseCurrent: null,
    pauseTime: null,
    beamCurrent: null,
    extra: {},
  }
}

export const emptyCard: WeldingCardWrite = {
  cardNo: '',
  revision: 1,
  operationId: null,
  methodId: '',
  equipmentId: null,
  weldingMode: 'непрерывный',
  tungstenId: null,
  fillerId: null,
  shieldGasId: null,
  backingGasId: null,
  plasmaGasId: null,
  fluxId: null,
  plasmaNozzleD: null,
  heatTreatment: '',
  grooveType: '',
  grooveAngle: null,
  grooveGap: null,
  grooveRoot: null,
  grooveCap: null,
  grooveRootCap: null,
  grooveWidth: null,
  grooveSvg: '',
  extra: {},
  passes: [emptyPass(1)],
  isReleased: false,
}

export function toWrite(card: WeldingCard): WeldingCardWrite {
  return {
    cardNo: card.cardNo,
    revision: card.revision,
    operationId: card.operationId,
    methodId: card.methodId,
    equipmentId: card.equipmentId,
    weldingMode: card.weldingMode,
    tungstenId: card.tungstenId,
    fillerId: card.fillerId,
    shieldGasId: card.shieldGasId,
    backingGasId: card.backingGasId,
    plasmaGasId: card.plasmaGasId,
    fluxId: card.fluxId,
    plasmaNozzleD: card.plasmaNozzleD,
    heatTreatment: card.heatTreatment,
    grooveType: card.grooveType,
    grooveAngle: card.grooveAngle,
    grooveGap: card.grooveGap,
    grooveRoot: card.grooveRoot,
    grooveCap: card.grooveCap,
    grooveRootCap: card.grooveRootCap,
    grooveWidth: card.grooveWidth,
    grooveSvg: card.grooveSvg,
    extra: { ...card.extra },
    // у карты без проходов даём один пустой: сохранять пустой массив нельзя
    passes: card.passes.length > 0 ? card.passes.map((p) => ({ ...p, extra: { ...p.extra } })) : [emptyPass(1)],
    isReleased: card.isReleased,
  }
}

/**
 * Значения полей, которых у способа и режима нет, не отправляем:
 * после смены способа они остались бы в карте невидимыми.
 */
export function prune(draft: WeldingCardWrite, method: MethodCode, mode: WeldingMode): WeldingCardWrite {
  const clear = <T extends WeldingCardWrite | WeldPass>(obj: T, level: 'card' | 'pass'): T => {
    const visible = new Set(editableFieldsFor(method, level, mode).map((f) => f.key))
    let next = obj
    for (const f of FIELDS) {
      if (f.level !== level || f.readOnly || visible.has(f.key)) continue
      if (f.owner !== 'card' && f.owner !== 'pass') continue
      // режим сварки не чистим: у ЭЛС и диффузионной его просто нет в форме
      if (f.key === 'welding_mode') continue
      if (f.range) {
        const [lo, hi] = rangeProps(f)
        next = { ...next, [lo]: null, [hi]: null }
        if (f.key === 'speed_raw') next = { ...next, speedUnitId: null }
      } else if (isExtra(f)) {
        next = writeValue(next, f, null)
      } else {
        next = { ...next, [propName(f)]: formatOf(f).kind === 'text' ? '' : null }
      }
    }
    return next
  }

  return {
    ...clear(draft, 'card'),
    // номера по порядку: сервер пересобирает проходы из массива
    passes: draft.passes.map((p, i) => ({ ...clear(p, 'pass'), no: i + 1 })),
  }
}

/** JSON с сортированными ключами: Postgres переставляет ключи в extra */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )
}

export interface SaveErrors {
  card: Record<string, string>
  passes: Record<string, string>[]
}

/** Ошибки DRF: по полям карты и отдельно по каждому проходу */
export function saveErrors(error: unknown): SaveErrors {
  const card = fieldErrors(error)
  delete card.passes
  const passes: Record<string, string>[] = []
  if (error instanceof AxiosError) {
    const data: unknown = error.response?.data
    const raw = data && typeof data === 'object' && 'passes' in data ? (data as { passes: unknown }).passes : null
    // общая ошибка по проходам — список строк; по полям — объекты
    // по индексу прохода: DRF отдаёт их и списком, и словарём {"0": {...}}
    if (Array.isArray(raw) && typeof raw[0] === 'string') {
      card.passes = raw[0]
    } else if (raw && typeof raw === 'object') {
      for (const [index, item] of Object.entries(raw as Record<string, unknown>)) {
        const out: Record<string, string> = {}
        if (item && typeof item === 'object')
          for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
            const message = Array.isArray(value) ? value[0] : value
            if (typeof message === 'string') out[key] = message
          }
        passes[Number(index)] = out
      }
    }
  }
  return { card, passes }
}
