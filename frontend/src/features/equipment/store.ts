import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { EquipmentWrite } from '@/shared/types/equipment'

interface EquipmentUiState {
  search: string
  method: string
  onlyActive: boolean
  /**
   * Черновик только для новой установки. Для правки черновик не храним:
   * из него ушли бы устаревшие speedUnits/parameters и затёрли бы связи.
   */
  newDraft: EquipmentWrite | null
  setSearch: (search: string) => void
  setMethod: (method: string) => void
  setOnlyActive: (onlyActive: boolean) => void
  setNewDraft: (draft: EquipmentWrite | null) => void
}

export const useEquipmentUi = create<EquipmentUiState>()(
  persist(
    (set) => ({
      search: '',
      method: '',
      onlyActive: false,
      newDraft: null,
      setSearch: (search) => set({ search }),
      setMethod: (method) => set({ method }),
      setOnlyActive: (onlyActive) => set({ onlyActive }),
      setNewDraft: (newDraft) => set({ newDraft }),
    }),
    // поиск не запоминаем между визитами, фильтры и черновик — да
    {
      name: 'welding-equipment-ui',
      partialize: ({ method, onlyActive, newDraft }) => ({ method, onlyActive, newDraft }),
    },
  ),
)
