import type { DeviationParameter } from '@/shared/types/deviations'

/** Единица значения отклонения по параметру. Скорость — в м/ч, как в карте */
export const DEVIATION_UNIT: Record<DeviationParameter, string> = {
  'ток': 'А',
  'напряжение': 'В',
  'скорость': 'м/ч',
  'ток_импульса': 'А',
  'ток_паузы': 'А',
  'межслойная': 'с',
  'без_карты': '',
  'без_допуска': '',
}
