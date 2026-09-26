import type {
  Equipment,
  EquipmentFilters,
  EquipmentParameter,
  EquipmentWrite,
  SpeedUnit,
} from '@/shared/types/equipment'
import { api } from './client'

export async function fetchEquipmentList(filters: EquipmentFilters = {}): Promise<Equipment[]> {
  // параметры запроса бэк читает в snake_case — camelCase-парсер их не трогает
  const params: Record<string, string> = {}
  if (filters.method) params.method = filters.method
  if (filters.workshop !== undefined) params.workshop = String(filters.workshop)
  if (filters.active) params.active = '1'
  const { data } = await api.get<Equipment[]>('/equipment/', { params })
  return data
}

export async function fetchEquipment(id: number): Promise<Equipment> {
  const { data } = await api.get<Equipment>(`/equipment/${id}/`)
  return data
}

export async function createEquipment(body: EquipmentWrite): Promise<Equipment> {
  const { data } = await api.post<Equipment>('/equipment/', body)
  return data
}

/** PUT, а не PATCH: тело всегда полное, связи уходят целиком */
export async function updateEquipment(id: number, body: EquipmentWrite): Promise<Equipment> {
  const { data } = await api.put<Equipment>(`/equipment/${id}/`, body)
  return data
}

export async function fetchSpeedUnits(): Promise<SpeedUnit[]> {
  const { data } = await api.get<SpeedUnit[]>('/speed-units/')
  return data
}

export async function fetchEquipmentParameters(): Promise<EquipmentParameter[]> {
  const { data } = await api.get<EquipmentParameter[]>('/equipment-parameters/')
  return data
}
