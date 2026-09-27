import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAttestation,
  deleteAttestation,
  fetchAttestation,
  fetchAttestationRules,
  fetchAttestations,
  fetchWelders,
  saveWelder,
  updateAttestation,
} from '@/shared/api/attestation'
import { fetchWorkshops } from '@/shared/api/workshops'
import type { AttestationFilters, AttestationPhase2, AttestationWrite, WelderWrite } from '@/shared/types/attestation'
import type { SaveVars } from '@/shared/ui/FormModal'

// первый элемент совпадает с плашкой «истекающие допуски» на рабочем столе и в меню
export const attestationKeys = {
  all: ['attestations'] as const,
  list: (filters: AttestationFilters) => ['attestations', 'list', filters] as const,
  detail: (id: number) => ['attestations', 'detail', id] as const,
}

export const useAttestations = (filters: AttestationFilters) =>
  useQuery({ queryKey: attestationKeys.list(filters), queryFn: () => fetchAttestations(filters) })

export const useAttestation = (id: number | null) =>
  useQuery({
    queryKey: attestationKeys.detail(id ?? 0),
    queryFn: () => fetchAttestation(id ?? 0),
    enabled: id !== null,
    staleTime: 0,
  })

export const useAttestationRules = (method: string, group: number | null) =>
  useQuery({
    queryKey: ['attestation-rules', method, group],
    queryFn: () => fetchAttestationRules(method, group ?? 0),
    enabled: Boolean(method) && group !== null,
    staleTime: 5 * 60_000,
  })

export function useSaveAttestation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number | null; body: AttestationWrite | AttestationPhase2 }) =>
      id === null ? createAttestation(body as AttestationWrite) : updateAttestation(id, body),
    onSuccess: (saved) => {
      queryClient.setQueryData(attestationKeys.detail(saved.id), saved)
      // допуск меняет и реестр сварщиков: «аттестован», худший срок
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: attestationKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['welders'] }),
      ])
    },
  })
}

export function useDeleteAttestation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteAttestation(id),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: attestationKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['welders'] }),
      ]),
  })
}

export const useWelders = (filters: { search?: string; active?: boolean } = {}) =>
  useQuery({ queryKey: ['welders', 'list', filters], queryFn: () => fetchWelders(filters) })

export function useSaveWelder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: SaveVars<WelderWrite>) => saveWelder(id, body),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['welders'] }),
        // ФИО и цех сварщика видны в реестре аттестаций
        queryClient.invalidateQueries({ queryKey: attestationKeys.all }),
      ]),
  })
}

export const useWorkshops = () =>
  useQuery({ queryKey: ['workshops'], queryFn: fetchWorkshops, staleTime: 5 * 60_000 })
