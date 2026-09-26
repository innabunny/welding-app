import type {
  FillerMaterial,
  FillerMaterialWrite,
  GasFlux,
  GasFluxWrite,
  Material,
  MaterialGroup,
  MaterialGroupWrite,
  MaterialWrite,
} from '@/shared/types/materials'
import type { WeldingMethod } from '@/shared/types/methods'
import type { Workstation } from '@/shared/types/workshops'
import { api } from './client'

export async function fetchWeldingMethods(): Promise<WeldingMethod[]> {
  const { data } = await api.get<WeldingMethod[]>('/welding-methods/')
  return data
}

export async function fetchWorkstations(): Promise<Workstation[]> {
  const { data } = await api.get<Workstation[]>('/workstations/')
  return data
}

/** Список и запись для справочника с правкой: создание — POST, правка — PUT целиком */
function crud<T, W>(url: string) {
  return {
    list: async (): Promise<T[]> => (await api.get<T[]>(url)).data,
    save: async (id: number | null, body: W): Promise<T> =>
      id === null
        ? (await api.post<T>(url, body)).data
        : (await api.put<T>(`${url}${id}/`, body)).data,
  }
}

export const materialsApi = crud<Material, MaterialWrite>('/materials/')
export const materialGroupsApi = crud<MaterialGroup, MaterialGroupWrite>('/material-groups/')
export const fillerMaterialsApi = crud<FillerMaterial, FillerMaterialWrite>('/filler-materials/')
export const gasFluxApi = crud<GasFlux, GasFluxWrite>('/gas-flux/')
