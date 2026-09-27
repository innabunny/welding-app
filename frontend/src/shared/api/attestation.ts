import type {
  Attestation,
  AttestationFilters,
  AttestationListItem,
  AttestationPhase2,
  AttestationRule,
  AttestationWrite,
  Welder,
  WelderListItem,
  WelderWrite,
} from '@/shared/types/attestation'
import { api } from './client'

function params<T extends object>(filters: T): Record<string, string> {
  // ключи фильтров совпадают с параметрами бэка, пустые не шлём
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(filters)) {
    const v = typeof value === 'string' ? value.trim() : ''
    if (v) out[key] = v
  }
  return out
}

export async function fetchAttestations(filters: AttestationFilters): Promise<AttestationListItem[]> {
  const { data } = await api.get<AttestationListItem[]>('/attestations/', { params: params(filters) })
  return data
}

export async function fetchAttestation(id: number): Promise<Attestation> {
  const { data } = await api.get<Attestation>(`/attestations/${id}/`)
  return data
}

export async function createAttestation(body: AttestationWrite): Promise<Attestation> {
  const { data } = await api.post<Attestation>('/attestations/', body)
  return data
}

/** Черновик — PUT целиком; после отправки на испытания — PATCH только реквизитов и результатов */
export async function updateAttestation(id: number, body: AttestationWrite | AttestationPhase2): Promise<Attestation> {
  const { data } =
    'welderId' in body
      ? await api.put<Attestation>(`/attestations/${id}/`, body)
      : await api.patch<Attestation>(`/attestations/${id}/`, body)
  return data
}

export async function deleteAttestation(id: number): Promise<void> {
  await api.delete(`/attestations/${id}/`)
}

export async function fetchAttestationRules(method: string, group: number): Promise<AttestationRule[]> {
  const { data } = await api.get<AttestationRule[]>('/attestation-rules/', {
    params: { method, group: String(group) },
  })
  return data
}

export async function fetchWelders(filters: { search?: string; active?: boolean } = {}): Promise<WelderListItem[]> {
  const p: Record<string, string> = {}
  if (filters.search?.trim()) p.search = filters.search.trim()
  if (filters.active) p.active = '1'
  const { data } = await api.get<WelderListItem[]>('/welders/', { params: p })
  return data
}

export async function fetchWelder(id: number): Promise<Welder> {
  const { data } = await api.get<Welder>(`/welders/${id}/`)
  return data
}

export async function saveWelder(id: number | null, body: WelderWrite): Promise<Welder> {
  const { data } = id === null ? await api.post<Welder>('/welders/', body) : await api.put<Welder>(`/welders/${id}/`, body)
  return data
}
