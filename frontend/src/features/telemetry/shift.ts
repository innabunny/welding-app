import type { CurrentShift } from '@/shared/types/shifts'
import { formatDuration } from './format'

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '—')

/**
 * Смена словами. Фонд времени — всегда полная смена по графику;
 * прошедшая и оставшаяся части отдельно. Цифры приходят с сервера.
 */
export function shiftText(shift: CurrentShift | undefined): string | null {
  if (!shift) return null
  if (!shift.hasSchedule) return 'Графика смен на цех нет'
  const hours = `${hhmm(shift.startsAt)}–${hhmm(shift.endsAt)}`
  if (shift.inShift && shift.onBreak) return `Обед до ${hhmm(shift.breakEnd)}. Смена ${hours}`
  if (shift.inShift) {
    return (
      `Смена ${hours}: прошло ${formatDuration(shift.elapsedSeconds)}, ` +
      `осталось ${formatDuration(shift.remainingSeconds)} из ${formatDuration(shift.fundSeconds)} фонда времени`
    )
  }
  if (shift.isWorking === false) return shift.comment ? `Нерабочий день: ${shift.comment}` : 'Нерабочий день'
  return `Смена не идёт. Сегодня по графику ${hours}`
}
