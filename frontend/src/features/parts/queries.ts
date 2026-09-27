import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteOperation,
  deletePart,
  deleteSeam,
  fetchPart,
  fetchParts,
  saveOperation,
  savePart,
  saveSeam,
} from '@/shared/api/technology'
import type { PartFilters } from '@/shared/types/technology'
import type { SaveVars } from '@/shared/ui/FormModal'

export const partKeys = {
  all: ['parts'] as const,
  list: (filters: PartFilters) => ['parts', 'list', filters] as const,
  detail: (id: number) => ['parts', 'detail', id] as const,
}

export const useParts = (filters: PartFilters) =>
  useQuery({ queryKey: partKeys.list(filters), queryFn: () => fetchParts(filters) })

export const usePart = (id: number | null) =>
  useQuery({ queryKey: partKeys.detail(id ?? 0), queryFn: () => fetchPart(id ?? 0), enabled: id !== null })

/**
 * После любой правки обновляем всё, что показывает детали, швы и операции:
 * форма техкарты берёт из них материалы, толщины и диаметр шва.
 */
const RELATED = [['parts'], ['operations'], ['seams'], ['welding-cards']]

function useSave<W, R>(save: (id: number | null, body: W) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: SaveVars<W>) => save(id, body),
    onSuccess: () => Promise.all(RELATED.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  })
}

function useDelete(remove: (id: number) => Promise<void>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: remove,
    onSuccess: () => Promise.all(RELATED.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  })
}

export const useDeletePart = () => useDelete(deletePart)
export const useDeleteSeam = () => useDelete(deleteSeam)
export const useDeleteOperation = () => useDelete(deleteOperation)

export const useSavePart = () => useSave(savePart)
export const useSaveSeam = () => useSave(saveSeam)
export const useSaveOperation = () => useSave(saveOperation)
