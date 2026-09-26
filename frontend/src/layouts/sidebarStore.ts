import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarState {
  hidden: boolean
  toggle: () => void
}

export const useSidebar = create<SidebarState>()(
  persist(
    (set) => ({
      hidden: false,
      toggle: () => set((s) => ({ hidden: !s.hidden })),
    }),
    { name: 'welding-sidebar' },
  ),
)
