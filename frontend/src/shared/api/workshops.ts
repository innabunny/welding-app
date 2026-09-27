import type { Workstation } from '@/shared/types/workshops'
import { api } from './client'

export async function fetchWorkstations(): Promise<Workstation[]> {
  const { data } = await api.get<Workstation[]>('/workstations/')
  return data
}
