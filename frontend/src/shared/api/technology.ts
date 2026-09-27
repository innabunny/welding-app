import type {
  Operation,
  OperationWrite,
  Part,
  PartDetail,
  PartFilters,
  PartWrite,
  SeamSpec,
  SeamWrite,
} from '@/shared/types/technology'
import { api } from './client'

export async function fetchParts(filters: PartFilters = {}): Promise<Part[]> {
  // параметры запроса бэк читает в snake_case — camelCase-парсер их не трогает
  const params: Record<string, string> = {}
  const search = filters.search?.trim()
  if (search) params.search = search
  if (filters.active) params.active = '1'
  if (filters.withoutCards) params.without_cards = '1'
  const { data } = await api.get<Part[]>('/parts/', { params })
  return data
}

export async function fetchPart(id: number): Promise<PartDetail> {
  const { data } = await api.get<PartDetail>(`/parts/${id}/`)
  return data
}

/** Создание — POST, правка — PUT целиком */
async function save<T, W>(url: string, id: number | null, body: W): Promise<T> {
  const { data } = id === null ? await api.post<T>(url, body) : await api.put<T>(`${url}${id}/`, body)
  return data
}

export const savePart = (id: number | null, body: PartWrite) => save<Part, PartWrite>('/parts/', id, body)
export const saveSeam = (id: number | null, body: SeamWrite) => save<SeamSpec, SeamWrite>('/seams/', id, body)
export const saveOperation = (id: number | null, body: OperationWrite) =>
  save<Operation, OperationWrite>('/operations/', id, body)

export async function fetchOperations(partId: number): Promise<Operation[]> {
  const { data } = await api.get<Operation[]>('/operations/', { params: { part: String(partId) } })
  return data
}

export async function fetchOperation(id: number): Promise<Operation> {
  const { data } = await api.get<Operation>(`/operations/${id}/`)
  return data
}

export async function fetchSeam(id: number): Promise<SeamSpec> {
  const { data } = await api.get<SeamSpec>(`/seams/${id}/`)
  return data
}
