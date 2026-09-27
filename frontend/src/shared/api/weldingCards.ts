import type {
  SimilarParams,
  SimilarResponse,
  WeldingCard,
  WeldingCardFilters,
  WeldingCardListItem,
  WeldingCardWrite,
} from '@/shared/types/weldingCards'
import { api } from './client'

export async function fetchWeldingCards(filters: WeldingCardFilters): Promise<WeldingCardListItem[]> {
  // параметры запроса бэк читает в snake_case — camelCase-парсер их не трогает
  const map: Record<keyof WeldingCardFilters, string> = {
    search: 'search',
    part: 'part',
    method: 'method',
    process: 'process',
    equipment: 'equipment',
    material: 'material',
    thicknessFrom: 'thickness_from',
    thicknessTo: 'thickness_to',
    released: 'released',
  }
  const params: Record<string, string> = {}
  for (const [key, name] of Object.entries(map) as [keyof WeldingCardFilters, string][]) {
    const value = filters[key]?.trim()
    if (value) params[name] = value
  }
  const { data } = await api.get<WeldingCardListItem[]>('/welding-cards/', { params })
  return data
}

export async function fetchWeldingCard(id: number): Promise<WeldingCard> {
  const { data } = await api.get<WeldingCard>(`/welding-cards/${id}/`)
  return data
}

/** PUT, а не PATCH: проходы сервер пересобирает из присланного массива целиком */
export async function saveWeldingCard(id: number | null, body: WeldingCardWrite): Promise<WeldingCard> {
  const { data } =
    id === null
      ? await api.post<WeldingCard>('/welding-cards/', body)
      : await api.put<WeldingCard>(`/welding-cards/${id}/`, body)
  return data
}

export async function fetchSimilar({ method, material, thickness, tolerance }: SimilarParams): Promise<SimilarResponse> {
  const params: Record<string, string> = { method }
  if (material) params.material = String(material)
  if (thickness) params.thickness = thickness
  if (tolerance) params.tolerance = tolerance
  const { data } = await api.get<SimilarResponse>('/welding-cards/similar/', { params })
  return data
}
