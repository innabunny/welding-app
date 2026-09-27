import {
  AlertTriangle,
  CalendarCheck,
  Stethoscope,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { BadgeTone } from '@/shared/ui/Badge'
import type { ServicePriority, ServiceReason, ServiceStatus } from '@/shared/types/service'

export const reasons: { value: ServiceReason; label: string; hint: string; icon: LucideIcon }[] = [
  { value: 'ремонт', label: 'Ремонт', hint: 'Что-то сломалось', icon: Wrench },
  { value: 'диагностика', label: 'Диагностика', hint: 'Работает странно', icon: Stethoscope },
  { value: 'неисправность', label: 'Неисправность', hint: 'Не включается, ошибка', icon: AlertTriangle },
  { value: 'то', label: 'Плановое ТО', hint: 'По графику', icon: CalendarCheck },
]

export const reasonMeta = Object.fromEntries(reasons.map((r) => [r.value, r])) as Record<
  ServiceReason,
  (typeof reasons)[number]
>

export const priorities: { value: ServicePriority; label: string; tone: BadgeTone }[] = [
  { value: 'низкая', label: 'Низкая', tone: 'gray' },
  { value: 'средняя', label: 'Средняя', tone: 'yellow' },
  { value: 'высокая', label: 'Высокая', tone: 'red' },
]

export const priorityMeta = Object.fromEntries(priorities.map((p) => [p.value, p])) as Record<
  ServicePriority,
  (typeof priorities)[number]
>

export const statusMeta: Record<ServiceStatus, { label: string; tone: BadgeTone }> = {
  open: { label: 'Подана', tone: 'blue' },
  in_work: { label: 'В работе', tone: 'yellow' },
  done: { label: 'Выполнена', tone: 'green' },
  rejected: { label: 'Отклонена', tone: 'gray' },
}
