import { CheckCircle2, CircleSlash, Wrench } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { errorMessage, fieldErrors } from '@/shared/api/errors'
import { cn } from '@/shared/lib/cn'
import { formatWhen } from '@/shared/lib/format'
import { toast } from '@/shared/lib/toast'
import type { ServiceRequest } from '@/shared/types/service'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'
import { AutoTextarea } from '@/shared/ui/Textarea'
import { priorityMeta, reasonMeta } from './labels'
import { usePatchServiceRequest } from './queries'

export type Outcome = 'done' | 'rejected'

const MAX_RESOLUTION = 1000
const FORM_ID = 'close-service-request'

interface Props {
  /** null — модалка закрыта */
  request: ServiceRequest | null
  /** С каким исходом открыли: «Закрыть» — выполнена, «Отклонить» — отклонена */
  initialOutcome: Outcome
  onClose: () => void
}

export function CloseRequestModal({ request, initialOutcome, onClose }: Props) {
  const patch = usePatchServiceRequest()
  const close = () => {
    patch.reset()
    onClose()
  }

  return (
    <Modal
      open={request !== null}
      title="Закрыть заявку"
      accent={{
        icon: <Wrench />,
        subtitle: request ? `${request.equipmentName} · подана ${formatWhen(request.createdAt)}` : undefined,
      }}
      onClose={close}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Отмена
          </Button>
          <Button type="submit" form={FORM_ID} disabled={patch.isPending}>
            {patch.isPending ? 'Сохраняем…' : 'Закрыть заявку'}
          </Button>
        </>
      }
    >
      {request && (
        <CloseForm
          key={`${request.id}-${initialOutcome}`}
          request={request}
          initialOutcome={initialOutcome}
          patch={patch}
          onDone={close}
        />
      )}
    </Modal>
  )
}

interface FormProps {
  request: ServiceRequest
  initialOutcome: Outcome
  patch: ReturnType<typeof usePatchServiceRequest>
  onDone: () => void
}

function CloseForm({ request, initialOutcome, patch, onDone }: FormProps) {
  const [outcome, setOutcome] = useState<Outcome>(initialOutcome)
  const [resolution, setResolution] = useState('')
  const [localError, setLocalError] = useState<string>()
  const resolutionId = useId()
  const reason = reasonMeta[request.reason]
  const priority = priorityMeta[request.priority]
  const error = localError ?? fieldErrors(patch.error).resolution

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!resolution.trim()) {
      setLocalError(outcome === 'done' ? 'Опишите, что сделано' : 'Укажите, почему отклонена')
      return
    }
    patch.mutate(
      { id: request.id, body: { status: outcome, resolution: resolution.trim() } },
      {
        onSuccess: () => {
          toast(outcome === 'done' ? 'Заявка закрыта' : 'Заявка отклонена')
          onDone()
        },
      },
    )
  }

  const outcomes: { value: Outcome; label: string; icon: typeof CheckCircle2; on: string }[] = [
    { value: 'done', label: 'Выполнена', icon: CheckCircle2, on: 'border-success bg-success-soft text-success' },
    { value: 'rejected', label: 'Отклонена', icon: CircleSlash, on: 'border-muted bg-surface-2 text-text' },
  ]

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-5">
      {patch.isError && (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {errorMessage(patch.error)}
        </p>
      )}

      {/* исходная заявка — только для чтения */}
      <section aria-label="Заявка" className="grid gap-2 rounded-tile border border-border bg-surface-2/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <reason.icon className="size-4 text-muted" aria-hidden />
          <span className="text-sm font-semibold">{reason.label}</span>
          <Badge tone={priority.tone}>{priority.label} срочность</Badge>
        </div>
        <p className="whitespace-pre-line break-words text-sm">
          {request.description || <span className="text-muted">Без описания</span>}
        </p>
        <p className="text-xs text-muted">
          {request.methodName}
          {request.authorName && ` · подал(а) ${request.authorName}`}
        </p>
      </section>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-caption font-semibold text-muted">Исход</legend>
        <div className="grid grid-cols-2 gap-2">
          {outcomes.map(({ value, label, icon: Icon, on }) => (
            <label
              key={value}
              className={cn(
                'flex h-10 cursor-pointer items-center justify-center gap-2 rounded-control border text-sm font-semibold transition-colors',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
                outcome === value ? on : 'border-border text-muted hover:border-primary/50',
              )}
            >
              <input
                type="radio"
                name="outcome"
                value={value}
                checked={outcome === value}
                onChange={() => {
                  setOutcome(value)
                  setLocalError(undefined)
                }}
                className="sr-only"
              />
              <Icon className="size-4" aria-hidden />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-1.5">
        <label htmlFor={resolutionId} className="text-caption font-semibold text-muted">
          {outcome === 'done' ? 'Что сделано' : 'Почему отклонена'} <span className="text-danger">*</span>
        </label>
        <AutoTextarea
          id={resolutionId}
          value={resolution}
          maxLength={MAX_RESOLUTION}
          counter
          invalid={Boolean(error)}
          aria-describedby={error ? `${resolutionId}-error` : undefined}
          placeholder={
            outcome === 'done'
              ? 'Например: заменён токоподвод горелки, проверено на пробном шве'
              : 'Например: неисправности не найдено, установка работает штатно'
          }
          onChange={(e) => {
            setResolution(e.target.value)
            setLocalError(undefined)
          }}
        />
        {error && (
          <p id={`${resolutionId}-error`} className="text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </form>
  )
}
