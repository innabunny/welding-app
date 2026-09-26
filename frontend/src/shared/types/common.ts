/** DecimalField приходит строкой: "132.5". Перед сравнением и счётом — Number(). */
export type DecimalString = string

/** Дата-время в ISO 8601: "2026-09-24T10:15:00Z". */
export type IsoDateTime = string

/** Дата без времени: "2026-09-24". */
export type IsoDate = string

/** Ошибка валидации DRF: поле → список сообщений, либо detail. */
export type ApiErrorBody = {
  detail?: string
  nonFieldErrors?: string[]
} & Record<string, string[] | string | undefined>
