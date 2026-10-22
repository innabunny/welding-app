// Ответы эндпоинтов /api/shift-schedules/ и /api/calendar-exceptions/

/** 0 — понедельник, 6 — воскресенье (как в Date.getDay(), сдвинутое). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  0: 'понедельник',
  1: 'вторник',
  2: 'среда',
  3: 'четверг',
  4: 'пятница',
  5: 'суббота',
  6: 'воскресенье',
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  0: 'Пн', 1: 'Вт', 2: 'Ср', 3: 'Чт', 4: 'Пт', 5: 'Сб', 6: 'Вс',
};

/** Часы одного дня недели внутри графика. */
export interface ShiftDay {
  id: number;
  weekday: Weekday;
  weekdayName: string;
  isWorking: boolean;
  /** 'HH:MM:SS' или null у выходного */
  startsAt: string | null;
  endsAt: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  workHours: number;
}

export interface ShiftSchedule {
  id: number;
  name: string;
  /** null — график по умолчанию для всех цехов */
  workshop: number | null;
  workshopName: string;
  number: number;
  validFrom: string;
  validTo: string | null;
  days: ShiftDay[];
}

/** Состояние смены сейчас — для плашки на дашборде. */
export interface CurrentShift {
  hasSchedule: boolean;
  inShift?: boolean;
  onBreak?: boolean;
  day?: string;
  weekday?: Weekday;
  isWorking?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  breakStart?: string | null;
  breakEnd?: string | null;
  /** вся смена в секундах, без обеда */
  fundSeconds?: number;
  elapsedSeconds?: number;
  remainingSeconds?: number;
  /** доля смены, которая прошла, от 0 до 1 */
  progress?: number;
  comment?: string;
}

/** Фонд времени за период — знаменатель для Кз. */
export interface TimeFund {
  seconds: number;
  hours: number;
  workingDays: number;
  days: {
    day: string;
    weekday: Weekday;
    isWorking: boolean;
    hours: number;
    /** 'график' — обычный день недели, 'календарь' — исключение */
    source: 'график' | 'календарь';
    comment: string;
  }[];
}

export type CalendarExceptionKind = 'нерабочий' | 'рабочий' | 'сокращённый';

export interface CalendarException {
  id: number;
  day: string;
  kind: CalendarExceptionKind;
  comment: string;
  /** null — исключение для всех графиков */
  schedule: number | null;
  startsAt: string | null;
  endsAt: string | null;
  breakStart: string | null;
  breakEnd: string | null;
}