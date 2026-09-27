import type { BadgeTone } from '@/shared/ui/Badge'
import type { InspectionMethod, InspectionResult, InspectionSpecimen, WeldStatus } from '@/shared/types/welding'

export const weldStatusMeta: Record<WeldStatus, { label: string; tone: BadgeTone }> = {
  in_work: { label: 'В работе', tone: 'blue' },
  done: { label: 'Сварен', tone: 'yellow' },
  accepted: { label: 'Принят', tone: 'green' },
  rejected: { label: 'Забракован', tone: 'red' },
}

export const resultMeta: Record<InspectionResult, { label: string; tone: BadgeTone }> = {
  годен: { label: 'Годен', tone: 'green' },
  исправление: { label: 'Требует исправления', tone: 'yellow' },
  брак: { label: 'Брак', tone: 'red' },
}

/** Методы контроля — как Inspection.Method на бэке */
export const METHODS: { value: InspectionMethod; title: string }[] = [
  { value: 'ВИК', title: 'Визуально-измерительный' },
  { value: 'РК', title: 'Радиографический' },
  { value: 'УЗК', title: 'Ультразвуковой' },
  { value: 'ПВК', title: 'Капиллярный' },
  { value: 'МК', title: 'Металлографический' },
]

export const SPECIMENS: { value: InspectionSpecimen; label: string }[] = [
  { value: 'шов', label: 'Сам шов' },
  { value: 'свидетель', label: 'Образец-свидетель' },
  { value: 'вырезка', label: 'Вырезка из шва' },
]
