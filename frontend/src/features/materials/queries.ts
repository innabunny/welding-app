import type { SaveVars } from '@/shared/ui/FormModal'
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import {
  fillerMaterialsApi,
  gasFluxApi,
  materialGroupsApi,
  materialsApi,
} from '@/shared/api/materials'
import type {
  FillerMaterialWrite,
  GasFluxWrite,
  MaterialGroupWrite,
  MaterialWrite,
} from '@/shared/types/materials'

// справочники меняются редко — держим дольше
const LOOKUP_STALE = 5 * 60_000

export const materialKeys = {
  materials: ['materials'] as const,
  materialGroups: ['material-groups'] as const,
  fillerMaterials: ['filler-materials'] as const,
  gasFlux: ['gas-flux'] as const,
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
  useQuery({ queryKey: materialKeys.materials, queryFn: materialsApi.list, staleTime: LOOKUP_STALE })

export const useMaterialGroups = () =>
  useQuery({
    queryKey: materialKeys.materialGroups,
    queryFn: materialGroupsApi.list,
    staleTime: LOOKUP_STALE,
  })

export const useFillerMaterials = () =>
  useQuery({
    queryKey: materialKeys.fillerMaterials,
    queryFn: fillerMaterialsApi.list,
    staleTime: LOOKUP_STALE,
  })

export const useGasFlux = () =>
  useQuery({ queryKey: materialKeys.gasFlux, queryFn: gasFluxApi.list, staleTime: LOOKUP_STALE })

export const useSaveMaterial = () => useSave<MaterialWrite>(materialsApi.save, [materialKeys.materials])

// код группы показывается и в списке материалов — обновляем оба
export const useSaveMaterialGroup = () =>
  useSave<MaterialGroupWrite>(materialGroupsApi.save, [
    materialKeys.materialGroups,
    materialKeys.materials,
  ])

export const useSaveFillerMaterial = () =>
  useSave<FillerMaterialWrite>(fillerMaterialsApi.save, [materialKeys.fillerMaterials])

export const useSaveGasFlux = () => useSave<GasFluxWrite>(gasFluxApi.save, [materialKeys.gasFlux])
