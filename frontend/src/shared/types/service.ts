import type { IsoDateTime } from './common'

/** GET /service-requests/summary/ */
export interface ServiceSummary {
  open: number
  inWork: number
  high: number
}

export type ServiceReason = 'ремонт' | 'диагностика' | 'неисправность' | 'то'
export type ServicePriority = 'низкая' | 'средняя' | 'высокая'
export type ServiceStatus = 'open' | 'in_work' | 'done' | 'rejected'

export interface ServiceRequest {
  id: number
  equipmentId: number
  equipmentName: string
  methodName: string
  reason: ServiceReason
  reasonDisplay: string
  priority: ServicePriority
  priorityDisplay: string
  description: string
  status: ServiceStatus
  statusDisplay: string
  isOpen: boolean
  /** Снимки и даты проставляет сервер — с фронта не отправляются */
  authorName: string
  createdAt: IsoDateTime
  closedByName: string
  closedAt: IsoDateTime | null
  resolution: string
}

/** Тело POST: только то, что вводит заявитель */
export interface ServiceRequestCreate {
  equipmentId: number
  reason: ServiceReason
  priority: ServicePriority
  description: string
}

/** Тело PATCH: смена статуса, при закрытии — что сделано */
export interface ServiceRequestPatch {
  status: ServiceStatus
  resolution?: string
}

export interface ServiceFilters {
  status?: ServiceStatus | ''
  open?: boolean
  equipment?: string
  priority?: ServicePriority | ''
  mine?: boolean
  search?: string
}
