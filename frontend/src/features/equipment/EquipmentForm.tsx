import { AlertTriangle } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { errorMessage, fieldErrors } from '@/shared/api/errors'
import type {
  Equipment,
  EquipmentParameter,
  EquipmentParameterLevel,
  EquipmentWrite,
} from '@/shared/types/equipment'
import { Button } from '@/shared/ui/Button'
import { Checkbox, Field, Input, Select } from '@/shared/ui/Form'
import { Modal } from '@/shared/ui/Modal'
import { ErrorState, SkeletonRows } from '@/shared/ui/States'
import {
  useEquipment,
  useEquipmentParameters,
  useSaveEquipment,
  useSpeedUnits,
  useWeldingMethods,
  useWorkstations,
} from './queries'
import { useEquipmentUi } from './store'

const emptyDraft: EquipmentWrite = {
  name: '',
  methodId: '',
  workstationId: null,
  nodeId: null,
  nodeIp: null,
  speedUnits: [],
  parameters: [],
  hasPulse: false,
  isActive: true,
}

function toWrite(e: Equipment): EquipmentWrite {
  return {
    name: e.name,
    methodId: e.methodId,
    workstationId: e.workstationId,
    nodeId: e.nodeId,
    nodeIp: e.nodeIp,
    speedUnits: [...e.speedUnits],
    parameters: [...e.parameters],
    hasPulse: e.hasPulse,
    isActive: e.isActive,
  }
}

const levelLabels: Record<EquipmentParameterLevel, string> = {
  card: 'На всю карту',
  pass: 'На каждый проход',
}

function toggle(ids: number[], id: number, on: boolean): number[] {
  return on ? [...ids, id] : ids.filter((x) => x !== id)
}

/** Пустую строку шлём как null: у nodeId unique, две пустые строки база сочтёт повтором */
const orNull = (value: string) => (value.trim() === '' ? null : value.trim())

interface FormProps {
  id: number | null
  initial: EquipmentWrite
  formId: string
  onSaved: () => void
  onPendingChange: (pending: boolean) => void
}

