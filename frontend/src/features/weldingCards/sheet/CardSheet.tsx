import type { Ref } from 'react'
import { sheetFieldsFor, type FieldSpec, type MethodCode } from '@/shared/config/methodFields'
import type { SeamSpec } from '@/shared/types/technology'
import type { WeldingCard, WeldPass } from '@/shared/types/weldingCards'
import { formatOf, modeOf, rangeProps, readText, seamValue } from '../fields'
import { num, rangeText } from '../format'

const DASH = '—'

// материалы, газы и флюс — из текстовых снимков: документ не едет вслед за справочником
const SNAPSHOTS: Record<string, keyof WeldingCard> = {
  tungsten_id: 'tungstenText',
  filler_id: 'fillerText',
  shield_gas_id: 'shieldGasText',
  backing_gas_id: 'backingGasText',
  plasma_gas_id: 'plasmaGasText',
  flux_id: 'fluxText',
}

// режим уже есть в правом блоке — в колонке не дублируем
const HANDLED_IN_HEADER = new Set(['welding_mode'])

const SEAM_DECIMALS = new Set(['thickness_1', 'thickness_2', 'mass_1', 'mass_2', 'seam_diameter', 'seam_length'])

function cardValue(f: FieldSpec, card: WeldingCard, seam: SeamSpec | undefined): string {
  const snapshot = SNAPSHOTS[f.key]
  let v: string | null
  if (f.owner === 'seam') {
    const raw = seamValue(f, card, seam)
    v = SEAM_DECIMALS.has(f.key) ? num(raw) : raw
  } else if (snapshot) {
    v = String(card[snapshot] ?? '')
  } else {
    const raw = readText(card, f)
    v = formatOf(f).kind === 'decimal' ? num(raw) : raw
  }
  return v || DASH
}

function passValue(f: FieldSpec, pass: WeldPass): string {
  let v: string
  if (f.key === 'speed') v = rangeText(pass.speedMin ?? null, pass.speedMax ?? null)
  else if (f.key === 'pass_filler_id') v = pass.fillerText ?? ''
  else if (f.range) {
    const [lo, hi] = rangeProps(f)
    v = rangeText(readText(pass, f, lo), readText(pass, f, hi))
    // единица установки у каждого прохода своя
    if (f.key === 'speed_raw' && v && pass.speedUnitName) v = `${v} ${pass.speedUnitName}`
  } else {
    const raw = readText(pass, f)
    v = formatOf(f).kind === 'decimal' ? num(raw) : (raw ?? '')
  }
  return v || DASH
}

function passHead(f: FieldSpec): { label: string; unit?: string } {
  const label = f.label.replace(/\s*\(от–до\)$/, '')
  // «ед. уст.» ничего не говорит — единица печатается в значении
  return f.key === 'speed_raw' ? { label } : { label, unit: f.unit }
}

interface Props {
  card: WeldingCard
  method: MethodCode
  seam: SeamSpec | undefined
  ref?: Ref<HTMLDivElement>
}

/** Бланк техкарты: только поля с флагом «идёт в техкарту». Разметка — как в CardSheet.vue */
export function CardSheet({ card, method, seam, ref }: Props) {
  const mode = modeOf(card.weldingMode)
  const cardFields = sheetFieldsFor(method, 'card', mode).filter((f) => !HANDLED_IN_HEADER.has(f.key))
  const passFields = sheetFieldsFor(method, 'pass', mode)

  return (
    <div ref={ref} className="card-sheet">
      <div className="toprow">
        <div className="tc">{card.equipmentName}</div>
        <div className="tc tc-title">Карта технологического процесса сварки №{card.cardNo || DASH}</div>
        <div className="tc tc-num">{card.partNumber || DASH}</div>
        <div className="tc tc-op">Операция {card.operationNumber || DASH}</div>
      </div>

      <div className="body">
        <div className="col col-left">
          <div className="row equip">{card.methodName}</div>
          {cardFields.map((f) => (
            <div key={f.key} className="row fld2">
              <div className="lab">
                {f.label}
                {f.unit ? `, ${f.unit}` : ''}
              </div>
              <div className="val">{cardValue(f, card, seam)}</div>
            </div>
          ))}
        </div>

        <div className="col col-esk">
          {card.grooveSvg ? (
            // через img, а не вставкой разметки: скрипты внутри SVG так не выполнятся
            <div className="esk-svg">
              <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(card.grooveSvg)}`} alt="Эскиз разделки" />
            </div>
          ) : (
            <div className="esk-empty">
              <div className="lab">Эскиз не добавлен</div>
            </div>
          )}
        </div>

        <div className="col col-right">
          <div className="rj">
            <div className="lab">Шов №</div>
            <div className="val">{card.seamNumber || DASH}</div>
          </div>
          <div className="rj">
            <div className="lab">Обозначение</div>
            <div className="val">{card.designation || DASH}</div>
          </div>
          <div className="rj">
            <div className="lab">Режим</div>
            <div className="val">{card.weldingMode || DASH}</div>
          </div>
          <div className="tail" />
        </div>
      </div>

      <table className="passes">
        <thead>
          <tr>
            <th className="cn">
              №<br />
              прохода
            </th>
            {passFields.map((f) => {
              const { label, unit } = passHead(f)
              return (
                <th key={f.key}>
                  {label}
                  {unit && (
                    <>
                      <br />
                      {unit}
                    </>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {card.passes.map((p) => (
            <tr key={p.no}>
              <td className="cn">{p.no}</td>
              {passFields.map((f) => (
                <td key={f.key}>{passValue(f, p)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="foot">
        <div className="foot__cell">
          <span className="lab">Составил</span>
          <span className="val">{card.authorName}</span>
        </div>
      </div>
    </div>
  )
}
