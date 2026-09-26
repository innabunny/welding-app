import { useQuery } from '@tanstack/react-query'
import {
  fetchActiveSessions,
  fetchAwaitingControl,
  fetchDoneOperationRuns,
  fetchDraftCards,
  fetchExpiringAttestations,
  fetchServiceSummary,
  fetchWelds,
} from '@/shared/api/dashboard'

// меню и рабочий стол берут одни и те же сводки — кэш общий
export const dashboardKeys = {
  awaitingControl: ['welds', 'awaiting-control'] as const,
  expiring: ['attestations', 'expiring'] as const,
  draftCards: ['welding-cards', { released: false }] as const,
  serviceSummary: ['service-requests', 'summary'] as const,
  doneRuns: ['operation-runs', { status: 'done' }] as const,
  welds: ['welds', 'list'] as const,
  activeSessions: ['welding-sessions', { active: true }] as const,
}

export const useAwaitingControl = () =>
  useQuery({ queryKey: dashboardKeys.awaitingControl, queryFn: fetchAwaitingControl })

export const useExpiringAttestations = () =>
  useQuery({ queryKey: dashboardKeys.expiring, queryFn: fetchExpiringAttestations })

export const useDraftCards = () =>
  useQuery({ queryKey: dashboardKeys.draftCards, queryFn: fetchDraftCards })

export const useServiceSummary = () =>
  useQuery({ queryKey: dashboardKeys.serviceSummary, queryFn: fetchServiceSummary })

export const useDoneOperationRuns = () =>
  useQuery({ queryKey: dashboardKeys.doneRuns, queryFn: fetchDoneOperationRuns })

export const useWelds = () => useQuery({ queryKey: dashboardKeys.welds, queryFn: fetchWelds })

export const useActiveSessions = () =>
  useQuery({
    queryKey: dashboardKeys.activeSessions,
    queryFn: fetchActiveSessions,
    // «варит / простой» устаревает быстро
    refetchInterval: 30_000,
  })
