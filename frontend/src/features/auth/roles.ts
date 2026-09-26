import type { UserRole } from '@/shared/types/auth'

export const roleLabels: Record<UserRole, string> = {
  admin: 'Администратор',
  master: 'Мастер',
  mechanic: 'Механик',
  technologist: 'Инженер-технолог',
  inspector: 'Контролёр',
  '': 'Пользователь',
}
