import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createEquipment,
  fetchEquipment,
  fetchEquipmentList,
  fetchEquipmentParameters,
  fetchSpeedUnits,
  updateEquipment,
} from '@/shared/api/equipment'
import { fetchWeldingMethods, fetchWorkstations } from '@/shared/api/references'
import type { EquipmentFilters, EquipmentWrite } from '@/shared/types/equipment'

export const equipmentKeys = {
  all: ['equipment'] as const,
  list: (filters: EquipmentFilters) => ['equipment', 'list', filters] as const,
  detail: (id: number) => ['equipment', 'detail', id] as const,
}

// справочники меняются редко — держим дольше
const REFERENCE_STALE = 5 * 60_000

export const useEquipmentList = (filters: EquipmentFilters) =>
  useQuery({ queryKey: equipmentKeys.list(filters), queryFn: () => fetchEquipmentList(filters) })

export const useEquipment = (id: number | null) =>
  useQuery({
    queryKey: equipmentKeys.detail(id ?? 0),
    queryFn: () => fetchEquipment(id ?? 0),
    enabled: id !== null,
    // форма правки должна стартовать со свежих связей, не из кэша
    staleTime: 0,
  })

export const useWeldingMethods = () =>
  useQuery({ queryKey: ['welding-methods'], queryFn: fetchWeldingMethods, staleTime: REFERENCE_STALE })

export const useWorkstations = () =>
  useQuery({ queryKey: ['workstations'], queryFn: fetchWorkstations, staleTime: REFERENCE_STALE })

export const useSpeedUnits = () =>
  useQuery({ queryKey: ['speed-units'], queryFn: fetchSpeedUnits, staleTime: REFERENCE_STALE })

export const useEquipmentParameters = () =>
  useQuery({
    queryKey: ['equipment-parameters'],
    queryFn: fetchEquipmentParameters,
    staleTime: REFERENCE_STALE,
  })

export function useSaveEquipment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number | null; body: EquipmentWrite }) =>
      id === null ? createEquipment(body) : updateEquipment(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: equipmentKeys.all }),
  })
}
