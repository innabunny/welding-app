import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardKeys } from '@/features/dashboard/queries'
import { fetchActiveSessions } from '@/shared/api/dashboard'
import {
  createWeldDecision,
  fetchArcSamples,
  fetchCurrentShift,
  fetchNodes,
  fetchNodeSummary,
  fetchSessionArcs,
  fetchSessionDeviations,
  fetchSessionSamples,
  fetchWeldingSession,
} from '@/shared/api/telemetry'
import type { WeldDecisionDraft } from '@/shared/types/deviations'

export const telemetryKeys = {
  nodes: ['nodes', 'list'] as const,
  nodeSummary: ['nodes', 'summary'] as const,
  // тот же ключ, что у рабочего стола: кэш активных сеансов общий
  activeSessions: dashboardKeys.activeSessions,
  session: (id: number) => ['welding-sessions', 'detail', id] as const,
  sessionArcs: (id: number) => ['welding-sessions', 'arcs', id] as const,
  sessionSamples: (id: number, points: number) =>
    ['welding-sessions', 'samples', id, points] as const,
  arcSamples: (id: number, points: number) => ['arcs', 'samples', id, points] as const,
  sessionDeviations: (id: number) => ['deviations', { session: id }] as const,
  currentShift: (workshop: number | null) => ['shift-schedules', 'current', workshop] as const,
}

/** Префиксы, которые устаревают по событиям сеанса из WebSocket */
export const sessionEventKeys = [['nodes'], ['welding-sessions'], ['deviations']] as const

// silentSeconds сервер считает в момент ответа — без обновления
// «молчит 5 с» так и висело бы на экране
const NODES_REFRESH = 15_000
// сеансы и узлы дополнительно обновляются по событиям WebSocket;
// интервал страхует от пропущенного события при переподключении
const SESSIONS_REFRESH = 30_000

export const useNodes = () =>
  useQuery({ queryKey: telemetryKeys.nodes, queryFn: fetchNodes, refetchInterval: NODES_REFRESH })

export const useNodeSummary = () =>
  useQuery({
    queryKey: telemetryKeys.nodeSummary,
    queryFn: fetchNodeSummary,
    refetchInterval: NODES_REFRESH,
  })

export const useActiveSessions = () =>
  useQuery({
    queryKey: telemetryKeys.activeSessions,
    queryFn: fetchActiveSessions,
    refetchInterval: SESSIONS_REFRESH,
  })

export const useWeldingSession = (id: number | null) =>
  useQuery({
    queryKey: telemetryKeys.session(id ?? 0),
    queryFn: () => fetchWeldingSession(id ?? 0),
    enabled: id !== null,
  })

export const useSessionArcs = (id: number | null) =>
  useQuery({
    queryKey: telemetryKeys.sessionArcs(id ?? 0),
    queryFn: () => fetchSessionArcs(id ?? 0),
    enabled: id !== null,
  })

/** 2000 — столько же отдаёт сервер по умолчанию */
export const useSessionSamples = (id: number | null, points = 2000) =>
  useQuery({
    queryKey: telemetryKeys.sessionSamples(id ?? 0, points),
    queryFn: () => fetchSessionSamples(id ?? 0, points),
    enabled: id !== null,
  })

export const useArcSamples = (id: number | null, points = 1200) =>
  useQuery({
    queryKey: telemetryKeys.arcSamples(id ?? 0, points),
    queryFn: () => fetchArcSamples(id ?? 0, points),
    enabled: id !== null,
    // замеры закрытого участка не меняются
    staleTime: Infinity,
  })

export const useSessionDeviations = (sessionId: number | null) =>
  useQuery({
    queryKey: telemetryKeys.sessionDeviations(sessionId ?? 0),
    queryFn: () => fetchSessionDeviations(sessionId ?? 0),
    enabled: sessionId !== null,
  })

export const useCurrentShift = (workshop: number | null) =>
  useQuery({
    queryKey: telemetryKeys.currentShift(workshop),
    queryFn: () => fetchCurrentShift(workshop),
    // прошедшая и оставшаяся части смены меняются каждую минуту
    refetchInterval: 60_000,
  })

export function useCreateWeldDecision() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: WeldDecisionDraft) => createWeldDecision(body),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['deviations'] }),
        queryClient.invalidateQueries({ queryKey: ['weld-decisions'] }),
      ]),
  })
}
