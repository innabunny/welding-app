// Телеметрия: участки дуги, точки графика, живой поток /ws/telemetry/
// Сеанс сварки (WeldingSession) описан в welding.ts.

import type { DecimalString, IsoDateTime } from './common'

/**
 * Как определена граница прохода. Разная достоверность:
 * вручную и датчик — надёжно, ток и пауза — подтверждено косвенно,
 * расчёт — только по накопленному времени дуги.
 */
export type MatchSource = 'вручную' | 'датчик' | 'ток' | 'пауза' | 'расчёт'

/**
 * Проход по техкарте с допусками: элемент passPlan сеанса.
 * Числа строками (DecimalField). Скорость уже в м/ч.
 */
export interface PassPlan {
  id: number
  no: number
  currentMin: DecimalString | null
  currentMax: DecimalString | null
  voltageMin: DecimalString | null
  voltageMax: DecimalString | null
  speedMin: DecimalString | null
  speedMax: DecimalString | null
  speedRequired: boolean
  wireSpeedMin: DecimalString | null
  wireSpeedMax: DecimalString | null
  gasFlowMin: DecimalString | null
  gasFlowMax: DecimalString | null
  backingFlowMin: DecimalString | null
  backingFlowMax: DecimalString | null
  pulseCurrent: DecimalString | null
  pauseCurrent: DecimalString | null
}

/** Участок непрерывного горения дуги: /api/welding-sessions/<id>/arcs/ */
export interface ArcRun {
  id: number
  session: number
  passRun: number | null
  /** номер прохода по факту; null — проход не определён */
  passNo: number | null
  /** проход по карте: допуски ищутся в passPlan сеанса по этому id */
  plannedPassId: number | null
  /** пусто, если проход не определён */
  matchSource: MatchSource | ''
  matchSourceDisplay: string
  startedAt: IsoDateTime
  /** null — дуга ещё горит или конец участка не дошёл */
  finishedAt: IsoDateTime | null
  /** секунды с десятыми; null без конца участка */
  durationSeconds: number | null
  currentAvg: DecimalString | null
  currentMin: DecimalString | null
  currentMax: DecimalString | null
  voltageAvg: DecimalString | null
  pulseFreq: DecimalString | null
  /** false — связь оборвалась, замеры участка дошли не полностью */
  telemetryComplete: boolean
}

/**
 * Корзина прореживания. i — среднее за корзину, iMin/iMax — разброс
 * внутри неё. t — начало корзины, мс от эпохи.
 */
export interface ArcSamplePoint {
  t: number
  i: number
  iMin: number
  iMax: number
  u: number
  uMin: number
  uMax: number
}

/** Корзина графика всего сеанса: разброс только по току. */
export interface SessionSamplePoint {
  t: number
  arcId: number
  i: number
  iMin: number
  iMax: number
  u: number
}

/**
 * Ответ samples. Пустые корзины сервер не присылает: разрыв между
 * проходами — это пропуск во времени между соседними точками.
 */
export interface SamplesResponse<P> {
  points: P[]
  /** сколько замеров было до прореживания */
  total: number
  /** ширина корзины, мс; 0 — замеров нет */
  stepMs: number
  /** границы данных, мс; нет, когда замеров нет */
  from?: number
  to?: number
}

export type ArcSamples = SamplesResponse<ArcSamplePoint>
export type SessionSamples = SamplesResponse<SessionSamplePoint>

// ───────────── WebSocket /ws/telemetry/ ─────────────
// Сообщения приходят как их собрал приёмник, без перевода в camelCase.

/** Текущие показания, примерно раз в секунду. */
export interface LiveTick {
  node: string
  /** номер сеанса на узле; пусто, если сеанса нет */
  sid: string
  /** время замера на узле, мс */
  ts: number | null
  i: number | null
  u: number | null
  arc: boolean
}

export interface SessionStartEvent {
  event: 'session_start'
  node: string
  sid: string
  /** ФИО сварщика на момент начала; пусто, если не опознан */
  welder: string
  mode: string
}

export interface SessionStopEvent {
  event: 'session_stop'
  node: string
  sid: string
}

export type TelemetryEvent = SessionStartEvent | SessionStopEvent

/** Состояние соединения с WebSocket портала. */
export type SocketStatus =
  | 'connecting'
  | 'open'
  /** обрыв сети, ждём и подключаемся снова */
  | 'reconnecting'
  /** сервер закрыл с кодом 4001: пользователь не вошёл */
  | 'unauthorized'
