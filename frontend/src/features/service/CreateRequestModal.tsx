import { ClipboardList, SendHorizontal } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useEquipmentList } from '@/features/equipment/queries'
import { errorMessage, fieldErrors } from '@/shared/api/errors'
import { cn } from '@/shared/lib/cn'
import { toast } from '@/shared/lib/toast'
import type { ServicePriority, ServiceReason } from '@/shared/types/service'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'
import { AutoTextarea } from '@/shared/ui/Textarea'
import { EquipmentPicker } from './EquipmentPicker'
import { priorities, reasons } from './labels'
import { useCreateServiceRequest } from './queries'

const MAX_DESCRIPTION = 500

interface Draft {
  equipmentId: number | null
  reason: ServiceReason | null
  priority: ServicePriority
  description: string
}

const emptyDraft: Draft = { equipmentId: null, reason: null, priority: 'средняя', description: '' }

// выбранная кнопка залита, остальные — контур того же цвета
const priorityStyles: Record<ServicePriority, { on: string; off: string }> = {
  низкая: {
    on: 'border-muted bg-muted text-surface',
    off: 'border-border text-muted hover:border-muted',
  },
  средняя: {
    on: 'border-warning bg-warning text-surface',
    off: 'border-warning/40 text-warning hover:border-warning',
  },
  высокая: {
    on: 'border-danger bg-danger text-surface',
    off: 'border-danger/40 text-danger hover:border-danger',
  },
}

interface Props {
  open: boolean
  onClose: () => void
}

export function CreateRequestModal({ open, onClose }: Props) {
  // одна мутация на форму и кнопку: кнопка видит, что заявка уже уходит
  const create = useCreateServiceRequest()
  const close = () => {
    create.reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      title="Новая заявка"
      accent={{ icon: <ClipboardList />, subtitle: 'Механик увидит её сразу и возьмёт в работу' }}
      onClose={close}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Отмена
          </Button>
          <Button type="submit" form={FORM_ID} disabled={create.isPending}>
            {create.isPending ? 'Отправляем…' : 'Отправить заявку'}
            <SendHorizontal aria-hidden />
          </Button>
        </>
      }
    >
      {/* форма монтируется при каждом открытии — черновик начинается с чистого */}
      {open && <CreateForm create={create} onDone={close} />}
    </Modal>
  )
}

const FORM_ID = 'create-service-request'

function CreateForm({ create, onDone }: { create: ReturnType<typeof useCreateServiceRequest>; onDone: () => void }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})
  const equipment = useEquipmentList({})
  const ids = { equipment: useId(), reason: useId(), priority: useId(), description: useId() }

  const errors = { ...fieldErrors(create.error), ...localErrors }
  const update = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setLocalErrors((prev) => {
      const next = { ...prev }
      if ('equipmentId' in patch) delete next.equipmentId
      if ('reason' in patch) delete next.reason
      return next
    })
  }

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const found: Record<string, string> = {}
    if (draft.equipmentId === null) found.equipmentId = 'Выберите установку'
    if (draft.reason === null) found.reason = 'Выберите причину'
    setLocalErrors(found)
    if (draft.equipmentId === null || draft.reason === null) return

    const name = equipment.data?.find((x) => x.id === draft.equipmentId)?.name
    create.mutate(
      {
        equipmentId: draft.equipmentId,
        reason: draft.reason,
        priority: draft.priority,
        description: draft.description.trim(),
      },
      {
        onSuccess: () => {
          toast(name ? `Заявка по «${name}» отправлена` : 'Заявка отправлена')
          onDone()
        },
      },
    )
  }

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-5">
      {create.isError && (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {errorMessage(create.error)}
        </p>
      )}

      <div className="grid gap-1.5">
        <label htmlFor={ids.equipment} className="text-caption font-semibold text-muted">
          Оборудование <span className="text-danger">*</span>
        </label>
        <EquipmentPicker
          id={ids.equipment}
          items={equipment.data ?? []}
          loading={equipment.isPending}
          value={draft.equipmentId}
          onChange={(equipmentId) => update({ equipmentId })}
          invalid={Boolean(errors.equipmentId)}
          describedBy={errors.equipmentId ? `${ids.equipment}-error` : undefined}
        />
        {errors.equipmentId && (
          <p id={`${ids.equipment}-error`} className="text-xs text-danger">
            {errors.equipmentId}
          </p>
        )}
      </div>

      <fieldset className="grid gap-1.5" aria-describedby={errors.reason ? `${ids.reason}-error` : undefined}>
        <legend className="mb-1.5 text-caption font-semibold text-muted">
          Причина обращения <span className="text-danger">*</span>
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {reasons.map(({ value, label, hint, icon: Icon }) => {
            const selected = draft.reason === value
            return (
              <label
                key={value}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-1.5 rounded-tile border px-2 py-3 text-center transition-colors',
                  'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary',
                  selected
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-border text-text hover:border-primary/50 hover:bg-surface-2',
                )}
              >
                <input
                  type="radio"
                  name="reason"
                  value={value}
                  checked={selected}
                  onChange={() => update({ reason: value })}
                  className="sr-only"
                />
                <Icon className={cn('size-5', selected ? 'text-primary' : 'text-muted')} aria-hidden />
                <span className="text-sm font-semibold">{label}</span>
                <span className={cn('text-xs', selected ? 'text-primary/80' : 'text-muted')}>{hint}</span>
              </label>
            )
          })}
        </div>
        {errors.reason && (
          <p id={`${ids.reason}-error`} className="text-xs text-danger">
            {errors.reason}
          </p>
        )}
      </fieldset>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-caption font-semibold text-muted">Срочность</legend>
        <div className="grid grid-cols-3 gap-2">
          {priorities.map(({ value, label }) => {
            const selected = draft.priority === value
            return (
              <label
                key={value}
                className={cn(
                  'flex h-9 cursor-pointer items-center justify-center rounded-control border text-sm font-semibold transition-colors',
                  'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
                  selected ? priorityStyles[value].on : priorityStyles[value].off,
                )}
              >
                <input
                  type="radio"
                  name="priority"
                  value={value}
                  checked={selected}
                  onChange={() => update({ priority: value })}
                  className="sr-only"
                />
                {label}
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="grid gap-1.5">
        <label htmlFor={ids.description} className="text-caption font-semibold text-muted">
          Описание
        </label>
        <AutoTextarea
          id={ids.description}
          value={draft.description}
          maxLength={MAX_DESCRIPTION}
          counter
          placeholder="Что происходит и когда заметили: например, «с утра дуга нестабильна, на табло ошибка E-07»"
          onChange={(e) => update({ description: e.target.value })}
          invalid={Boolean(errors.description)}
        />
        {errors.description && <p className="text-xs text-danger">{errors.description}</p>}
      </div>
    </form>
  )
}
