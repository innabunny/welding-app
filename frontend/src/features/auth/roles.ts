import type { UserRole } from '@/shared/types/auth'

export const roleLabels: Record<UserRole, string> = {
  admin: 'Администратор',
  master: 'Мастер',
  mechanic: 'Механик',
  technologist: 'Инженер-технолог',
  inspector: 'Контролёр',
  '': 'Пользователь',
}

/** Детали, операции и справочники материалов правят администратор и технолог — как на бэке */
export const canEditTechnology = (role: UserRole | undefined): boolean =>
  role === 'admin' || role === 'technologist'

/** Аттестацию и сварщиков ведут администратор, технолог и мастер — как на бэке */
export const canEditAttestation = (role: UserRole | undefined): boolean =>
  role === 'admin' || role === 'technologist' || role === 'master'
