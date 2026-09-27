import type { DecimalString, IsoDateTime } from './common'

export type WeldingModeValue = 'непрерывный' | 'импульсный' | ''

/** Прочие параметры: ключи в camelCase — мост переводит и вложенный JSON */
export type ExtraValues = Record<string, string>

export interface WeldingCardListItem {
  id: number
  cardNo: string
  revision: number
  partNumber: string
  partName: string
  operationNumber: string
  seamNumber: string
  seamThickness1: DecimalString | null
  seamThickness2: DecimalString | null
  material1Marka: string
  material2Marka: string
  methodName: string
  equipmentName: string
  passesCount: number
  isReleased: boolean
  authorName: string
  createdAt: IsoDateTime
}

export interface WeldPass {
  id?: number
  no: number
  currentMin: DecimalString | null
  currentMax: DecimalString | null
  voltageMin: DecimalString | null
  voltageMax: DecimalString | null
  speedUnitId: number | null
  /** Только чтение */
  speedUnitName?: string
  speedRawMin: DecimalString | null
  speedRawMax: DecimalString | null
  /** Скорость в м/ч — считает сервер, в запросе игнорируется */
  speedMin?: DecimalString | null
  speedMax?: DecimalString | null
  speedRequired: boolean
  wireSpeedMin: DecimalString | null
  wireSpeedMax: DecimalString | null
  gasFlowMin: DecimalString | null
  gasFlowMax: DecimalString | null
  backingFlowMin: DecimalString | null
  backingFlowMax: DecimalString | null
  plasmaFlowMin: DecimalString | null
  plasmaFlowMax: DecimalString | null
  fillerId: number | null
  /** Снимок присадки прохода — только чтение */
  fillerText?: string
  fillerDiameter: DecimalString | null
  pulseCurrent: DecimalString | null
  pulseTime: DecimalString | null
  pauseCurrent: DecimalString | null
  pauseTime: DecimalString | null
  beamCurrent: DecimalString | null
  extra: ExtraValues
}

/** Поля, которые форма карты отправляет на сервер */
export interface WeldingCardWrite {
  cardNo: string
  revision: number
  operationId: number | null
  methodId: string
  equipmentId: number | null
  weldingMode: WeldingModeValue
  tungstenId: number | null
  fillerId: number | null
  shieldGasId: number | null
  backingGasId: number | null
  plasmaGasId: number | null
  fluxId: number | null
  plasmaNozzleD: DecimalString | null
  heatTreatment: string
  extra: ExtraValues
  passes: WeldPass[]
  isReleased: boolean
}

export interface WeldingCard extends WeldingCardWrite {
  id: number
  operationId: number
  // ниже — по цепочке операция → деталь / шов, только чтение
  operationNumber: string
  partNumber: string
  partName: string
  seamNumber: string
  seamThickness1: DecimalString | null
  seamThickness2: DecimalString | null
  seamType: string
  seamDiameter: DecimalString | null
  material1Marka: string
  material2Marka: string
  methodName: string
  methodProcess: string
  methodTplKey: string
  /** Обозначение с суффиксом п/б — собирает сервер */
  designation: string
  equipmentName: string
  /** Эскиз разделки — SVG-разметка, только чтение */
  grooveSvg: string
  // текстовые снимки справочников: печатаются в бланке
  tungstenText: string
  fillerText: string
  shieldGasText: string
  backingGasText: string
  plasmaGasText: string
  fluxText: string
  authorName: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface WeldingCardFilters {
  search?: string
  part?: string
  method?: string
  process?: string
  equipment?: string
  material?: string
  thicknessFrom?: string
  thicknessTo?: string
  /** '1' — выпущенные, '0' — черновики */
  released?: '' | '1' | '0'
}

export interface SimilarParams {
  method: string
  material?: number | null
  thickness?: string | null
  tolerance?: string
}

/** Результат агрегата: приходит числом, а не строкой, как у DecimalField */
type Stat = number | DecimalString | null

/** Статистика по ОДНОМУ номеру прохода среди найденных карт */
export interface SimilarPassStats {
  no: number
  currentFrom: Stat
  currentTo: Stat
  /** Среднее по «от» */
  currentAvg: Stat
  voltageFrom: Stat
  voltageTo: Stat
  speedFrom: Stat
  speedTo: Stat
  wireSpeedFrom: Stat
  wireSpeedTo: Stat
  gasFlowFrom: Stat
  gasFlowTo: Stat
  /** Сколько карт дали этот номер прохода */
  cards: number
}

export interface SimilarResponse {
  count: number
  /** «способ» — карты этого способа; «процесс» — не хватило, взяли родственные */
  level: 'способ' | 'процесс' | null
  cards: WeldingCardListItem[]
  passes: SimilarPassStats[]
}
