import type { Inspection, InspectionCreate, Weld, WeldFilters, WeldPassport, WeldStatus } from '@/shared/types/welding'
import { api } from './client'

export async function fetchWeldList(filters: WeldFilters): Promise<Weld[]> {
  // параметры запроса бэк читает в snake_case — эти совпадают
  const params: Record<string, string> = {}
  const search = filters.search?.trim()
  if (search) params.search = search
  if (filters.part) params.part = filters.part
  if (filters.status) params.status = filters.status
  const { data } = await api.get<Weld[]>('/welds/', { params })
  return data
}

export async function fetchWeldPassport(id: number): Promise<WeldPassport> {
  const { data } = await api.get<WeldPassport>(`/welds/${id}/passport/`)
  return data
}

export async function patchWeldStatus(id: number, status: WeldStatus): Promise<Weld> {
  const { data } = await api.patch<Weld>(`/welds/${id}/`, { status })
  return data
}

export async function createInspection(body: InspectionCreate): Promise<Inspection> {
  const { data } = await api.post<Inspection>('/inspections/', body)
  return data
}
