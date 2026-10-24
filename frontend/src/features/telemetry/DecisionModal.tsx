import { useSession } from '@/shared/api/session'
import { cn } from '@/shared/lib/cn'
import { formatNumber, formatRange } from '@/shared/lib/format'
import { toast } from '@/shared/lib/toast'
import { DECISION_LABELS, type Deviation } from '@/shared/types/deviations'
import { Field, Input } from '@/shared/ui/Form'
import { FormModal, type Editing, type Errors } from '@/shared/ui/FormModal'
import { AutoTextarea } from '@/shared/ui/Textarea'
import { RESULTS, type DecisionForm, type DeviationKind } from './decision'
import { formatDuration, formatTime } from './format'
import { useCreateWeldDecision } from './queries'
import { DEVIATION_UNIT } from './units'

interface Props {
  editing: Editing<DecisionForm>
  kind: DeviationKind
  deviations: Deviation[]
  onClose: () => void
  onSaved: () => void
}

const capitalize = (t: string) => (t ? t[0]?.toUpperCase() + t.slice(1) : t)

/** Что именно закрывается решением — человек подписывает конкретные цифры */
function Picked({ deviations }: { deviations: Deviation[] }) {
  const first = deviations[0]
  const where = first
    ? [
        first.seamNumber && `шов ${first.seamNumber}`,
        first.partNumber && `деталь ${first.partNumber}`,
        first.serialNo && `зав. № ${first.serialNo}`,
        first.operationNumber && `операция ${first.operationNumber}`,
      ].filter(Boolean)
    : []
  return (
    <div className="rounded-box border border-danger/40 bg-danger-soft p-3">
      <p className="mb-2 text-sm font-semibold">
        {where.length > 0 ? capitalize(where.join(', ')) : 'Шов по чертежу не привязан'}
        {first?.welderName && <span className="font-normal text-muted"> · сварщик {first.welderName}</span>}
      </p>
      <ul className="grid gap-1 text-sm">
        {deviations.map((d) => {
          const unit = DEVIATION_UNIT[d.parameter]
          return (
            <li key={d.id} className="flex flex-wrap gap-x-2">
              <span className="font-mono text-muted">{formatTime(d.startedAt, true)}</span>
              <span className="font-semibold">{d.parameterName}</span>
              {!d.isOrganizational && (
                <span>
                  {formatNumber(d.actualValue)} {unit} при допуске {formatRange(d.plannedMin, d.plannedMax)} {unit}
                  {d.durationSeconds !== null && `, ${formatDuration(d.durationSeconds)}`}
                </span>
              )}
              {d.passNo !== null && <span className="text-muted">проход {d.passNo}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function validate(form: DecisionForm): Errors {
  const errors: Errors = {}
  if (form.result === '') errors.result = 'Выберите решение'
  if (form.result === 'на контроль' && !form.assignedControl.trim())
    errors.assignedControl = 'Укажите вид контроля: РК, УЗК, ВИК'
  if (form.deviations.length === 0) errors.deviations = 'Не выбрано ни одного отклонения'
  return errors
}

export function DecisionModal({ editing, kind, deviations, onClose, onSaved }: Props) {
  const save = useCreateWeldDecision()
  const author = useSession((s) => s.user?.name ?? '')
  const results = RESULTS[kind]
  const count = deviations.length

  return (
    <FormModal
      editing={editing}
      newTitle={kind === 'regime' ? `Решение по ${count === 1 ? 'отклонению' : `${count} отклонениям`}` : 'Разбор нарушения порядка'}
      editTitle=""
      save={save}
      validate={validate}
      prepare={(d) => d}
      onClose={onClose}
      onSaved={() => {
        toast(kind === 'regime' ? 'Решение сохранено' : 'Нарушение отмечено как разобранное')
        onSaved()
      }}
    >
      {({ draft, update, errors }) => (
        <>
          <Picked deviations={deviations} />
          {errors.deviations && <p className="text-sm text-danger">{errors.deviations}</p>}

          {results.length > 1 ? (
            <fieldset className="grid gap-2">
              <legend className="mb-1.5 text-caption font-semibold text-muted">
                Решение<span className="text-danger"> *</span>
              </legend>
              {results.map((r) => (
                <label
                  key={r}
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 rounded-control border px-3 py-2.5 text-sm',
                    draft.result === r ? 'border-primary bg-primary-soft' : 'border-border hover:border-primary/60',
                    r === 'на переварку' && draft.result === r && 'border-danger bg-danger-soft',
                  )}
                >
                  <input
                    type="radio"
                    name="decision-result"
                    className="mt-0.5 size-4 accent-primary"
                    checked={draft.result === r}
                    onChange={() => update({ result: r })}
                  />
                  <span>
                    <span className="font-semibold">{DECISION_LABELS[r]}</span>
                    {r === 'на переварку' && (
                      <span className="block text-xs text-muted">Дефектный участок шва выбирают и заваривают заново.</span>
                    )}
                  </span>
                </label>
              ))}
              {errors.result && <p className="text-xs text-danger">{errors.result}</p>}
            </fieldset>
          ) : (
            <p className="text-sm">
              Решение: <span className="font-semibold">{DECISION_LABELS['разобрано']}</span>
            </p>
          )}

          {draft.result === 'на контроль' && (
            <Field label="Вид контроля" required error={errors.assignedControl} hint="Что и в каком объёме: РК шва по всей длине, УЗК корня, ВИК">
              {(id, describedBy) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  invalid={Boolean(errors.assignedControl)}
                  value={draft.assignedControl}
                  maxLength={200}
                  onChange={(e) => update({ assignedControl: e.target.value })}
                />
              )}
            </Field>
          )}

          <Field
            label={kind === 'regime' ? 'Обоснование' : 'Какие меры приняты'}
            error={errors.reason}
            hint="Документ будут читать годы спустя: почему решили именно так."
          >
            {(id, describedBy) => (
              <AutoTextarea
                id={id}
                aria-describedby={describedBy}
                invalid={Boolean(errors.reason)}
                value={draft.reason}
                maxLength={1000}
                counter
                rows={3}
                onChange={(e) => update({ reason: e.target.value })}
              />
            )}
          </Field>

          <p className="text-caption text-muted">
            Решение подпишется вашим именем{author ? `: ${author}` : ''}. Отклонения станут рассмотренными.
          </p>
        </>
      )}
    </FormModal>
  )
}
