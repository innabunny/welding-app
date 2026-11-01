import { paths } from '@/layouts/navigation'

/** Экран одного аппарата */
export const equipmentPath = (id: number) => `${paths.telemetry}/equipment/${id}`

/** «Оборудование в работе»; view — вкладка «вне допуска» или «нет связи» */
export const activePath = (view?: 'out' | 'offline') => `${paths.telemetry}/active${view ? `?view=${view}` : ''}`

/** Журнал прикладываний карт; фильтры — в адресе */
export const cardTapsPath = (filters: { equipment?: number; welder?: number } = {}) => {
  const q = new URLSearchParams()
  if (filters.equipment) q.set('equipment', String(filters.equipment))
  if (filters.welder) q.set('welder', String(filters.welder))
  const qs = q.toString()
  return `${paths.telemetry}/card-taps${qs ? `?${qs}` : ''}`
}
