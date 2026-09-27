import { create } from 'zustand'

export type ToastTone = 'success' | 'error'

export interface ToastItem {
  id: number
  text: string
  tone: ToastTone
}

interface ToastState {
  items: ToastItem[]
  show: (text: string, tone?: ToastTone) => void
  dismiss: (id: number) => void
}

const LIFETIME = 3500
let nextId = 1

export const useToasts = create<ToastState>()((set, get) => ({
  items: [],
  show: (text, tone = 'success') => {
    const id = nextId++
    // держим не больше трёх: старые уходят, стопка не растёт
    set((s) => ({ items: [...s.items.slice(-2), { id, text, tone }] }))
    window.setTimeout(() => get().dismiss(id), LIFETIME)
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}))

/** Короткое уведомление снизу: toast('Заявка отправлена') */
export const toast = (text: string, tone?: ToastTone) => useToasts.getState().show(text, tone)
