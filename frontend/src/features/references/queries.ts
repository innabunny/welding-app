import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import {
  fillerMaterialsApi,
  gasFluxApi,
  materialGroupsApi,
  materialsApi,
} from '@/shared/api/references'
import type {
  FillerMaterialWrite,
  GasFluxWrite,
  MaterialGroupWrite,
  MaterialWrite,
} from '@/shared/types/materials'

// справочники меняются редко — держим дольше
const REFERENCE_STALE = 5 * 60_000

export const referenceKeys = {
  materials: ['materials'] as const,
  materialGroups: ['material-groups'] as const,
  fillerMaterials: ['filler-materials'] as const,
  gasFlux: ['gas-flux'] as const,
}

export interface SaveVars<W> {
  id: number | null
  body: W
}

function useSave<W>(save: (id: number | null, body: W) => Promise<unknown>, keys: QueryKey[]) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: SaveVars<W>) => save(id, body),
    onSuccess: () =>
      Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  })
}

export const useMaterials = () =>
  useQuery({ queryKey: referenceKeys.materials, queryFn: materialsApi.list, staleTime: REFERENCE_STALE })

export const useMaterialGroups = () =>
  useQuery({
    queryKey: referenceKeys.materialGroups,
    queryFn: materialGroupsApi.list,
    staleTime: REFERENCE_STALE,
  })

export const useFillerMaterials = () =>
  useQuery({
    queryKey: referenceKeys.fillerMaterials,
    queryFn: fillerMaterialsApi.list,
    staleTime: REFERENCE_STALE,
  })

export const useGasFlux = () =>
  useQuery({ queryKey: referenceKeys.gasFlux, queryFn: gasFluxApi.list, staleTime: REFERENCE_STALE })

export const useSaveMaterial = () => useSave<MaterialWrite>(materialsApi.save, [referenceKeys.materials])

// код группы показывается и в списке материалов — обновляем оба
export const useSaveMaterialGroup = () =>
  useSave<MaterialGroupWrite>(materialGroupsApi.save, [
    referenceKeys.materialGroups,
    referenceKeys.materials,
  ])

export const useSaveFillerMaterial = () =>
  useSave<FillerMaterialWrite>(fillerMaterialsApi.save, [referenceKeys.fillerMaterials])

export const useSaveGasFlux = () => useSave<GasFluxWrite>(gasFluxApi.save, [referenceKeys.gasFlux])
