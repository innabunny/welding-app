// Состояние узлов телеметрии: /api/nodes/

/** Причина последнего пуска узла, как её сообщает прошивка. */
export type ResetReason =
  | 'poweron'    // подали питание
  | 'brownout'   // просадка питания
  | 'sw'         // программный сброс
  | 'panic'      // авария прошивки
  | 'watchdog'   // сторожевой таймер
  | 'task_wdt'
  | 'int_wdt'
  | '';

export interface NodeState {
  id: number;
  nodeId: string;
  equipment: number | null;
  equipmentName: string;
  workshopName: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  lastStatusAt: string | null;
  /** сколько секунд назад было последнее сообщение */
  silentSeconds: number | null;
  /** порций замеров, которые узел держит у себя и досылает */
  queued: number;
  ip: string | null;
  firmware: string;
  uptimeSeconds: number | null;
  freeBytes: number | null;
  /** строка, потому что DecimalField */
  temperature: string | null;
  resetReason: ResetReason;
}

export type OutageKind = 'нет связи' | 'без питания' | 'перезапуск';

export interface NodeOutage {
  id: number;
  startedAt: string;
  /** null — обрыв ещё идёт */
  finishedAt: string | null;
  kind: OutageKind;
  kindName: string;
  durationSeconds: number | null;
}

/** Счётчики для плашки на дашборде. */
export interface NodeSummary {
  total: number;
  online: number;
  offline: number;
  /** узлы на связи, которые досылают накопленные данные */
  catchingUp: number;
  /** узлы в сети без привязки к оборудованию */
  unlinked: number;
}