import type { WelderWrite } from '@/shared/types/attestation'
import { Checkbox, Field, Input, Select } from '@/shared/ui/Form'
import { FormModal, type Editing, type Errors } from '@/shared/ui/FormModal'
import { useSaveWelder, useWorkshops } from './queries'

export function WelderFormModal({ editing, onClose }: { editing: Editing<WelderWrite>; onClose: () => void }) {
  const save = useSaveWelder()
  const workshops = useWorkshops()

  return (
    <FormModal
      editing={editing}
      onClose={onClose}
      newTitle="Новый сварщик"
      editTitle="Сварщик"
      save={save}
      validate={(d): Errors => ({
        ...(d.fio.trim() ? {} : { fio: 'Укажите ФИО' }),
        ...(d.education.trim() ? {} : { education: 'Укажите образование' }),
        // UID карты — hex, как его читает считыватель
        ...(d.rfidUid && !/^[0-9a-fA-F]{1,16}$/.test(d.rfidUid.trim())
          ? { rfidUid: 'Только цифры 0–9 и буквы A–F, до 16 знаков' }
          : {}),
      })}
      prepare={(d) => ({
        ...d,
        fio: d.fio.trim(),
        personnelNo: d.personnelNo.trim(),
        education: d.education.trim(),
        rank: d.rank.trim(),
        rfidUid: d.rfidUid?.trim() || null,
      })}
    >
      {({ draft, update, errors }) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ФИО" required error={errors.fio} className="sm:col-span-2">
            {(id, d) => (
              <Input id={id} aria-describedby={d} invalid={Boolean(errors.fio)} maxLength={200} value={draft.fio} placeholder="Иванов Иван Иванович" onChange={(e) => update({ fio: e.target.value })} />
            )}
          </Field>
          <Field label="Табельный номер" error={errors.personnelNo}>
            {(id, d) => (
              <Input id={id} aria-describedby={d} maxLength={20} className="font-mono" value={draft.personnelNo} onChange={(e) => update({ personnelNo: e.target.value })} />
            )}
          </Field>
          <Field label="Цех" error={errors.workshopId}>
            {(id, d) => (
              <Select
                id={id}
                aria-describedby={d}
                value={draft.workshopId ?? ''}
                onChange={(e) => update({ workshopId: e.target.value === '' ? null : Number(e.target.value) })}
              >
                <option value="">Не указан</option>
                {workshops.data?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.number ? `${w.number} — ${w.name}` : w.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Образование" required error={errors.education}>
            {(id, d) => (
              <Input id={id} aria-describedby={d} invalid={Boolean(errors.education)} maxLength={200} value={draft.education} placeholder="Например, среднее профессиональное" onChange={(e) => update({ education: e.target.value })} />
            )}
          </Field>
          <Field label="Разряд" error={errors.rank}>
            {(id, d) => (
              <Input id={id} aria-describedby={d} maxLength={20} value={draft.rank} placeholder="5" onChange={(e) => update({ rank: e.target.value })} />
            )}
          </Field>
          <Field label="Дата рождения" error={errors.birthDate}>
            {(id, d) => (
              <Input id={id} aria-describedby={d} type="date" value={draft.birthDate ?? ''} onChange={(e) => update({ birthDate: e.target.value || null })} />
            )}
          </Field>
          <Field label="Стаж по сварке с" error={errors.weldingSince}>
            {(id, d) => (
              <Input id={id} aria-describedby={d} type="date" value={draft.weldingSince ?? ''} onChange={(e) => update({ weldingSince: e.target.value || null })} />
            )}
          </Field>
          <Field label="UID карты (hex)" error={errors.rfidUid} hint="Для допуска к установке по RFID">
            {(id, d) => (
              <Input id={id} aria-describedby={d} invalid={Boolean(errors.rfidUid)} maxLength={16} className="font-mono" value={draft.rfidUid ?? ''} onChange={(e) => update({ rfidUid: e.target.value })} />
            )}
          </Field>
          <div className="flex items-center">
            <Checkbox label="Работает" checked={draft.isActive} onChange={(e) => update({ isActive: e.target.checked })} />
          </div>
        </div>
      )}
    </FormModal>
  )
}
