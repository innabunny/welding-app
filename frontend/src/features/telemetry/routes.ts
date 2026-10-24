import { paths } from '@/layouts/navigation'

/** Экран одного аппарата; ?session=<id> — показать прошлый сеанс */
export const equipmentPath = (id: number, session?: number) =>
  `${paths.telemetry}/equipment/${id}${session ? `?session=${session}` : ''}`
