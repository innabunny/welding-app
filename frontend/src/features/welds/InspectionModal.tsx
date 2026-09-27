import { ClipboardCheck } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { errorMessage, fieldErrors } from '@/shared/api/errors'
import { cn } from '@/shared/lib/cn'
import { toast } from '@/shared/lib/toast'
import type { InspectionCreate, InspectionMethod, InspectionResult, OperationRun } from '@/shared/types/welding'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select } from '@/shared/ui/Form'
import { Modal } from '@/shared/ui/Modal'
import { AutoTextarea } from '@/shared/ui/Textarea'
import { METHODS, SPECIMENS } from './labels'
import { useCreateInspection } from './queries'

const FORM_ID = 'create-inspection'

// выбранная кнопка залита, остальные — контур того же цвета
const resultStyles: Record<InspectionResult, { label: string; on: string; off: string }> = {
  годен: { label: 'Годен', on: 'border-success bg-success text-surface', off: 'border-success/40 text-success hover:border-success' },
  исправление: { label: 'Исправление', on: 'border-warning bg-warning text-surface', off: 'border-warning/40 text-warning hover:border-warning' },
  брак: { label: 'Брак', on: 'border-danger bg-danger text-surface', off: 'border-danger/40 text-danger hover:border-danger' },
}

interface Props {
  /** null — модалка закрыта */
  run: OperationRun | null
  onClose: () => void
}

export function InspectionModal({ run, onClose }: Props) {
  const create = useCreateInspection()
  const close = () => {
    create.reset()
    onClose()
  }
  return (
    <Modal
      open={run !== null}
      title="Заключение контроля"
      accent={{ icon: <ClipboardCheck />, subtitle: run ? `Операция ${run.operationNumber} · карта № ${run.cardNo}` : undefined }}
      onClose={close}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Отмена
          </Button>
          <Button type="submit" form={FORM_ID} disabled={create.isPending}>
            {create.isPending ? 'Сохраняем…' : 'Внести заключение'}
          </Button>
        </>
      }
    >
      {run && <InspectionForm key={run.id} run={run} create={create} onDone={close} />}
    </Modal>
  )
}

function InspectionForm({ run, create, onDone }: {
  run: OperationRun
  create: ReturnType<typeof useCreateInspection>
  onDone: () => void
}) {
  // по умолчанию — первый назначенный, но ещё не выполненный контроль
  const firstMissing = METHODS.find((m) => run.controlsMissing.includes(m.value))?.value ?? 'ВИК'
  const [draft, setDraft] = useState<InspectionCreate>({
    runId: run.id,
    kind: 'промежуточный',
    method: firstMissing,
    specimen: 'шов',
    result: 'годен',
    defects: [],
    reportNo: '',
    // местная дата, не UTC: ночью toISOString дал бы вчерашнее число
    inspectedAt: new Date().toLocaleDateString('sv-SE'),
    conclusion: '',
  })
  const conclusionId = useId()
  const errors = fieldErrors(create.error)
  const update = (patch: Partial<InspectionCreate>) => setDraft((d) => ({ ...d, ...patch }))

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    create.mutate(
      { ...draft, reportNo: draft.reportNo.trim(), conclusion: draft.conclusion.trim() },
      {
        onSuccess: () => {
          toast(`${draft.method}: ${resultStyles[draft.result].label.toLowerCase()}`)
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Метод" required error={errors.method}>
          {(id, d) => (
            <Select id={id} aria-describedby={d} value={draft.method} onChange={(e) => update({ method: e.target.value as InspectionMethod })}>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.value} — {m.title}
                  {run.requiredControls.includes(m.value) ? (run.controlsMissing.includes(m.value) ? ' · назначен' : ' · уже есть') : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Вид контроля">
          {() => (
            <div role="group" aria-label="Вид контроля" className="flex h-9 rounded-control border border-border p-0.5">
              {(['промежуточный', 'окончательный'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={draft.kind === kind}
                  onClick={() => update({ kind })}
                  className={cn(
                    'flex-1 rounded-[8px] text-sm font-semibold transition-colors',
                    draft.kind === kind ? 'bg-primary-soft text-primary' : 'text-muted hover:text-text',
                  )}
                >
                  {kind === 'промежуточный' ? 'Промежуточный' : 'Окончательный'}
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field label="Объект контроля" error={errors.specimen} hint={draft.specimen === 'вырезка' ? 'Вырезки в статистику качества не идут' : undefined}>
          {(id, d) => (
            <Select id={id} aria-describedby={d} value={draft.specimen} onChange={(e) => update({ specimen: e.target.value as InspectionCreate['specimen'] })}>
              {SPECIMENS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Дата контроля" error={errors.inspectedAt}>
          {(id, d) => (
            <Input id={id} aria-describedby={d} type="date" value={draft.inspectedAt ?? ''} onChange={(e) => update({ inspectedAt: e.target.value || null })} />
          )}
        </Field>
      </div>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-caption font-semibold text-muted">
          Результат <span className="text-danger">*</span>
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(resultStyles) as InspectionResult[]).map((value) => {
            const selected = draft.result === value
            return (
              <label
                key={value}
                className={cn(
                  'flex h-10 cursor-pointer items-center justify-center rounded-control border text-sm font-semibold transition-colors',
                  'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
                  selected ? resultStyles[value].on : resultStyles[value].off,
                )}
              >
                <input type="radio" name="result" className="sr-only" checked={selected} onChange={() => update({ result: value })} />
                {resultStyles[value].label}
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Field label="№ заключения" error={errors.reportNo}>
          {(id, d) => (
            <Input id={id} aria-describedby={d} maxLength={50} className="font-mono" value={draft.reportNo} onChange={(e) => update({ reportNo: e.target.value })} />
          )}
        </Field>
        <div className="grid gap-1.5">
          <label htmlFor={conclusionId} className="text-caption font-semibold text-muted">
            Заключение
          </label>
          <AutoTextarea
            id={conclusionId}
            value={draft.conclusion}
            placeholder={draft.result === 'годен' ? 'Дефектов не обнаружено' : 'Какие дефекты, где и какого размера'}
            onChange={(e) => update({ conclusion: e.target.value })}
          />
        </div>
      </div>
    </form>
  )
}
