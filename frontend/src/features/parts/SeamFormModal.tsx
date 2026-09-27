import { useMaterials } from '@/features/materials/queries'
import type { SeamWrite } from '@/shared/types/technology'
import { DecimalInput } from '@/shared/ui/DecimalInput'
import { Field, Input, Select } from '@/shared/ui/Form'
import { FormModal, type Editing, type Errors } from '@/shared/ui/FormModal'
import { useSaveSeam } from './queries'

// типы сварных соединений по ГОСТ 5264 / 14771
const JOINT_TYPES = ['Стыковое', 'Угловое', 'Тавровое', 'Нахлёсточное']

function validate(d: SeamWrite): Errors {
  const errors: Errors = {}
  if (!d.number.trim()) errors.number = 'Укажите номер шва'
  if (!d.material1Id) errors.material1Id = 'Укажите материал'
  if (!d.thickness1) errors.thickness1 = 'Укажите толщину'
  // без диаметра не пересчитать угловую скорость в техкартах этого шва
  if (d.seamType === 'кольцевой' && !d.seamDiameter) errors.seamDiameter = 'Для кольцевого шва нужен диаметр'
  return errors
}

export function SeamFormModal({ editing, onClose }: { editing: Editing<SeamWrite>; onClose: () => void }) {
  const save = useSaveSeam()
  const materials = useMaterials()

  return (
    <FormModal
      editing={editing}
      onClose={onClose}
      newTitle="Новый шов"
      editTitle="Шов по чертежу"
      save={save}
      validate={validate}
      prepare={(d) => ({
        ...d,
        number: d.number.trim(),
        pos1: d.pos1.trim(),
        pos2: d.pos2.trim(),
        // диаметр у прямого шва не нужен — не храним случайный
        seamDiameter: d.seamType === 'прямой' ? null : d.seamDiameter,
      })}
    >
      {({ draft, update, errors }) => {
        const materialSelect = (key: 'material1Id' | 'material2Id', id: string, describedBy?: string) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            invalid={Boolean(errors[key])}
            value={draft[key] ?? ''}
            disabled={materials.isPending}
            onChange={(e) => update({ [key]: e.target.value === '' ? null : Number(e.target.value) })}
          >
            <option value="">Не выбран</option>
            {materials.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.marka}
              </option>
            ))}
          </Select>
        )

        return (
          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="№ шва по чертежу" required error={errors.number}>
                {(id, describedBy) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    invalid={Boolean(errors.number)}
                    maxLength={50}
                    value={draft.number}
                    className="font-mono"
                    onChange={(e) => update({ number: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Тип соединения" error={errors.jointType}>
                {(id, describedBy) => (
                  <Select
                    id={id}
                    aria-describedby={describedBy}
                    value={draft.jointType}
                    onChange={(e) => update({ jointType: e.target.value })}
                  >
                    <option value="">Не указан</option>
                    {/* значение из старых данных, которого нет в списке, не теряем */}
                    {draft.jointType && !JOINT_TYPES.includes(draft.jointType) && (
                      <option value={draft.jointType}>{draft.jointType}</option>
                    )}
                    {JOINT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>

            {([1, 2] as const).map((n) => (
              <fieldset key={n} className="grid gap-3 rounded-tile border border-border p-3.5 sm:grid-cols-2">
                <legend className="px-1 text-caption font-semibold text-muted">Позиция {n}</legend>
                <Field label="Материал" required={n === 1} error={errors[`material${n}Id`]}>
                  {(id, describedBy) => materialSelect(`material${n}Id`, id, describedBy)}
                </Field>
                <Field label="Толщина, мм" required={n === 1} error={errors[`thickness${n}`]}>
                  {(id, describedBy) => (
                    <DecimalInput
                      id={id}
                      aria-describedby={describedBy}
                      invalid={Boolean(errors[`thickness${n}`])}
                      digits={7}
                      places={2}
                      value={draft[`thickness${n}`]}
                      onChange={(v) => update({ [`thickness${n}`]: v })}
                    />
                  )}
                </Field>
                <Field label="№ позиции по чертежу" error={errors[`pos${n}`]}>
                  {(id, describedBy) => (
                    <Input
                      id={id}
                      aria-describedby={describedBy}
                      maxLength={50}
                      value={draft[`pos${n}`]}
                      onChange={(e) => update({ [`pos${n}`]: e.target.value })}
                    />
                  )}
                </Field>
                <Field label="Масса, кг" error={errors[`mass${n}`]}>
                  {(id, describedBy) => (
                    <DecimalInput
                      id={id}
                      aria-describedby={describedBy}
                      invalid={Boolean(errors[`mass${n}`])}
                      digits={10}
                      places={3}
                      value={draft[`mass${n}`]}
                      onChange={(v) => update({ [`mass${n}`]: v })}
                    />
                  )}
                </Field>
              </fieldset>
            ))}

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Вид шва" error={errors.seamType}>
                {(id, describedBy) => (
                  <Select
                    id={id}
                    aria-describedby={describedBy}
                    value={draft.seamType}
                    onChange={(e) => update({ seamType: e.target.value })}
                  >
                    <option value="">Не указан</option>
                    <option value="прямой">Прямой</option>
                    <option value="кольцевой">Кольцевой</option>
                  </Select>
                )}
              </Field>
              <Field
                label="Диаметр шва, мм"
                required={draft.seamType === 'кольцевой'}
                error={errors.seamDiameter}
                hint={draft.seamType === 'кольцевой' ? 'Нужен для пересчёта об/мин в м/ч' : undefined}
              >
                {(id, describedBy) => (
                  <DecimalInput
                    id={id}
                    aria-describedby={describedBy}
                    invalid={Boolean(errors.seamDiameter)}
                    disabled={draft.seamType === 'прямой'}
                    digits={9}
                    places={2}
                    value={draft.seamType === 'прямой' ? null : draft.seamDiameter}
                    onChange={(v) => update({ seamDiameter: v })}
                  />
                )}
              </Field>
              <Field label="Длина шва, мм" error={errors.seamLength}>
                {(id, describedBy) => (
                  <DecimalInput
                    id={id}
                    aria-describedby={describedBy}
                    invalid={Boolean(errors.seamLength)}
                    digits={10}
                    places={1}
                    value={draft.seamLength}
                    onChange={(v) => update({ seamLength: v })}
                  />
                )}
              </Field>
            </div>
          </div>
        )
      }}
    </FormModal>
  )
}
