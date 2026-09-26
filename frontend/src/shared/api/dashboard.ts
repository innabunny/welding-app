import type { AttestationExpiring } from '@/shared/types/attestation'
import type { ServiceSummary } from '@/shared/types/service'
import type {
  AwaitingControl,
  OperationRun,
  Weld,
  WeldingSession,
} from '@/shared/types/welding'
import type { WeldingCardListItem } from '@/shared/types/weldingCards'
import { api } from './client'

export async function fetchAwaitingControl(): Promise<AwaitingControl> {
  const { data } = await api.get<AwaitingControl>('/welds/awaiting_control/')
  return data
}

export async function fetchExpiringAttestations(): Promise<AttestationExpiring> {
  const { data } = await api.get<AttestationExpiring>('/attestations/expiring/')
  return data
}

export async function fetchDraftCards(): Promise<WeldingCardListItem[]> {
  const { data } = await api.get<WeldingCardListItem[]>('/welding-cards/', {
    params: { released: '0' },
  })
  return data
}

export async function fetchServiceSummary(): Promise<ServiceSummary> {
  const { data } = await api.get<ServiceSummary>('/service-requests/summary/')
  return data
}

export async function fetchDoneOperationRuns(): Promise<OperationRun[]> {
  const { data } = await api.get<OperationRun[]>('/operation-runs/', {
    params: { status: 'done' },
  })
  return data
}

export async function fetchWelds(): Promise<Weld[]> {
  const { data } = await api.get<Weld[]>('/welds/')
  return data
}

export async function fetchActiveSessions(): Promise<WeldingSession[]> {
  const { data } = await api.get<WeldingSession[]>('/welding-sessions/', {
    params: { active: '1' },
  })
  return data
}
