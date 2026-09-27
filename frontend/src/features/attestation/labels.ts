import type { AttestationStatus, ExpiryState } from '@/shared/types/attestation'
import type { BadgeTone } from '@/shared/ui/Badge'

/** Путь аттестации по шагам — как STATUS_CHOICES на бэке */
export const STEPS: { value: AttestationStatus; label: string; hint: string }[] = [
  { value: 'draft', label: 'Черновик', hint: 'Сварщик, способ, образцы' },
  { value: 'testing', label: 'Испытания', hint: 'Образцы сварены, ждём результатов' },
  { value: 'protocol', label: 'Протокол', hint: 'Результаты внесены, оформляем' },
  { value: 'review', label: 'Согласование', hint: 'Подписи комиссии' },
  { value: 'done', label: 'Аттестован', hint: 'Допуск действует 3 года' },
]

export const statusTone: Record<AttestationStatus, BadgeTone> = {
  draft: 'gray',
  testing: 'blue',
  protocol: 'blue',
  review: 'yellow',
  done: 'green',
}

export const expiryMeta: Record<Exclude<ExpiryState, ''>, { label: string; tone: BadgeTone }> = {
  valid: { label: 'Действует', tone: 'green' },
  soon: { label: 'Истекает', tone: 'yellow' },
  expired: { label: 'Просрочен', tone: 'red' },
}

/** Виды контроля: бэк хранит строчными */
export const CONTROLS: { value: string; label: string; title: string }[] = [
  { value: 'вик', label: 'ВИК', title: 'Визуально-измерительный' },
  { value: 'рк', label: 'РК', title: 'Радиографический' },
  { value: 'узк', label: 'УЗК', title: 'Ультразвуковой' },
  { value: 'пвк', label: 'ПВК', title: 'Капиллярный' },
  { value: 'мк', label: 'МК', title: 'Металлографический' },
]
