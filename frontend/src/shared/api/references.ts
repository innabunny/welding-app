import type { WeldingMethod } from '@/shared/types/methods'
import type { Workstation } from '@/shared/types/workshops'
import { api } from './client'

export async function fetchWeldingMethods(): Promise<WeldingMethod[]> {
  const { data } = await api.get<WeldingMethod[]>('/welding-methods/')
  return data
}

export async function fetchWorkstations(): Promise<Workstation[]> {
  const { data } = await api.get<Workstation[]>('/workstations/')
  return data
}
