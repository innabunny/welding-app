import { paths } from '@/layouts/navigation'

/** Экран одного аппарата */
export const equipmentPath = (id: number) => `${paths.telemetry}/equipment/${id}`

/** «Оборудование в работе»; view — вкладка «вне допуска» или «нет связи» */
export const activePath = (view?: 'out' | 'offline') => `${paths.telemetry}/active${view ? `?view=${view}` : ''}`
