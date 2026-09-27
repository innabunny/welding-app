import { ArrowRight, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { canEditAttestation } from '@/features/auth/roles'
import { useWeldingMethods } from '@/features/equipment/queries'
import { useFillerMaterials, useGasFlux, useMaterialGroups, useMaterials } from '@/features/materials/queries'
import { errorMessage, fieldErrors, listErrors } from '@/shared/api/errors'
import { useSession } from '@/shared/api/session'
import { cn } from '@/shared/lib/cn'
import { formatDate, formatNumber } from '@/shared/lib/format'
import { toast } from '@/shared/lib/toast'
import type {
  Attestation,
  AttestationItem,
  AttestationPhase2,
  AttestationStatus,
  AttestationWrite,
} from '@/shared/types/attestation'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Field, Input, Select } from '@/shared/ui/Form'
import { AutoTextarea } from '@/shared/ui/Textarea'
import { CONTROLS, STEPS, expiryMeta, statusTone } from './labels'
import { useAttestationRules, useDeleteAttestation, useSaveAttestation, useWelders } from './queries'
import { ALIGNED_GRID, SampleCard } from './SampleCard'
import { StatusStepper } from './StatusStepper'

const emptyItem = (): AttestationItem => ({
  sampleNo: '',
  material1: null,
  material2: null,
  uniform: false,
  thicknessMin: null,
  thicknessMax: null,
  wireId: null,
  fluxId: null,
  gasId: null,
  position: '',
  preheat: '',
  heatTreatment: '',
  vikResult: '',
  physicalProtocol: '',
  metallographyProtocol: '',
  tensileStrength: null,
  bendAngle: null,
  impactStrength: '',
  otherMethods: '',
})

const emptyAttestation: AttestationWrite = {
  welderId: null,
  methodId: '',
  groupId: null,
  kind: 'первичная',
  controls: ['вик'],
  status: 'draft',
  attestedAt: null,
  protocolNo: '',
  certificateNo: '',
  practicalEval: '',
  conclusion: '',
  chairman: '',
  headShop: '',
  headBtk: '',
  items: [emptyItem()],
}

function toWrite(a: Attestation): AttestationWrite {
  return {
    welderId: a.welderId,
    methodId: a.methodId,
    groupId: a.groupId,
    kind: a.kind,
    controls: [...a.controls],
    status: a.status,
    attestedAt: a.attestedAt,
    protocolNo: a.protocolNo,
    certificateNo: a.certificateNo,
    practicalEval: a.practicalEval,
    conclusion: a.conclusion,
    chairman: a.chairman,
    headShop: a.headShop,
    headBtk: a.headBtk,
    items: a.items.map((i) => ({ ...i })),
  }
}

/** После отправки на испытания сервер принимает только реквизиты и результаты */
function toPhase2(d: AttestationWrite): AttestationPhase2 {
  return {
    status: d.status,
    attestedAt: d.attestedAt,
    protocolNo: d.protocolNo.trim(),
    certificateNo: d.certificateNo.trim(),
    practicalEval: d.practicalEval.trim(),
    conclusion: d.conclusion.trim(),
    chairman: d.chairman.trim(),
    headShop: d.headShop.trim(),
    headBtk: d.headBtk.trim(),
    items: d.items,
  }
}

const nextStep = (s: AttestationStatus) => STEPS[STEPS.findIndex((x) => x.value === s) + 1]

