import type {
  ServiceFilters,
  ServiceRequest,
  ServiceRequestCreate,
  ServiceRequestPatch,
} from '@/shared/types/service'
import { api } from './client'

export async function fetchServiceRequests(filters: ServiceFilters): Promise<ServiceRequest[]> {
  // параметры запроса бэк читает в snake_case — camelCase-парсер их не трогает
  const params: Record<string, string> = {}
  if (filters.status) params.status = filters.status
  if (filters.open) params.open = '1'
  if (filters.equipment) params.equipment = filters.equipment
  if (filters.priority) params.priority = filters.priority
  if (filters.mine) params.mine = '1'
  const search = filters.search?.trim()
  if (search) params.search = search
  const { data } = await api.get<ServiceRequest[]>('/service-requests/', { params })
  return data
}

export async function createServiceRequest(body: ServiceRequestCreate): Promise<ServiceRequest> {
  const { data } = await api.post<ServiceRequest>('/service-requests/', body)
  return data
}

/** PATCH: сервер сам проставит, кто и когда закрыл */
export async function patchServiceRequest(id: number, body: ServiceRequestPatch): Promise<ServiceRequest> {
  const { data } = await api.patch<ServiceRequest>(`/service-requests/${id}/`, body)
  return data
}
