import { AlertTriangle, Trash2 } from 'lucide-react'
import { sectionsFor, type FieldSpec, type MethodCode, type WeldingMode } from '@/shared/config/methodFields'
import { formatRange } from '@/shared/lib/format'
import type { SpeedUnit } from '@/shared/types/equipment'
import type { WeldPass } from '@/shared/types/weldingCards'
import { IconButton } from '@/shared/ui/Button'
import { Checkbox, Select } from '@/shared/ui/Form'
import { formatOf, type DecimalFormat } from './fields'
import { FieldInput, type Lookups } from './FieldInput'
import { FieldBox, RangeField } from './FormBits'

interface Props {
  pass: WeldPass
  /** Как проход лежит на сервере — чтобы понять, актуален ли пересчёт в м/ч */
  saved: WeldPass | undefined
  method: MethodCode
  mode: WeldingMode
  lookups: Lookups
  /** Единицы скорости выбранной установки */
  speedUnits: SpeedUnit[]
  equipmentChosen: boolean
  seamDiameter: string | null
  errors: Record<string, string>
  canDelete: boolean
  onChange: (next: WeldPass) => void
  onDelete: () => void
}

export function PassCard({
  pass,
  saved,
  method,
  mode,
  lookups,
  speedUnits,
  equipmentChosen,
  seamDiameter,
  errors,
  canDelete,
  onChange,
  onDelete,
}: Props) {
  const sections = sectionsFor(method, 'pass', mode)

  return (
    <article className="rounded-tile border border-border bg-surface p-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Проход {pass.no}</h3>
        <IconButton
          label={canDelete ? `Удалить проход ${pass.no}` : 'Последний проход удалить нельзя'}
          disabled={!canDelete}
          onClick={onDelete}
          className="disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text"
        >
          <Trash2 />
        </IconButton>
      </header>

      {sections.map(({ section, fields }) => (
        <section key={section || 'main'} className="mb-1">
          {section && (
            <h4 className="mb-2 mt-2 text-xs font-semibold uppercase tracking-wide text-muted">{section}</h4>
          )}
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((spec) => {
              // скорость в м/ч считает сервер — выводится внутри блока скорости
              if (spec.readOnly) return null
              if (spec.key === 'speed_raw')
                return (
                  <SpeedBlock
                    key={spec.key}
                    spec={spec}
                    pass={pass}
                    saved={saved}
                    speedUnits={speedUnits}
                    equipmentChosen={equipmentChosen}
                    seamDiameter={seamDiameter}
                    errors={errors}
                    onChange={onChange}
                  />
                )
              return (
                <FieldInput key={spec.key} spec={spec} obj={pass} onChange={onChange} lookups={lookups} errors={errors} />
              )
            })}
          </div>
        </section>
      ))}
    </article>
  )
}

interface SpeedProps {
  spec: FieldSpec
  pass: WeldPass
  saved: WeldPass | undefined
  speedUnits: SpeedUnit[]
  equipmentChosen: boolean
  seamDiameter: string | null
  errors: Record<string, string>
  onChange: (next: WeldPass) => void
}

function SpeedBlock({ spec, pass, saved, speedUnits, equipmentChosen, seamDiameter, errors, onChange }: SpeedProps) {
  const unit = speedUnits.find((u) => u.id === pass.speedUnitId)
  // единица осталась от прошлой установки, у новой её нет
  const foreignUnit = pass.speedUnitId !== null && !unit
  const unitError =
    errors.speedUnitId ?? (foreignUnit ? 'У выбранной установки нет этой единицы' : undefined)

  return (
    // подсетка — только в ряд: на телефоне три поля стоят столбиком, им нужно
    // 12 строк, а подсетка дала бы 4 — поля наехали бы друг на друга
    <div className="grid gap-x-4 sm:col-span-2 sm:row-span-4 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)_minmax(0,1fr)] sm:grid-rows-subgrid lg:col-span-3">
      <FieldBox label="Единица скорости" error={unitError}>
        {(id, describedBy) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            invalid={Boolean(unitError)}
            value={pass.speedUnitId ?? ''}
            disabled={!equipmentChosen}
            onChange={(e) => onChange({ ...pass, speedUnitId: e.target.value === '' ? null : Number(e.target.value) })}
          >
            <option value="">{equipmentChosen ? 'Не выбрана' : 'Выберите установку'}</option>
            {foreignUnit && <option value={pass.speedUnitId ?? ''}>{pass.speedUnitName || 'другая'} — нет у установки</option>}
            {speedUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        )}
      </FieldBox>
      <RangeField
        label="Скорость"
        unit={unit?.name ?? 'в ед. установки'}
        format={formatOf(spec) as DecimalFormat}
        min={pass.speedRawMin}
        max={pass.speedRawMax}
        onChange={(min, max) => onChange({ ...pass, speedRawMin: min, speedRawMax: max })}
        serverError={errors.speedRawMin ?? errors.speedRawMax}
      />
      {/* не FieldBox, но стоит в ряду с ними — на тех же строках сетки */}
      <div className="row-span-4 grid grid-rows-subgrid content-start gap-1.5">
        <span className="text-caption font-semibold text-muted">Скорость, м/ч</span>
        <MetersPerHour pass={pass} saved={saved} unit={unit} seamDiameter={seamDiameter} />
        <Checkbox
          label="Обязательна к соблюдению"
          description="контроль по телеметрии"
          checked={pass.speedRequired}
          onChange={(e) => onChange({ ...pass, speedRequired: e.target.checked })}
          className="mt-1"
        />
      </div>
    </div>
  )
}

/** Пересчёт в м/ч — только показываем, считает сервер при сохранении */
function MetersPerHour({ pass, saved, unit, seamDiameter }: {
  pass: WeldPass
  saved: WeldPass | undefined
  unit: SpeedUnit | undefined
  seamDiameter: string | null
}) {
  const box = 'flex h-9 items-center rounded-control bg-surface-2 px-3 text-sm'
  if (!unit) return <div className={`${box} text-muted`}>—</div>

  if (unit.isAngular && !seamDiameter)
    return (
      <div role="status" className="flex gap-2 rounded-control bg-warning-soft px-3 py-2 text-xs text-warning">
        <AlertTriangle className="mt-px size-4 shrink-0" aria-hidden />
        <span>
          Пересчёт невозможен: {unit.name} — угловая единица, а у шва не задан диаметр. Задайте его в разделе
          «Детали и операции».
        </span>
      </div>
    )

  if (pass.speedRawMin === null && pass.speedRawMax === null) return <div className={`${box} text-muted`}>—</div>

  const fresh =
    saved !== undefined &&
    saved.speedUnitId === pass.speedUnitId &&
    saved.speedRawMin === pass.speedRawMin &&
    saved.speedRawMax === pass.speedRawMax
  if (!fresh) return <div className={`${box} text-xs text-muted`}>пересчитается при сохранении</div>

  return <div className={`${box} font-mono`}>{formatRange(saved.speedMin ?? null, saved.speedMax ?? null)}</div>
}
