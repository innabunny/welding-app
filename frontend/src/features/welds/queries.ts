import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createInspection, fetchWeldList, fetchWeldPassport, patchWeldStatus } from '@/shared/api/welding'
import type { InspectionCreate, WeldFilters, WeldStatus } from '@/shared/types/welding'

// первый элемент совпадает с рабочим столом: «последние швы» и «ждут контроля»
export const weldKeys = {
  all: ['welds'] as const,
  list: (filters: WeldFilters) => ['welds', 'list', filters] as const,
  passport: (id: number) => ['welds', 'passport', id] as const,
}

export const useWeldList = (filters: WeldFilters) =>
  useQuery({ queryKey: weldKeys.list(filters), queryFn: () => fetchWeldList(filters) })

export const useWeldPassport = (id: number | null) =>
  useQuery({ queryKey: weldKeys.passport(id ?? 0), queryFn: () => fetchWeldPassport(id ?? 0), enabled: id !== null })

function useInvalidateWelds() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: weldKeys.all }),
      // отклонения по проходам на рабочем столе
      queryClient.invalidateQueries({ queryKey: ['operation-runs'] }),
    ])
}

export function useSetWeldStatus() {
  const invalidate = useInvalidateWelds()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: WeldStatus }) => patchWeldStatus(id, status),
    onSuccess: invalidate,
  })
}

export function useCreateInspection() {
  const invalidate = useInvalidateWelds()
  return useMutation({ mutationFn: (body: InspectionCreate) => createInspection(body), onSuccess: invalidate })
}
