import type { OperationWrite, SeamSpec } from '@/shared/types/technology'
import { cn } from '@/shared/lib/cn'
import { DecimalInput } from '@/shared/ui/DecimalInput'
import { Field, Input, Select } from '@/shared/ui/Form'
import { FormModal, type Editing, type Errors } from '@/shared/ui/FormModal'
import { useSaveOperation } from './queries'

/** Методы контроля — как Inspection.Method на бэке */
const CONTROLS: { code: string; title: string }[] = [
  { code: 'ВИК', title: 'Визуально-измерительный' },
  { code: 'РК', title: 'Радиографический' },
  { code: 'УЗК', title: 'Ультразвуковой' },
  { code: 'ПВК', title: 'Капиллярный' },
  { code: 'МК', title: 'Металлографический' },
]

interface Props {
  editing: Editing<OperationWrite>
  seams: SeamSpec[]
  onClose: () => void
}

export function OperationFormModal({ editing, seams, onClose }: Props) {
  const save = useSaveOperation()

  return (
    <FormModal
      editing={editing}
      onClose={onClose}
      newTitle="Новая операция"
      editTitle="Операция"
      save={save}
      validate={(d): Errors => ({
        ...(d.number.trim() ? {} : { number: 'Укажите номер операции' }),
        ...(d.seamId === null ? { seamId: 'Выберите шов, который варится в операции' } : {}),
      })}
      prepare={(d) => ({ ...d, number: d.number.trim(), name: d.name.trim() })}
    >
      {({ draft, update, errors }) => (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
          <Field label="№ операции" required error={errors.number}>
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={Boolean(errors.number)}
                maxLength={20}
                value={draft.number}
                placeholder="010"
                className="font-mono"
                onChange={(e) => update({ number: e.target.value })}
              />
            )}
          </Field>
          <Field label="Наименование" error={errors.name}>
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                maxLength={200}
                value={draft.name}
                placeholder="Например, сварка корня"
                onChange={(e) => update({ name: e.target.value })}
              />
            )}
          </Field>
          <Field label="Порядок" error={errors.order} hint="По нему идёт техпроцесс">
            {(id, describedBy) => (
              <DecimalInput
                id={id}
                aria-describedby={describedBy}
                digits={5}
                places={0}
                value={String(draft.order)}
                onChange={(v) => update({ order: v === null ? 0 : Number(v) })}
              />
            )}
          </Field>
          <Field label="Шов" required error={errors.seamId} className="sm:col-span-3">
            {(id, describedBy) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                invalid={Boolean(errors.seamId)}
                value={draft.seamId ?? ''}
                onChange={(e) => update({ seamId: e.target.value === '' ? null : Number(e.target.value) })}
              >
                <option value="">Не выбран</option>
                {seams.map((s) => (
                  <option key={s.id} value={s.id}>
                    шов {s.number}
                    {s.material1Marka ? ` · ${s.material1Marka}` : ''}
                    {s.thickness1 ? ` · ${Number(s.thickness1).toLocaleString('ru-RU')} мм` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <fieldset className="grid gap-1.5 sm:col-span-3">
            <legend className="mb-1.5 text-caption font-semibold text-muted">Контроль после операции</legend>
            <div className="flex flex-wrap gap-2">
              {CONTROLS.map(({ code, title }) => {
                const on = draft.requiredControls.includes(code)
                return (
                  <label
                    key={code}
                    title={title}
                    className={cn(
                      'flex h-9 cursor-pointer items-center gap-2 rounded-control border px-3 text-sm transition-colors',
                      'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
                      on ? 'border-primary bg-primary-soft text-primary' : 'border-border hover:border-primary/50',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) =>
                        update({
                          requiredControls: e.target.checked
                            ? CONTROLS.map((c) => c.code).filter((c) => c === code || draft.requiredControls.includes(c))
                            : draft.requiredControls.filter((c) => c !== code),
                        })
                      }
                      className="sr-only"
                    />
                    <span className="font-mono font-semibold">{code}</span>
                    <span className="text-xs text-muted">{title}</span>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-muted">Не отмечено ничего — после операции контроль не назначен.</p>
          </fieldset>
        </div>
      )}
    </FormModal>
  )
}
