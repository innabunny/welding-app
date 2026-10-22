// Загрузка оборудования: /api/utilization/

/** Раскладка фонда времени по одному аппарату. */
export interface EquipmentUtilization {
  equipmentId: number;
  equipmentName: string;

  /** сколько аппарат должен был работать по графику смен */
  fundSeconds: number;
  /** горела дуга — числитель Кз */
  arcSeconds: number;
  /** сварщик допущен, сеанс открыт, но дуги нет */
  standbySeconds: number;
  /** узел был не на связи: что происходило, неизвестно */
  noDataSeconds: number;
  /** смена шла, узел на связи, никто не авторизован */
  idleSeconds: number;
  /** сварка вне смены: вечером, в обед, в выходной. В фонд не входит */
  outsideShiftSeconds: number;

  /** от полного фонда, от 0 до 1 — для отчёта */
  kz: number;
  /** от наблюдаемого фонда (без «нет данных») — для технолога */
  kzAvailable: number;

  sessions: number;
  arcs: number;
  /** расхождение суммы частей с фондом; в норме 0 */
  balanceErrorSeconds: number;
}

export interface UtilizationReport {
  from: string;
  to: string;
  fundSeconds: number;
  arcSeconds: number;
  standbySeconds: number;
  noDataSeconds: number;
  idleSeconds: number;
  outsideShiftSeconds: number;
  kz: number;
  kzAvailable: number;
  equipmentCount: number;
  items: EquipmentUtilization[];
}

/** Подписи категорий для легенды и таблиц. */
export const TIME_CATEGORIES = {
  arcSeconds: 'Время горения дуги',
  standbySeconds: 'Режим ожидания',
  idleSeconds: 'Простой',
  noDataSeconds: 'Нет данных',
} as const;

export type TimeCategory = keyof typeof TIME_CATEGORIES;