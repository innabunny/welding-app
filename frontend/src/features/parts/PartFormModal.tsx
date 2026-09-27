import type { PartWrite } from '@/shared/types/technology'
import { Checkbox, Field, Input } from '@/shared/ui/Form'
import { FormModal, type Editing, type Errors } from '@/shared/ui/FormModal'
import { AutoTextarea } from '@/shared/ui/Textarea'
import { useSavePart } from './queries'

interface Props {
  editing: Editing<PartWrite>
  onClose: () => void
  /** После создания — перейти в карточку новой детали */
  onCreated?: (id: number) => void
}

export function PartFormModal({ editing, onClose, onCreated }: Props) {
  const save = useSavePart()

  return (
    <FormModal
      editing={editing}
      onClose={onClose}
      newTitle="Новая деталь"
      editTitle="Деталь"
      save={save}
      onSaved={(part, id) => {
        if (id === null) onCreated?.(part.id)
      }}
      validate={(d): Errors => ({
        ...(d.number.trim() ? {} : { number: 'Укажите номер по чертежу' }),
        ...(d.name.trim() ? {} : { name: 'Укажите наименование' }),
      })}
      prepare={(d) => ({
        ...d,
        number: d.number.trim(),
        name: d.name.trim(),
        note: d.note.trim(),
      })}
    >
      {({ draft, update, errors }) => (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Field label="№ по чертежу" required error={errors.number}>
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={Boolean(errors.number)}
                maxLength={100}
                value={draft.number}
                placeholder="Например, 14.301"
                className="font-mono"
                onChange={(e) => update({ number: e.target.value })}
              />
            )}
          </Field>
          <Field label="Наименование" required error={errors.name}>
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={Boolean(errors.name)}
                maxLength={200}
                value={draft.name}
                placeholder="Например, Корпус камеры"
                onChange={(e) => update({ name: e.target.value })}
              />
            )}
          </Field>
          <Field label="Примечание" error={errors.note} className="sm:col-span-2">
            {(id, describedBy) => (
              <AutoTextarea
                id={id}
                aria-describedby={describedBy}
                value={draft.note}
                onChange={(e) => update({ note: e.target.value })}
              />
            )}
          </Field>
          <Checkbox
            label="В производстве"
            description="Снятые с производства детали скрываются фильтром, но не удаляются"
            checked={draft.isActive}
            onChange={(e) => update({ isActive: e.target.checked })}
            className="sm:col-span-2"
          />
        </div>
      )}
    </FormModal>
  )
}