function EquipmentFormBody({ id, initial, formId, onSaved, onPendingChange }: FormProps) {
  const [draft, setDraft] = useState<EquipmentWrite>(initial)
  const [confirmNoUnits, setConfirmNoUnits] = useState(false)
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})
  const setNewDraft = useEquipmentUi((s) => s.setNewDraft)

  const methods = useWeldingMethods()
  const workstations = useWorkstations()
  const speedUnits = useSpeedUnits()
  const parameters = useEquipmentParameters()
  const save = useSaveEquipment()

  useEffect(() => onPendingChange(save.isPending), [save.isPending, onPendingChange])

  const update = (patch: Partial<EquipmentWrite>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    // ошибка поля устаревает, как только его поправили
    setLocalErrors((prev) => {
      const rest = { ...prev }
      for (const key of Object.keys(patch)) delete rest[key]
      return rest
    })
    if (id === null) setNewDraft(next)
  }

  const serverErrors = fieldErrors(save.error)
  const errors = { ...serverErrors, ...localErrors }
  const noUnits = draft.speedUnits.length === 0

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const found: Record<string, string> = {}
    if (!draft.name.trim()) found.name = 'Укажите название'
    if (!draft.methodId) found.methodId = 'Выберите способ сварки'
    const chosen = (speedUnits.data ?? []).filter((u) => draft.speedUnits.includes(u.id))
    if (chosen.length > 0 && chosen.every((u) => u.isAngular))
      found.speedUnits = 'Заданы только угловые единицы. Для прямых швов нужна линейная'
    if (noUnits && !confirmNoUnits) found.speedUnits = 'Подтвердите сохранение без единиц скорости'
    setLocalErrors(found)
    if (Object.keys(found).length > 0) return

    const body: EquipmentWrite = {
      ...draft,
      name: draft.name.trim(),
      nodeId: orNull(draft.nodeId ?? ''),
      nodeIp: orNull(draft.nodeIp ?? ''),
    }
    save.mutate(
      { id, body },
      {
        onSuccess: () => {
          if (id === null) setNewDraft(null)
          onSaved()
        },
      },
    )
  }

  const paramsByLevel = (level: EquipmentParameterLevel): EquipmentParameter[] =>
    (parameters.data ?? []).filter((p) => p.level === level)

  return (
    <form id={formId} onSubmit={submit} noValidate className="grid gap-5">
      {save.isError && (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {errorMessage(save.error)}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Название" required error={errors.name} className="md:col-span-2">
          {(fid, described) => (
            <Input
              id={fid}
              aria-describedby={described}
              invalid={Boolean(errors.name)}
              value={draft.name}
              placeholder="Например, Tetrix 351"
              onChange={(e) => update({ name: e.target.value })}
            />
          )}
        </Field>

        <Field label="Способ сварки" required error={errors.methodId}>
          {(fid, described) => (
            <Select
              id={fid}
              aria-describedby={described}
              invalid={Boolean(errors.methodId)}
              value={draft.methodId}
              disabled={methods.isPending}
              onChange={(e) => update({ methodId: e.target.value })}
            >
              <option value="">{methods.isPending ? 'Загрузка…' : 'Не выбран'}</option>
              {methods.data?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.designation ? `${m.designation} — ${m.name}` : m.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label="Рабочее место"
          error={errors.workstationId}
          hint={workstations.data?.length === 0 ? 'Посты не заведены — добавьте их в админке' : undefined}
        >
          {(fid, described) => (
            <Select
              id={fid}
              aria-describedby={described}
              invalid={Boolean(errors.workstationId)}
              value={draft.workstationId ?? ''}
              disabled={workstations.isPending}
              onChange={(e) =>
                update({ workstationId: e.target.value === '' ? null : Number(e.target.value) })
              }
            >
              <option value="">Не привязана</option>
              {workstations.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {[w.workshopName, w.sectionName, `пост ${w.number}`].filter(Boolean).join(' · ')}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Узел телеметрии" hint="MAC или серийный номер платы" error={errors.nodeId}>
          {(fid, described) => (
            <Input
              id={fid}
              aria-describedby={described}
              invalid={Boolean(errors.nodeId)}
              value={draft.nodeId ?? ''}
              className="font-mono"
              onChange={(e) => update({ nodeId: e.target.value })}
            />
          )}
        </Field>

        <Field label="IP узла" error={errors.nodeIp}>
          {(fid, described) => (
            <Input
              id={fid}
              aria-describedby={described}
              invalid={Boolean(errors.nodeIp)}
              value={draft.nodeIp ?? ''}
              inputMode="decimal"
              placeholder="192.168.0.10"
              className="font-mono"
              onChange={(e) => update({ nodeIp: e.target.value })}
            />
          )}
        </Field>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-caption font-semibold text-muted">Рабочие единицы скорости</legend>
        {speedUnits.isPending && <SkeletonRows rows={2} />}
        {speedUnits.data?.length === 0 && (
          <p className="text-xs text-muted">Справочник пуст — единицы заводит администратор в админке.</p>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {speedUnits.data?.map((u) => (
            <Checkbox
              key={u.id}
              label={u.name}
              description={u.isAngular ? 'угловая' : undefined}
              checked={draft.speedUnits.includes(u.id)}
              onChange={(e) => update({ speedUnits: toggle(draft.speedUnits, u.id, e.target.checked) })}
            />
          ))}
        </div>
        {noUnits && speedUnits.data && speedUnits.data.length > 0 && (
          <div className="mt-1 grid gap-2 rounded-control bg-warning-soft px-3 py-2.5 text-sm text-warning">
            <p className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Без единиц скорости пересчёт скорости в техкартах этой установки перестанет работать.
            </p>
            <Checkbox
              label="Понимаю, сохранить без единиц скорости"
              checked={confirmNoUnits}
              onChange={(e) => setConfirmNoUnits(e.target.checked)}
            />
          </div>
        )}
        {errors.speedUnits && <p className="text-xs text-danger">{errors.speedUnits}</p>}
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-caption font-semibold text-muted">Дополнительные параметры</legend>
        {parameters.isPending && <SkeletonRows rows={2} />}
        {parameters.data?.length === 0 && <p className="text-xs text-muted">Справочник параметров пуст.</p>}
        {(['card', 'pass'] as const).map((level) => {
          const items = paramsByLevel(level)
          if (items.length === 0) return null
          return (
            <div key={level}>
              <p className="mb-1.5 text-xs text-muted">{levelLabels[level]}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((p) => (
                  <Checkbox
                    key={p.id}
                    label={p.unit ? `${p.name}, ${p.unit}` : p.name}
                    checked={draft.parameters.includes(p.id)}
                    onChange={(e) =>
                      update({ parameters: toggle(draft.parameters, p.id, e.target.checked) })
                    }
                  />
                ))}
              </div>
            </div>
          )
        })}
        {errors.parameters && <p className="text-xs text-danger">{errors.parameters}</p>}
      </fieldset>

      <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4">
        <Checkbox
          label="Импульсный режим"
          checked={draft.hasPulse}
          onChange={(e) => update({ hasPulse: e.target.checked })}
        />
        <Checkbox
          label="В работе"
          checked={draft.isActive}
          onChange={(e) => update({ isActive: e.target.checked })}
        />
      </div>
    </form>
  )
}

interface ModalProps {
  /** undefined — закрыто, null — новая установка, число — правка */
  editingId: number | null | undefined
  onClose: () => void
}

export function EquipmentFormModal({ editingId, onClose }: ModalProps) {
  const formId = useId()
  const [pending, setPending] = useState(false)
  const [resetCount, setResetCount] = useState(0)
  const { newDraft, setNewDraft } = useEquipmentUi()
  const isEdit = typeof editingId === 'number'
  const detail = useEquipment(isEdit ? editingId : null)

  const clearDraft = () => {
    setNewDraft(null)
    setResetCount((n) => n + 1)
  }

  let body
  if (editingId === undefined) body = null
  else if (editingId === null)
    body = (
      <EquipmentFormBody
        key={resetCount}
        id={null}
        initial={newDraft ?? emptyDraft}
        formId={formId}
        onSaved={onClose}
        onPendingChange={setPending}
      />
    )
  else if (detail.isPending) body = <SkeletonRows rows={6} />
  else if (detail.isError) body = <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
  else
    body = (
      <EquipmentFormBody
        key={detail.data.id}
        id={detail.data.id}
        initial={toWrite(detail.data)}
        formId={formId}
        onSaved={onClose}
        onPendingChange={setPending}
      />
    )

  const ready = editingId === null || (isEdit && detail.isSuccess)

  return (
    <Modal
      open={editingId !== undefined}
      title={isEdit ? 'Установка' : 'Новая установка'}
      onClose={onClose}
      footer={
        <>
          {editingId === null && newDraft && (
            <Button variant="ghost" onClick={clearDraft} className="mr-auto">
              Очистить черновик
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            {editingId === null ? 'Закрыть' : 'Отмена'}
          </Button>
          <Button type="submit" form={formId} disabled={!ready || pending}>
            {pending ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </>
      }
    >
      {body}
    </Modal>
  )
}
