import type { WeldingMethod } from '@/shared/types/methods'
import { api } from './client'

export async function fetchWeldingMethods(): Promise<WeldingMethod[]> {
  const { data } = await api.get<WeldingMethod[]>('/welding-methods/')
  return data
}
