import type { OperationRun, Weld, WeldPassRun } from '@/shared/types/welding'

/** Выше этого процента отклонение считается браком режима, ниже — предупреждением */
const BAD_DEVIATION_PERCENT = 10

export type DeviationTone = 'ok' | 'warn' | 'bad'

export interface DeviationRow {
  runId: number
  title: string
  subtitle: string
  plannedMin: number | null
  plannedMax: number | null
  actual: number
  tone: DeviationTone
  label: string
  /** Ширина полосы, 0–100: верх диапазона карты стоит на 75 % */
  barPercent: number
  finishedAt: string | null
}

function severity(pass: WeldPassRun): number {
  const d = pass.deviation
  if (!d) return -1
  return d.state === 'в допуске' ? 0 : d.percent
}

function toneOf(pass: WeldPassRun): DeviationTone {
  const d = pass.deviation
  if (!d || d.state === 'в допуске') return 'ok'
  return d.percent > BAD_DEVIATION_PERCENT ? 'bad' : 'warn'
}

function labelOf(pass: WeldPassRun): string {
  const d = pass.deviation
  if (!d || d.state === 'в допуске') return 'в допуске'
  const pct = d.percent.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
  return d.state === 'выше' ? `+${pct} % выше` : `−${pct} % ниже`
}

export function weldTitle(weld: Pick<Weld, 'partNumber' | 'serialNo' | 'seamNumber'>): string {
  return `${weld.partNumber} № ${weld.serialNo} · шов ${weld.seamNumber}`
}

/**
 * По каждой выполненной операции — самый плохой проход. Операции без
 * телеметрии или без плана в карте пропускаются: сравнивать не с чем.
 */
export function buildDeviationRows(
  runs: OperationRun[],
  welds: Weld[],
  limit: number,
): DeviationRow[] {
  const weldById = new Map(welds.map((w) => [w.id, w]))
  const rows: DeviationRow[] = []

  for (const run of runs) {
    const worst = run.passes
      .filter((p) => p.deviation && p.actualCurrent && p.plannedCurrent)
      .sort((a, b) => severity(b) - severity(a))[0]
    if (!worst?.actualCurrent || !worst.plannedCurrent) continue

    const weld = weldById.get(run.weldId)
    const { min, max } = worst.plannedCurrent
    const actual = worst.actualCurrent.avg
    const scaleTop = max ?? actual

    rows.push({
      runId: run.id,
      title: weld ? weldTitle(weld) : `Шов № ${run.weldId}`,
      subtitle: [`оп. ${run.operationNumber}`, run.cardNo && `карта ${run.cardNo}`, run.equipmentName]
        .filter(Boolean)
        .join(' · '),
      plannedMin: min,
      plannedMax: max,
      actual,
      tone: toneOf(worst),
      label: labelOf(worst),
      barPercent: scaleTop > 0 ? Math.min(100, (actual / scaleTop) * 75) : 0,
      finishedAt: run.finishedAt,
    })
  }

  return rows
    .sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))
    .slice(0, limit)
}
