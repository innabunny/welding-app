import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardKeys } from '@/features/dashboard/queries'
import { fetchActiveSessions } from '@/shared/api/dashboard'
import {
  createWeldDecision,
  fetchArcSamples,
  fetchCurrentShift,
  fetchEquipmentSessions,
  fetchPendingDeviations,
  fetchSessionDecisions,
  fetchNodes,
  fetchNodeSummary,
  fetchSessionArcs,
  fetchSessionDeviations,
  fetchSessionSamples,
  fetchWeldingSession,
} from '@/shared/api/telemetry'
import type { SaveVars } from '@/shared/ui/FormModal'
import { toDraft, type DecisionForm } from './decision'

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
  sessionDecisions: (id: number) => ['weld-decisions', { session: id }] as const,
  pendingDeviations: ['deviations', { pending: true }] as const,
  equipmentSessions: (id: number) => ['welding-sessions', { equipment: id }] as const,
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

/** live — сеанс идёт: новые участки появляются, обновляем раз в 30 с */
export const useSessionArcs = (id: number | null, live = false) =>
  useQuery({
    queryKey: telemetryKeys.sessionArcs(id ?? 0),
    queryFn: () => fetchSessionArcs(id ?? 0),
    enabled: id !== null,
    refetchInterval: live ? SESSIONS_REFRESH : false,
  })

/**
 * 2000 — столько же отдаёт сервер по умолчанию.
 * live — сеанс идёт: график дорастает раз в 30 с. Пока идёт обновление,
 * на экране остаётся прежний график того же сеанса.
 */
export const useSessionSamples = (id: number | null, points = 2000, live = false) =>
  useQuery({
    queryKey: telemetryKeys.sessionSamples(id ?? 0, points),
    queryFn: () => fetchSessionSamples(id ?? 0, points),
    enabled: id !== null,
    refetchInterval: live ? SESSIONS_REFRESH : false,
  })

/** live — дуга ещё горит, участок дорастает; замеры закрытого не меняются */
export const useArcSamples = (id: number | null, points = 1200, live = false) =>
  useQuery({
    queryKey: telemetryKeys.arcSamples(id ?? 0, points),
    queryFn: () => fetchArcSamples(id ?? 0, points),
    enabled: id !== null,
    staleTime: live ? 0 : Infinity,
    refetchInterval: live ? SESSIONS_REFRESH : false,
  })

export const useSessionDeviations = (sessionId: number | null, live = false) =>
  useQuery({
    queryKey: telemetryKeys.sessionDeviations(sessionId ?? 0),
    queryFn: () => fetchSessionDeviations(sessionId ?? 0),
    enabled: sessionId !== null,
    refetchInterval: live ? SESSIONS_REFRESH : false,
  })

export const usePendingDeviations = () =>
  useQuery({
    queryKey: telemetryKeys.pendingDeviations,
    queryFn: fetchPendingDeviations,
    refetchInterval: SESSIONS_REFRESH,
  })

export const useEquipmentSessions = (equipmentId: number | null) =>
  useQuery({
    queryKey: telemetryKeys.equipmentSessions(equipmentId ?? 0),
    queryFn: () => fetchEquipmentSessions(equipmentId ?? 0),
    enabled: equipmentId !== null,
    refetchInterval: SESSIONS_REFRESH,
  })

export const useCurrentShift = (workshop: number | null) =>
  useQuery({
    queryKey: telemetryKeys.currentShift(workshop),
    queryFn: () => fetchCurrentShift(workshop),
    // прошедшая и оставшаяся части смены меняются каждую минуту
    refetchInterval: 60_000,
  })

export const useSessionDecisions = (sessionId: number | null) =>
  useQuery({
    queryKey: telemetryKeys.sessionDecisions(sessionId ?? 0),
    queryFn: () => fetchSessionDecisions(sessionId ?? 0),
    enabled: sessionId !== null,
  })

/** Решение по отклонениям. Форма в FormModal: id всегда null — решение только создаётся */
export function useCreateWeldDecision() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ body }: SaveVars<DecisionForm>) => createWeldDecision(toDraft(body)),
    // отклонения стали «рассмотрено» — обновить и экран, и список постов
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['deviations'] }),
        queryClient.invalidateQueries({ queryKey: ['weld-decisions'] }),
      ]),
  })
}