export function AttestationForm({ attestation }: { attestation: Attestation | undefined }) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<AttestationWrite>(() => (attestation ? toWrite(attestation) : emptyAttestation))
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})
  const save = useSaveAttestation()
  const remove = useDeleteAttestation()
  // остальные роли видят аттестацию, но не правят
  const canEdit = useSession((s) => canEditAttestation(s.user?.role))

  const welders = useWelders({ active: true })
  const methods = useWeldingMethods()
  const groups = useMaterialGroups()
  const materials = useMaterials()
  const fillers = useFillerMaterials()
  const gasFlux = useGasFlux()
  const rules = useAttestationRules(draft.methodId, draft.groupId)

  // статус берём с сервера: пока не сохранили, форма остаётся в своей фазе
  const saved = attestation?.status ?? 'draft'
  const isDraft = saved === 'draft'
  const errors = { ...fieldErrors(save.error), ...localErrors }
  const itemErrors = listErrors(save.error, 'items')
  const lookups = {
    materials: materials.data ?? [],
    fillers: (fillers.data ?? []).filter((f) => f.kind !== 'вольфрам'),
    gases: (gasFlux.data ?? []).filter((g) => g.kind === 'gas'),
    fluxes: (gasFlux.data ?? []).filter((g) => g.kind === 'flux'),
  }

  const update = (patch: Partial<AttestationWrite>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setLocalErrors((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(patch)) delete next[key]
      return next
    })
  }
  const setItem = (index: number, item: AttestationItem) =>
    setDraft((d) => ({ ...d, items: d.items.map((x, i) => (i === index ? item : x)) }))

  const validate = (target: AttestationWrite): Record<string, string> => {
    const found: Record<string, string> = {}
    if (target.welderId === null) found.welderId = 'Выберите сварщика'
    if (!target.methodId) found.methodId = 'Выберите способ сварки'
    if (target.groupId === null) found.groupId = 'Выберите группу материала'
    if (target.items.some((i) => !i.sampleNo.trim() || i.material1 === null))
      found.items = 'У каждого образца нужны номер и материал 1'
    if (target.items.some((i) => i.thicknessMin !== null && i.thicknessMax !== null && Number(i.thicknessMin) > Number(i.thicknessMax)))
      found.items = 'Проверьте толщины образцов'
    if (target.status === 'done' && !target.attestedAt) found.attestedAt = 'Укажите дату аттестации'
    return found
  }

  const submit = (status: AttestationStatus = draft.status) => {
    const target = { ...draft, status }
    const found = validate(target)
    setLocalErrors(found)
    if (Object.keys(found).length > 0) return

    const body = isDraft
      ? {
          ...target,
          items: target.items.map((i) => ({ ...i, sampleNo: i.sampleNo.trim(), material2: i.uniform ? null : i.material2 })),
        }
      : toPhase2(target)
    save.mutate(
      { id: attestation?.id ?? null, body },
      {
        onSuccess: (result) => {
          setDraft(toWrite(result))
          if (status !== saved) toast(`Этап: ${STEPS.find((s) => s.value === status)?.label ?? status}`)
          else toast('Сохранено')
          if (!attestation) navigate(`/attestation/${result.id}`, { replace: true })
        },
      },
    )
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    submit()
  }

  const next = nextStep(saved)
  const welderMissing = draft.welderId !== null && !welders.data?.some((w) => w.id === draft.welderId)

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 flex flex-wrap items-center gap-3 text-xl font-heading tracking-heading sm:text-2xl">
            {attestation ? attestation.welderFio : 'Новая аттестация'}
            {attestation && <Badge tone={statusTone[saved]}>{attestation.statusDisplay}</Badge>}
            {attestation?.expiryState && (
              <Badge tone={expiryMeta[attestation.expiryState].tone}>
                {expiryMeta[attestation.expiryState].label} до {formatDate(attestation.validUntil)}
              </Badge>
            )}
          </h1>
          <p className="text-nav text-muted">
            {attestation
              ? `${attestation.methodName} · группа ${attestation.groupCode}${attestation.welderWorkshop ? ` · ${attestation.welderWorkshop}` : ''}`
              : 'Сварщик, способ сварки и образцы'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && attestation && isDraft && (
            <Button
              variant="ghost"
              className="hover:bg-danger-soft hover:text-danger"
              disabled={remove.isPending}
              onClick={() => {
                if (!window.confirm('Удалить черновик аттестации?')) return
                remove.mutate(attestation.id, {
                  onSuccess: () => {
                    toast('Черновик удалён')
                    navigate('/attestation')
                  },
                  onError: (e) => toast(errorMessage(e), 'error'),
                })
              }}
            >
              <Trash2 aria-hidden />
              Удалить
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate('/attestation')}>
            К реестру
          </Button>
          {canEdit && (
            <Button type="submit" variant={next && attestation ? 'secondary' : 'primary'} disabled={save.isPending}>
              {save.isPending ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          )}
          {canEdit && attestation && next && (
            <Button onClick={() => submit(next.value)} disabled={save.isPending}>
              Далее: {next.label}
              <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {(save.isError || errors.items) && (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {save.isError ? errorMessage(save.error) : errors.items}
          {save.isError && errors.items ? ` ${errors.items}` : ''}
        </p>
      )}

      {attestation && <StatusStepper status={saved} />}

      {!canEdit && (
        <p className="rounded-control bg-surface-2 px-3 py-2 text-sm text-muted">
          Только просмотр: вести аттестацию могут администратор, технолог и мастер.
        </p>
      )}

      <fieldset disabled={!canEdit} className="grid min-w-0 gap-5">

      <Card className="p-5">
        <h2 className="mb-4 text-lg font-heading">Сварщик и способ</h2>
        <fieldset disabled={!isDraft} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Сварщик" required error={errors.welderId} className="sm:col-span-2">
            {(id, d) => (
              <Select
                id={id}
                aria-describedby={d}
                invalid={Boolean(errors.welderId)}
                value={draft.welderId ?? ''}
                disabled={welders.isPending || !isDraft}
                onChange={(e) => update({ welderId: e.target.value === '' ? null : Number(e.target.value) })}
              >
                <option value="">{welders.data?.length === 0 ? 'Сварщиков нет — заведите во вкладке «Сварщики»' : 'Не выбран'}</option>
                {/* уволенный сварщик из старой аттестации не пропадает из поля */}
                {welderMissing && attestation && <option value={draft.welderId ?? ''}>{attestation.welderFio}</option>}
                {welders.data?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.fio}
                    {w.personnelNo ? ` · таб. ${w.personnelNo}` : ''}
                    {w.workshopName ? ` · ${w.workshopName}` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Вид аттестации">
            {() => (
              <div role="group" aria-label="Вид аттестации" className="flex h-9 rounded-control border border-border p-0.5">
                {(['первичная', 'периодическая'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={draft.kind === kind}
                    onClick={() => update({ kind })}
                    className={cn(
                      'flex-1 rounded-[8px] text-sm font-semibold transition-colors disabled:cursor-not-allowed',
                      draft.kind === kind ? 'bg-primary-soft text-primary' : 'text-muted hover:text-text',
                    )}
                  >
                    {kind === 'первичная' ? 'Первичная' : 'Периодическая'}
                  </button>
                ))}
              </div>
            )}
          </Field>
          <div />
          <Field label="Способ сварки" required error={errors.methodId} className="sm:col-span-2">
            {(id, d) => (
              <Select
                id={id}
                aria-describedby={d}
                invalid={Boolean(errors.methodId)}
                value={draft.methodId}
                disabled={!isDraft}
                onChange={(e) => update({ methodId: e.target.value })}
              >
                <option value="">Не выбран</option>
                {methods.data?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.designation ? `${m.designation} — ${m.name}` : m.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Группа материала" required error={errors.groupId} className="sm:col-span-2">
            {(id, d) => (
              <Select
                id={id}
                aria-describedby={d}
                invalid={Boolean(errors.groupId)}
                value={draft.groupId ?? ''}
                disabled={!isDraft}
                onChange={(e) => update({ groupId: e.target.value === '' ? null : Number(e.target.value) })}
              >
                <option value="">Не выбрана</option>
                {groups.data?.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <fieldset className="grid gap-1.5 sm:col-span-2 lg:col-span-4">
            <legend className="mb-1.5 text-caption font-semibold text-muted">Виды контроля</legend>
            <div className="flex flex-wrap gap-2">
              {CONTROLS.map((c) => {
                const on = draft.controls.includes(c.value)
                return (
                  <label
                    key={c.value}
                    title={c.title}
                    className={cn(
                      'flex h-9 cursor-pointer items-center gap-2 rounded-control border px-3 text-sm transition-colors',
                      'has-[:disabled]:cursor-not-allowed has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary',
                      on ? 'border-primary bg-primary-soft text-primary' : 'border-border hover:border-primary/50',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={(e) =>
                        update({
                          controls: e.target.checked
                            ? CONTROLS.map((x) => x.value).filter((v) => v === c.value || draft.controls.includes(v))
                            : draft.controls.filter((v) => v !== c.value),
                        })
                      }
                    />
                    <span className="font-mono font-semibold">{c.label}</span>
                    <span className="text-xs text-muted">{c.title}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        </fieldset>
        {!isDraft && (
          <p className="mt-3 text-xs text-muted">После отправки на испытания сварщик, способ и образцы не меняются.</p>
        )}
      </Card>

      {isDraft && draft.methodId && draft.groupId !== null && (
        <Card className="p-5">
          <h2 className="mb-2 text-lg font-heading">Библиотека правил</h2>
          {rules.isPending ? (
            <p className="text-sm text-muted">Загрузка…</p>
          ) : rules.data && rules.data.length > 0 ? (
            <ul className="grid gap-1.5 text-sm">
              {rules.data.map((r) => (
                <li key={r.id} className="flex flex-wrap gap-x-3">
                  <span className="font-mono font-semibold">
                    {formatNumber(r.thFrom)}–{r.thTo === null ? '∞' : formatNumber(r.thTo)} мм
                  </span>
                  <span className="text-muted">
                    {Object.entries(r.requiredOutput)
                      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                      .join(' · ') || 'требования не заданы'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Для этого способа и группы правил нет. Их заводят в админке.</p>
          )}
          <p className="mt-2 text-xs text-muted">Требования зафиксируются в образцах при отправке на испытания.</p>
        </Card>
      )}

      <Card className="grid gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-heading">
            Образцы <span className="text-muted">· {draft.items.length}</span>
          </h2>
          {isDraft && (
            <Button
              variant="secondary"
              icon={<Plus />}
              onClick={() => setDraft((d) => ({ ...d, items: [...d.items, emptyItem()] }))}
            >
              Добавить образец
            </Button>
          )}
        </div>
        {!isDraft && <p className="text-xs text-muted">Внесите результаты испытаний.</p>}
        {draft.items.map((item, index) => (
          <SampleCard
            key={item.id ?? `new-${index}`}
            item={item}
            index={index}
            draft={isDraft}
            lookups={lookups}
            errors={itemErrors[index] ?? {}}
            canDelete={draft.items.length > 1}
            onChange={(next) => setItem(index, next)}
            onDelete={() => setDraft((d) => ({ ...d, items: d.items.filter((_, i) => i !== index) }))}
          />
        ))}
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-lg font-heading">Протокол и допуск</h2>
        <div className={ALIGNED_GRID}>
          <Field label="№ протокола" error={errors.protocolNo}>
            {(id, d) => (
              <Input id={id} aria-describedby={d} maxLength={50} className="font-mono" value={draft.protocolNo} onChange={(e) => update({ protocolNo: e.target.value })} />
            )}
          </Field>
          <Field label="№ удостоверения" error={errors.certificateNo}>
            {(id, d) => (
              <Input id={id} aria-describedby={d} maxLength={50} className="font-mono" value={draft.certificateNo} onChange={(e) => update({ certificateNo: e.target.value })} />
            )}
          </Field>
          <Field
            label="Дата аттестации"
            required={draft.status === 'done' || next?.value === 'done'}
            error={errors.attestedAt}
            hint={attestation?.validUntil ? `Действует до ${formatDate(attestation.validUntil)}` : 'Срок — 3 года, считается сам'}
          >
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                type="date"
                invalid={Boolean(errors.attestedAt)}
                value={draft.attestedAt ?? ''}
                onChange={(e) => update({ attestedAt: e.target.value || null })}
              />
            )}
          </Field>
          <Field label="Оценка практических навыков" error={errors.practicalEval}>
            {(id, d) => (
              <Input id={id} aria-describedby={d} maxLength={50} value={draft.practicalEval} onChange={(e) => update({ practicalEval: e.target.value })} />
            )}
          </Field>
          <Field label="Заключение о допуске" error={errors.conclusion} className="sm:col-span-2 lg:col-span-4">
            {(id, d) => (
              <AutoTextarea id={id} aria-describedby={d} value={draft.conclusion} onChange={(e) => update({ conclusion: e.target.value })} />
            )}
          </Field>
          {(
            [
              ['chairman', 'Председатель комиссии'],
              ['headShop', 'Начальник цеха'],
              ['headBtk', 'Начальник БТК'],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label} error={errors[key]}>
              {(id, d) => (
                <Input id={id} aria-describedby={d} maxLength={200} value={draft[key]} onChange={(e) => update({ [key]: e.target.value })} />
              )}
            </Field>
          ))}
        </div>
      </Card>

      </fieldset>

      {canEdit && !attestation && (
        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Сохраняем…' : 'Создать черновик'}
          </Button>
        </div>
      )}
    </form>
  )
}
