import type { CurrentShift } from '@/shared/types/shifts'
import type { Deviation, WeldDecision, WeldDecisionDraft } from '@/shared/types/deviations'
import type { NodeState, NodeSummary } from '@/shared/types/nodes'
import type { ArcRun, ArcSamples, SessionSamples } from '@/shared/types/telemetry'
import type { WeldingSession } from '@/shared/types/welding'
import { api } from './client'

export async function fetchNodes(): Promise<NodeState[]> {
  const { data } = await api.get<NodeState[]>('/nodes/')
  return data
}

export async function fetchNodeSummary(): Promise<NodeSummary> {
  const { data } = await api.get<NodeSummary>('/nodes/summary/')
  return data
}

export async function fetchWeldingSession(id: number): Promise<WeldingSession> {
  const { data } = await api.get<WeldingSession>(`/welding-sessions/${id}/`)
  return data
}

export async function fetchSessionArcs(id: number): Promise<ArcRun[]> {
  const { data } = await api.get<ArcRun[]>(`/welding-sessions/${id}/arcs/`)
  return data
}

export async function fetchSessionSamples(id: number, points: number): Promise<SessionSamples> {
  const { data } = await api.get<SessionSamples>(`/welding-sessions/${id}/samples/`, {
    params: { points: String(points) },
  })
  return data
}

export async function fetchArcSamples(id: number, points: number): Promise<ArcSamples> {
  const { data } = await api.get<ArcSamples>(`/arcs/${id}/samples/`, {
    params: { points: String(points) },
  })
  return data
}

export async function fetchSessionDeviations(sessionId: number): Promise<Deviation[]> {
  const { data } = await api.get<Deviation[]>('/deviations/', {
    params: { session: String(sessionId) },
  })
  return data
}

/** Автора ставит сервер; при «на контроль» нужен assignedControl, иначе 400 */
export async function createWeldDecision(body: WeldDecisionDraft): Promise<WeldDecision> {
  const { data } = await api.post<WeldDecision>('/weld-decisions/', body)
  return data
}

/** workshop = null — график по умолчанию для всех цехов */
export async function fetchCurrentShift(workshop: number | null): Promise<CurrentShift> {
  const params: Record<string, string> = {}
  if (workshop !== null) params.workshop = String(workshop)
  const { data } = await api.get<CurrentShift>('/shift-schedules/current/', { params })
  return data
}
