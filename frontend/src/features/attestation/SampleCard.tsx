import { Trash2 } from 'lucide-react'
import type { AttestationItem } from '@/shared/types/attestation'
import type { FillerMaterial, GasFlux, Material } from '@/shared/types/materials'
import { formatNumber } from '@/shared/lib/format'
import { IconButton } from '@/shared/ui/Button'
import { DecimalInput } from '@/shared/ui/DecimalInput'
import { Checkbox, Field, Input, Select } from '@/shared/ui/Form'

export interface SampleLookups {
  materials: Material[]
  fillers: FillerMaterial[]
  gases: GasFlux[]
  fluxes: GasFlux[]
}

interface Props {
  item: AttestationItem
  index: number
  /** Черновик: правится всё; иначе — только результаты испытаний */
  draft: boolean
  lookups: SampleLookups
  errors: Record<string, string>
  canDelete: boolean
  onChange: (next: AttestationItem) => void
  onDelete: () => void
}

/**
 * Сетка полей, где поля ввода стоят на одной линии, даже если подпись
 * соседа перенеслась на вторую строку: каждое поле делит строки сетки
 * с соседями (subgrid) — подпись, поле, сообщение.
 */
export const ALIGNED_GRID =
  'grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:row-span-3 [&>*]:grid-rows-subgrid'

const idOrNull = (v: string) => (v === '' ? null : Number(v))

function range(min: string | null, max: string | null): string {
  if (min === null && max === null) return '—'
  if (min === max || max === null) return formatNumber(min)
  if (min === null) return `до ${formatNumber(max)}`
  return `${formatNumber(min)}–${formatNumber(max)}`
}

