import { isExtra, type FieldSpec } from '@/shared/config/methodFields'
import type { FillerMaterial, GasFlux } from '@/shared/types/materials'
import type { WeldingCardWrite, WeldPass } from '@/shared/types/weldingCards'
import { DecimalInput } from '@/shared/ui/DecimalInput'
import { Input, Select } from '@/shared/ui/Form'
import { formatOf, propName, rangeProps, readText, readValue, writeValue } from './fields'
import { FieldBox, RangeField } from './FormBits'

export interface Lookups {
  tungsten: FillerMaterial[]
  fillers: FillerMaterial[]
  gases: GasFlux[]
  fluxes: GasFlux[]
}

interface Props<T extends WeldingCardWrite | WeldPass> {
  spec: FieldSpec
  obj: T
  onChange: (next: T) => void
  lookups: Lookups
  errors: Record<string, string>
  /** Есть ли импульсный режим у выбранной установки */
  pulseAllowed?: boolean
  className?: string
}

function fkValue(value: unknown): string {
  return typeof value === 'number' ? String(value) : ''
}

function fkParse(value: string): number | null {
  return value === '' ? null : Number(value)
}

/** Одно редактируемое поле карты или прохода — вид ввода берётся из fields.ts */
export function FieldInput<T extends WeldingCardWrite | WeldPass>({
  spec,
  obj,
  onChange,
  lookups,
  errors,
  pulseAllowed,
  className,
}: Props<T>) {
  const format = formatOf(spec)

  if (spec.range && format.kind === 'decimal') {
    const [minProp, maxProp] = rangeProps(spec)
    return (
      <RangeField
        label={spec.label.replace(/\s*\(от–до\)$/, '')}
        unit={spec.unit}
        format={format}
        min={readText(obj, spec, minProp)}
        max={readText(obj, spec, maxProp)}
        onChange={(min, max) => onChange({ ...obj, [minProp]: min, [maxProp]: max })}
        serverError={errors[minProp] ?? errors[maxProp]}
        className={className}
      />
    )
  }

  // ошибки по extra сервер отдаёт одной строкой на весь объект
  const error = errors[isExtra(spec) ? 'extra' : propName(spec)]
  const set = (value: unknown) => onChange(writeValue(obj, spec, value))
  const noPulse = format.kind === 'mode' && !pulseAllowed

  return (
    <FieldBox
      label={spec.label}
      unit={format.kind === 'decimal' ? spec.unit : undefined}
      error={error}
      note={noPulse ? 'Импульсный режим недоступен: у установки его нет или она не выбрана' : undefined}
      className={className}
    >
      {(id, describedBy) => {
        const common = { id, 'aria-describedby': describedBy, invalid: Boolean(error) }
        switch (format.kind) {
          case 'decimal':
            return (
              <DecimalInput
                {...common}
                {...format}
                value={readText(obj, spec)}
                onChange={set}
              />
            )
          case 'text':
            return (
              <Input
                {...common}
                maxLength={format.maxLength}
                value={readText(obj, spec) ?? ''}
                onChange={(e) => set(e.target.value)}
              />
            )
          case 'mode':
            return (
              <Select {...common} value={String(readValue(obj, spec) || 'непрерывный')} onChange={(e) => set(e.target.value)}>
                <option value="непрерывный">Непрерывный</option>
                <option value="импульсный" disabled={!pulseAllowed}>
                  Импульсный{pulseAllowed ? '' : ' — нет у установки'}
                </option>
              </Select>
            )
          case 'tungsten':
          case 'filler': {
            const list = format.kind === 'tungsten' ? lookups.tungsten : lookups.fillers
            return (
              <Select {...common} value={fkValue(readValue(obj, spec))} onChange={(e) => set(fkParse(e.target.value))}>
                <option value="">{spec.level === 'pass' ? 'Как в карте' : 'Не выбран'}</option>
                {list.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </Select>
            )
          }
          case 'gas':
          case 'flux': {
            const list = format.kind === 'gas' ? lookups.gases : lookups.fluxes
            return (
              <Select {...common} value={fkValue(readValue(obj, spec))} onChange={(e) => set(fkParse(e.target.value))}>
                <option value="">Не выбран</option>
                {list.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.value}
                  </option>
                ))}
              </Select>
            )
          }
        }
      }}
    </FieldBox>
  )
}

