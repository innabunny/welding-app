import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchOperation, fetchOperations, fetchParts, fetchSeam } from '@/shared/api/technology'
import {
  fetchSimilar,
  fetchWeldingCard,
  fetchWeldingCards,
  saveWeldingCard,
} from '@/shared/api/weldingCards'
import type { SimilarParams, WeldingCardFilters, WeldingCardWrite } from '@/shared/types/weldingCards'

// первый элемент совпадает с ключом черновиков на рабочем столе:
// сохранение карты обновит и его
export const cardKeys = {
  all: ['welding-cards'] as const,
  list: (filters: WeldingCardFilters) => ['welding-cards', 'list', filters] as const,
  detail: (id: number) => ['welding-cards', 'detail', id] as const,
}

const LOOKUP_STALE = 5 * 60_000

export const useWeldingCards = (filters: WeldingCardFilters) =>
  useQuery({ queryKey: cardKeys.list(filters), queryFn: () => fetchWeldingCards(filters) })

export const useWeldingCard = (id: number | null) =>
  useQuery({
    queryKey: cardKeys.detail(id ?? 0),
    queryFn: () => fetchWeldingCard(id ?? 0),
    enabled: id !== null,
    // форма должна стартовать со свежих проходов, не из кэша
    staleTime: 0,
  })

export function useSaveWeldingCard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number | null; body: WeldingCardWrite }) => saveWeldingCard(id, body),
    onSuccess: (card) => {
      queryClient.setQueryData(cardKeys.detail(card.id), card)
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: cardKeys.all }),
        // у операции поменялся hasCard
        queryClient.invalidateQueries({ queryKey: ['operations'] }),
      ])
    },
  })
}

export const useParts = () => useQuery({ queryKey: ['parts'], queryFn: () => fetchParts(), staleTime: LOOKUP_STALE })

export const useOperations = (partId: number | null) =>
  useQuery({
    queryKey: ['operations', { part: partId }],
    queryFn: () => fetchOperations(partId ?? 0),
    enabled: partId !== null,
  })

export const useOperation = (id: number | null) =>
  useQuery({
    queryKey: ['operations', 'detail', id],
    queryFn: () => fetchOperation(id ?? 0),
    enabled: id !== null,
  })

export const useSeam = (id: number | null | undefined) =>
  useQuery({
    queryKey: ['seams', 'detail', id],
    queryFn: () => fetchSeam(id ?? 0),
    enabled: typeof id === 'number',
  })

/** Подсказка режимов: только по кнопке, поэтому мутация, а не автозапрос */
export const useSimilar = () => useMutation({ mutationFn: (params: SimilarParams) => fetchSimilar(params) })