export function SampleCard({ item, index, draft, lookups, errors, canDelete, onChange, onDelete }: Props) {
  const set = (patch: Partial<AttestationItem>) => onChange({ ...item, ...patch })
  const rangeError =
    item.thicknessMin !== null && item.thicknessMax !== null && Number(item.thicknessMin) > Number(item.thicknessMax)
      ? '«От» больше «до»'
      : errors.thicknessMax

  return (
    <article className="grid gap-4 rounded-tile border border-border bg-surface p-4">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          Образец {item.sampleNo ? `№ ${item.sampleNo}` : index + 1}
        </h3>
        {draft && (
          <IconButton
            label={canDelete ? 'Удалить образец' : 'Нужен хотя бы один образец'}
            disabled={!canDelete}
            onClick={onDelete}
            // опасное действие — серое, красное только под курсором
            className="text-muted hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-muted"
          >
            <Trash2 />
          </IconButton>
        )}
      </header>

      {draft ? (
        <div className={ALIGNED_GRID}>
          <Field label="№ образца" required error={errors.sampleNo}>
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                invalid={Boolean(errors.sampleNo)}
                maxLength={50}
                value={item.sampleNo}
                className="font-mono"
                onChange={(e) => set({ sampleNo: e.target.value })}
              />
            )}
          </Field>
          <Field label="Материал 1" required error={errors.material1}>
            {(id, d) => (
              <Select
                id={id}
                aria-describedby={d}
                invalid={Boolean(errors.material1)}
                value={item.material1 ?? ''}
                onChange={(e) => set({ material1: idOrNull(e.target.value) })}
              >
                <option value="">Не выбран</option>
                {lookups.materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.marka}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Материал 2" error={errors.material2}>
            {(id, d) => (
              <Select
                id={id}
                aria-describedby={d}
                value={item.uniform ? '' : (item.material2 ?? '')}
                disabled={item.uniform}
                onChange={(e) => set({ material2: idOrNull(e.target.value) })}
              >
                <option value="">{item.uniform ? 'Однородное' : 'Не выбран'}</option>
                {lookups.materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.marka}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {/* не поле с подписью: ставим в строку полей ввода, по центру */}
          <div className="grid [&>*]:row-start-2 [&>*]:self-center">
            <Checkbox
              label="Однородное"
              description="одна марка"
              checked={item.uniform}
              onChange={(e) => set({ uniform: e.target.checked, material2: e.target.checked ? null : item.material2 })}
            />
          </div>

          <Field label="Толщина, мм" error={rangeError}>
            {(id, d) => (
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
                <DecimalInput
                  id={id}
                  aria-label="Толщина от"
                  aria-describedby={d}
                  placeholder="от"
                  invalid={Boolean(rangeError)}
                  digits={5}
                  places={1}
                  value={item.thicknessMin}
                  onChange={(v) => set({ thicknessMin: v })}
                />
                <span aria-hidden className="text-muted">
                  –
                </span>
                <DecimalInput
                  aria-label="Толщина до"
                  aria-describedby={d}
                  placeholder="до"
                  invalid={Boolean(rangeError)}
                  digits={5}
                  places={1}
                  value={item.thicknessMax}
                  onChange={(v) => set({ thicknessMax: v })}
                />
              </div>
            )}
          </Field>
          <Field label="Электрод / проволока" error={errors.wireId}>
            {(id, d) => (
              <Select id={id} aria-describedby={d} value={item.wireId ?? ''} onChange={(e) => set({ wireId: idOrNull(e.target.value) })}>
                <option value="">Не выбран</option>
                {lookups.fillers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Защитный газ" error={errors.gasId}>
            {(id, d) => (
              <Select id={id} aria-describedby={d} value={item.gasId ?? ''} onChange={(e) => set({ gasId: idOrNull(e.target.value) })}>
                <option value="">Не выбран</option>
                {lookups.gases.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.value}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Флюс" error={errors.fluxId}>
            {(id, d) => (
              <Select id={id} aria-describedby={d} value={item.fluxId ?? ''} onChange={(e) => set({ fluxId: idOrNull(e.target.value) })}>
                <option value="">Не выбран</option>
                {lookups.fluxes.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.value}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {(
            [
              ['position', 'Положение'],
              ['preheat', 'Подогрев'],
              ['heatTreatment', 'Термообработка'],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label} error={errors[key]}>
              {(id, d) => (
                <Input id={id} aria-describedby={d} maxLength={50} value={item[key]} onChange={(e) => set({ [key]: e.target.value })} />
              )}
            </Field>
          ))}
        </div>
      ) : (
        <>
          {/* что варили — уже не меняется, только для справки */}
          <dl className="grid gap-x-4 gap-y-1 rounded-control bg-surface-2/60 px-3 py-2.5 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted">Материалы</dt>
              <dd>
                {item.material1Marka}
                {item.uniform ? ' (однородное)' : item.material2Marka ? ` + ${item.material2Marka}` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Толщина, мм</dt>
              <dd className="font-mono">{range(item.thicknessMin, item.thicknessMax)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Проволока</dt>
              <dd>{item.wireText || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Газ / флюс</dt>
              <dd>{[item.gasText, item.fluxText].filter(Boolean).join(' / ') || '—'}</dd>
            </div>
          </dl>
          <Requirements snapshot={item.requirementsSnapshot} />
        </>
      )}

      {!draft && (
        <div className={ALIGNED_GRID}>
          {(
            [
              ['vikResult', 'ВИК'],
              ['physicalProtocol', 'РК / УЗК, № протокола'],
              ['metallographyProtocol', 'Металлография, № протокола'],
              ['impactStrength', 'Ударная вязкость'],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label} error={errors[key]}>
              {(id, d) => (
                <Input id={id} aria-describedby={d} maxLength={100} value={item[key]} onChange={(e) => set({ [key]: e.target.value })} />
              )}
            </Field>
          ))}
          <Field label="Предел прочности, кгс/мм²" error={errors.tensileStrength}>
            {(id, d) => (
              <DecimalInput id={id} aria-describedby={d} digits={6} places={1} value={item.tensileStrength} onChange={(v) => set({ tensileStrength: v })} />
            )}
          </Field>
          <Field label="Угол загиба, °" error={errors.bendAngle}>
            {(id, d) => (
              <DecimalInput id={id} aria-describedby={d} digits={5} places={1} value={item.bendAngle} onChange={(v) => set({ bendAngle: v })} />
            )}
          </Field>
          <Field label="Другие методы" error={errors.otherMethods} className="sm:col-span-2">
            {(id, d) => (
              <Input id={id} aria-describedby={d} maxLength={200} value={item.otherMethods} onChange={(e) => set({ otherMethods: e.target.value })} />
            )}
          </Field>
        </div>
      )}
    </article>
  )
}

/** Требования правила, зафиксированные при отправке на испытания */
function Requirements({ snapshot }: { snapshot: Record<string, unknown> | undefined }) {
  const entries = Object.entries(snapshot ?? {})
  if (entries.length === 0)
    return <p className="text-xs text-muted">Требования не зафиксированы: в библиотеке не нашлось правила под этот образец.</p>
  return (
    <p className="text-xs text-muted">
      <span className="font-semibold">Требования правила: </span>
      {entries.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ')}
    </p>
  )
}
