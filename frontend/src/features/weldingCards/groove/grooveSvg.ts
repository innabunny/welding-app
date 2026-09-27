/**
 * Эскиз разделки кромок из параметров карты. Рисует eskizGen — генератор
 * из прежней версии портала; здесь только перевод данных карты в его
 * параметры. Толщина берётся из шва, число проходов — из карты.
 *
 * Результат сохраняется строкой SVG в groove_svg: бланк печатает его как есть,
 * чертёж прикладывать не нужно.
 */

import type { WeldingCardWrite } from '@/shared/types/weldingCards'
import { eskizSVG } from './eskizGen'

export type GrooveType = 'I' | 'V'

export type GrooveDraft = Pick<
  WeldingCardWrite,
  'grooveType' | 'grooveAngle' | 'grooveGap' | 'grooveRoot' | 'grooveCap' | 'grooveRootCap' | 'grooveWidth'
>

export const GROOVE_TYPES: { value: GrooveType; label: string; hint: string }[] = [
  { value: 'I', label: 'Без разделки', hint: 'тонкий металл, кромки без скоса' },
  { value: 'V', label: 'V-образная', hint: 'скос двух кромок, С17' },
]

export interface GrooveParams {
  type: GrooveType
  /** Толщина из шва, мм */
  s: number
  /** Угол разделки α, полный */
  angle: number
  gap: number
  root: number
  cap: number
  rootCap: number
  /** Заход валика на кромку с каждой стороны, мм */
  toe: number
  passes: number
}

export function grooveSvg(p: GrooveParams): string {
  const bevel = p.type === 'V'
  return eskizSVG({
    jt: bevel ? 'С17' : 'С2',
    s: p.s,
    // без разделки: ни угла, ни притупления — вершина разделки у корня
    alpha: bevel ? p.angle : 0,
    b: p.gap,
    c: bevel ? p.root : 0,
    n: Math.max(1, Math.min(Math.round(p.passes), 12)),
    g: p.cap,
    g1: p.rootCap,
    f: p.toe,
  })
}

export const isGrooveType = (v: string): v is GrooveType => v === 'I' || v === 'V'
const num = (v: string | null, fallback: number) => (v === null || v === '' ? fallback : Number(v))

/** Параметры эскиза из карты и шва; null — эскиза нет */
export function grooveParams(
  d: GrooveDraft,
  s1: number | null,
  s2: number | null,
  /** Проходов в карте — эскиз рисует их слоями */
  passes = 1,
): GrooveParams | null {
  if (!isGrooveType(d.grooveType)) return null
  return {
    type: d.grooveType,
    // генератор рисует одну толщину; при разных берём большую — по ней разделка
    s: Math.max(s1 ?? 0, s2 ?? 0) || 3,
    angle: num(d.grooveAngle, 60),
    gap: num(d.grooveGap, 0),
    root: num(d.grooveRoot, 0),
    cap: num(d.grooveCap, 0),
    rootCap: num(d.grooveRootCap, 0),
    toe: num(d.grooveWidth, 1.5),
    passes,
  }
}
