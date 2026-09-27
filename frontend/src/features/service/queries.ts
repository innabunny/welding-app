import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createServiceRequest, fetchServiceRequests, patchServiceRequest } from '@/shared/api/service'
import type { ServiceFilters, ServiceRequestCreate, ServiceRequestPatch } from '@/shared/types/service'

// первый элемент совпадает со сводкой в меню и на рабочем столе:
// любое действие с заявкой обновит и счётчики
export const serviceKeys = {
  all: ['service-requests'] as const,
  list: (filters: ServiceFilters) => ['service-requests', 'list', filters] as const,
}

export const useServiceRequests = (filters: ServiceFilters) =>
  useQuery({ queryKey: serviceKeys.list(filters), queryFn: () => fetchServiceRequests(filters) })

export function useCreateServiceRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ServiceRequestCreate) => createServiceRequest(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: serviceKeys.all }),
  })
}

export function usePatchServiceRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ServiceRequestPatch }) => patchServiceRequest(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: serviceKeys.all }),
  })
}
