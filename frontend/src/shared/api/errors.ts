import { AxiosError } from 'axios'
import type { ApiErrorBody } from '@/shared/types/common'

function isErrorBody(data: unknown): data is ApiErrorBody {
  return typeof data === 'object' && data !== null && !Array.isArray(data)
}

function firstMessage(value: string[] | string | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** Ошибки по полям формы: { name: 'Обязательное поле' } */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof AxiosError) || !isErrorBody(error.response?.data)) return {}
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(error.response.data)) {
    if (key === 'detail' || key === 'nonFieldErrors') continue
    const message = firstMessage(value)
    if (message) result[key] = message
  }
  return result
}

/** Общее сообщение для пользователя: detail, nonFieldErrors или статус */
export function errorMessage(error: unknown): string {
  if (!(error instanceof AxiosError)) return 'Неизвестная ошибка'
  if (!error.response) return 'Сервер недоступен. Проверьте подключение'
  const data = error.response.data
  // DRF отдаёт общую ошибку валидации списком: ["Заявка закрыта"]
  if (Array.isArray(data) && typeof data[0] === 'string') return data[0]
  if (isErrorBody(data)) {
    const message = data.detail ?? firstMessage(data.nonFieldErrors)
    if (message) return message
    if (Object.keys(fieldErrors(error)).length > 0) return 'Проверьте поля формы'
  }
  if (error.response.status >= 500) return 'Ошибка сервера'
  return `Ошибка запроса (${error.response.status})`
}

/**
 * Ошибки по вложенному списку (проходы, образцы): по индексу элемента.
 * DRF отдаёт их и массивом, и словарём {"0": {...}} — разбираем оба.
 */
export function listErrors(error: unknown, key: string): Record<string, string>[] {
  const out: Record<string, string>[] = []
  if (!(error instanceof AxiosError) || !isErrorBody(error.response?.data)) return out
  const raw: unknown = error.response.data[key]
  if (!raw || typeof raw !== 'object' || (Array.isArray(raw) && typeof raw[0] === 'string')) return out
  for (const [index, item] of Object.entries(raw as Record<string, unknown>)) {
    const fields: Record<string, string> = {}
    if (item && typeof item === 'object')
      for (const [field, value] of Object.entries(item as Record<string, unknown>)) {
        const message = Array.isArray(value) ? value[0] : value
        if (typeof message === 'string') fields[field] = message
      }
    out[Number(index)] = fields
  }
  return out
}
