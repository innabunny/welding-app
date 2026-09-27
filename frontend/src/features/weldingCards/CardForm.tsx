import { AlertTriangle, Lock, Plus, Printer } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useEquipmentList, useSpeedUnits, useWeldingMethods } from '@/features/equipment/queries'
import { useFillerMaterials, useGasFlux } from '@/features/materials/queries'
import { errorMessage } from '@/shared/api/errors'
import { editableFieldsFor, sectionsFor } from '@/shared/config/methodFields'
import type { WeldingCard, WeldingCardWrite, WeldPass } from '@/shared/types/weldingCards'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { DecimalInput } from '@/shared/ui/DecimalInput'
import { Checkbox, Input, Select } from '@/shared/ui/Form'
import { emptyCard, emptyPass, prune, saveErrors, stableJson, toWrite } from './draft'
import { isMethodCode, modeOf, rangeProps } from './fields'
import { FieldInput, type Lookups } from './FieldInput'
import { FieldBox } from './FormBits'
import { rangeError } from './format'
import { OriginBlock } from './OriginBlock'
import { PassCard } from './PassCard'
import { useOperation, useOperations, useSaveWeldingCard, useSeam } from './queries'
import { SimilarPanel } from './SimilarPanel'

interface Props {
  /** Сохранённая карта; undefined — новая */
  card: WeldingCard | undefined
  /** Для новой карты: деталь и операция, выбранные заранее (из маршрута детали) */
  preset?: { partId: number; operationId: number }
}

export function CardForm({ card, preset }: Props) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<WeldingCardWrite>(() =>
    card ? toWrite(card) : { ...emptyCard, operationId: preset?.operationId ?? null },
  )
  const [partId, setPartId] = useState<number | null>(preset?.partId ?? null)
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})
  const save = useSaveWeldingCard()

  const methods = useWeldingMethods()
  const equipmentList = useEquipmentList({ method: draft.methodId || undefined })
  const speedUnits = useSpeedUnits()
  const fillers = useFillerMaterials()
  const gasFlux = useGasFlux()

  // шов — по цепочке операция → шов: у новой карты операцию выбирают здесь
  const operations = useOperations(card ? null : partId)
  const savedOperation = useOperation(card ? card.operationId : null)
  const operation = card ? savedOperation.data : operations.data?.find((o) => o.id === draft.operationId)
  const seam = useSeam(operation?.seamId).data

  const method = isMethodCode(draft.methodId) ? draft.methodId : null
  const mode = modeOf(draft.weldingMode)
  const methodInfo = methods.data?.find((m) => m.id === draft.methodId)
  const equipment = equipmentList.data?.find((e) => e.id === draft.equipmentId)
  const equipmentUnits = (speedUnits.data ?? []).filter((u) => equipment?.speedUnits.includes(u.id))
  const pulseAllowed = equipment?.hasPulse === true
  const seamDiameter = seam?.seamDiameter ?? card?.seamDiameter ?? null

  const lookups: Lookups = {
    tungsten: (fillers.data ?? []).filter((f) => f.kind === 'вольфрам'),
    fillers: (fillers.data ?? []).filter((f) => f.kind !== 'вольфрам'),
    gases: (gasFlux.data ?? []).filter((g) => g.kind === 'gas'),
    fluxes: (gasFlux.data ?? []).filter((g) => g.kind === 'flux'),
  }

  // выпущенная карта — документ: правится только после снятия отметки
  const locked = card?.isReleased === true && draft.isReleased
  const dirty = card ? stableJson(toWrite(card)) !== stableJson(draft) : true
  const server = saveErrors(save.error)
  const errors = { ...server.card, ...localErrors }

  const update = (patch: Partial<WeldingCardWrite>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
    setLocalErrors((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(patch)) delete next[key]
      return next
    })
  }

  const setPass = (index: number, next: WeldPass) =>
    setDraft((prev) => ({ ...prev, passes: prev.passes.map((p, i) => (i === index ? next : p)) }))

  const addPass = () => setDraft((prev) => ({ ...prev, passes: [...prev.passes, emptyPass(prev.passes.length + 1)] }))

  const deletePass = (index: number) =>
    setDraft((prev) =>
      // последний не удаляем: пустой массив на сервере сотрёт все проходы
      prev.passes.length <= 1
        ? prev
        : { ...prev, passes: prev.passes.filter((_, i) => i !== index).map((p, i) => ({ ...p, no: i + 1 })) },
    )

  const chooseEquipment = (id: number | null) => {
    const next = equipmentList.data?.find((e) => e.id === id)
    // импульс остаётся только на установке, которая его умеет
    update({ equipmentId: id, ...(mode === 'pulse' && !next?.hasPulse ? { weldingMode: 'непрерывный' as const } : {}) })
  }

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const found: Record<string, string> = {}
    if (!draft.cardNo.trim()) found.cardNo = 'Укажите номер карты'
    if (draft.operationId === null) found.operationId = 'Выберите операцию'
    if (!draft.methodId) found.methodId = 'Выберите способ сварки'
    else if (!method) found.methodId = 'Для этого способа нет описи полей'
    if (mode === 'pulse' && !pulseAllowed) found.weldingMode = 'У установки нет импульсного режима'
    if (method) {
      const ranges = editableFieldsFor(method, 'pass', mode).filter((f) => f.range)
      const bad = draft.passes.some(
        (p) =>
          ranges.some((f) => {
            const [lo, hi] = rangeProps(f)
            const bag = p as unknown as Record<string, string | null>
            return rangeError(bag[lo] ?? null, bag[hi] ?? null) !== undefined
          }) ||
          (p.speedUnitId !== null && equipment !== undefined && !equipment.speedUnits.includes(p.speedUnitId)),
      )
      if (bad) found.passes = 'Исправьте ошибки в проходах'
    }
    setLocalErrors(found)
    if (Object.keys(found).length > 0 || !method) return

    save.mutate(
      { id: card?.id ?? null, body: { ...prune(draft, method, mode), cardNo: draft.cardNo.trim() } },
      {
        onSuccess: (saved) => {
          if (!card) navigate(`/cards/${saved.id}`, { replace: true })
          else setDraft(toWrite(saved))
        },
      },
    )
  }

  const cardSections = method
    ? sectionsFor(method, 'card', mode)
        .map(({ section, fields }) => ({
          section,
          fields: fields.filter((f) => (f.owner === 'card' || f.owner === 'pass') && !f.readOnly),
        }))
        .filter((s) => s.fields.length > 0)
    : []

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 flex flex-wrap items-center gap-3 text-xl font-heading tracking-heading sm:text-2xl">
            {card ? `Карта № ${card.cardNo}` : 'Новая карта'}
            {card && (
              <Badge tone={card.isReleased ? 'green' : 'yellow'}>{card.isReleased ? 'Выпущена' : 'Черновик'}</Badge>
            )}
          </h1>
          <p className="text-nav text-muted">
            {card
              ? `${card.designation || card.methodName}${card.authorName ? ` · ${card.authorName}` : ''}`
              : 'Режим сварки одной операции'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {card && (
            <Button
              variant="secondary"
              icon={<Printer />}
              onClick={() => navigate(`/cards/${card.id}/sheet`)}
              title={dirty ? 'В бланке — последняя сохранённая версия' : undefined}
            >
              Бланк{dirty ? ' (сохранённый)' : ''}
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate('/cards')}>
            К списку
          </Button>
          <Button type="submit" disabled={save.isPending || (card !== undefined && !dirty)}>
            {save.isPending ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </div>
      </div>

      {(save.isError || errors.passes) && (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {save.isError ? errorMessage(save.error) : errors.passes}
          {save.isError && errors.passes && ` ${errors.passes}`}
        </p>
      )}

      {card?.isReleased && (
        <div className="flex flex-wrap items-center gap-3 rounded-control bg-primary-soft px-4 py-3 text-sm text-primary">
          <Lock className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">
            Карта выпущена — по ней уже варят. Чтобы править, снимите отметку «Выпущена» и сохраните как черновик.
          </span>
        </div>
      )}

      <OriginBlock
        card={card}
        method={method}
        operation={operation}
        seam={seam}
        partId={partId}
        operationId={draft.operationId}
        onPick={(nextPart, nextOperation) => {
          setPartId(nextPart)
          update({ operationId: nextOperation })
        }}
        operationError={errors.operationId}
      />

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-heading">Основное</h2>
        <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-4">
          <fieldset disabled={locked} className="contents">
            <FieldBox label="№ карты" required error={errors.cardNo}>
              {(id, describedBy) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  invalid={Boolean(errors.cardNo)}
                  maxLength={50}
                  value={draft.cardNo}
                  className="font-mono"
                  onChange={(e) => update({ cardNo: e.target.value })}
                />
              )}
            </FieldBox>
            <FieldBox label="Редакция" error={errors.revision}>
              {(id, describedBy) => (
                <DecimalInput
                  id={id}
                  aria-describedby={describedBy}
                  invalid={Boolean(errors.revision)}
                  digits={4}
                  places={0}
                  value={String(draft.revision)}
                  onChange={(v) => update({ revision: v === null ? 1 : Math.max(1, Number(v)) })}
                />
              )}
            </FieldBox>
            <FieldBox label="Способ сварки" required error={errors.methodId}>
              {(id, describedBy) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  invalid={Boolean(errors.methodId)}
                  value={draft.methodId}
                  disabled={methods.isPending}
                  onChange={(e) => update({ methodId: e.target.value, equipmentId: null })}
                >
                  <option value="">{methods.isPending ? 'Загрузка…' : 'Не выбран'}</option>
                  {methods.data?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.designation ? `${m.designation} — ${m.name}` : m.name}
                    </option>
                  ))}
                </Select>
              )}
            </FieldBox>
            <FieldBox
              label="Оборудование"
              error={errors.equipmentId}
              note={draft.methodId && equipmentList.data?.length === 0 ? 'Для способа нет установок' : undefined}
            >
              {(id, describedBy) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  invalid={Boolean(errors.equipmentId)}
                  value={draft.equipmentId ?? ''}
                  disabled={!draft.methodId || equipmentList.isPending}
                  onChange={(e) => chooseEquipment(e.target.value === '' ? null : Number(e.target.value))}
                >
                  <option value="">{draft.methodId ? 'Не выбрано' : 'Сначала способ'}</option>
                  {draft.equipmentId !== null && !equipment && card?.equipmentId === draft.equipmentId && (
                    <option value={draft.equipmentId}>{card.equipmentName} — другой способ</option>
                  )}
                  {equipmentList.data?.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name}
                      {eq.hasPulse ? ' · импульс' : ''}
                      {eq.isActive ? '' : ' · не в работе'}
                    </option>
                  ))}
                </Select>
              )}
            </FieldBox>
          </fieldset>
        </div>
        <Checkbox
          label="Выпущена"
          description="Черновик правится свободно; выпущенная карта — документ, по ней варят"
          checked={draft.isReleased}
          onChange={(e) => update({ isReleased: e.target.checked })}
        />
      </Card>

      {draft.methodId && !method && (
        <p className="flex gap-2 rounded-control bg-warning-soft px-3 py-2.5 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Для способа «{methodInfo?.name ?? draft.methodId}» нет описи полей в methodFields.ts — форму собрать не из чего.
        </p>
      )}

      {method && (
        <fieldset disabled={locked} className="grid min-w-0 gap-5">
          {cardSections.map(({ section, fields }) => (
            <Card key={section} className="p-5">
              <h2 className="mb-3 text-lg font-heading">{sectionTitle(section)}</h2>
              <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
                {fields.map((spec) => (
                  <FieldInput
                    key={spec.key}
                    spec={spec}
                    obj={draft}
                    onChange={setDraft}
                    lookups={lookups}
                    errors={errors}
                    pulseAllowed={pulseAllowed}
                  />
                ))}
              </div>
            </Card>
          ))}

          <Card className="grid gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-heading">
                Проходы <span className="text-muted">· {draft.passes.length}</span>
              </h2>
              <Button variant="secondary" icon={<Plus />} onClick={addPass}>
                Добавить проход
              </Button>
            </div>

            <SimilarPanel
              method={draft.methodId}
              methodName={methodInfo?.name ?? draft.methodId}
              materialId={seam?.material1Id ?? null}
              materialName={seam?.material1Marka ?? card?.material1Marka ?? ''}
              thickness={seam?.thickness1 ?? card?.seamThickness1 ?? null}
            />

            {draft.passes.map((pass, index) => (
              <PassCard
                key={index}
                pass={pass}
                saved={card?.passes.find((p) => p.no === pass.no)}
                method={method}
                mode={mode}
                lookups={lookups}
                speedUnits={equipmentUnits}
                equipmentChosen={equipment !== undefined}
                seamDiameter={seamDiameter}
                errors={server.passes[index] ?? {}}
                canDelete={draft.passes.length > 1}
                onChange={(next) => setPass(index, next)}
                onDelete={() => deletePass(index)}
              />
            ))}
          </Card>
        </fieldset>
      )}
    </form>
  )
}

/** «СВАРОЧНЫЕ МАТЕРИАЛЫ И СРЕДА» → «Сварочные материалы и среда» */
function sectionTitle(section: string): string {
  if (!section) return 'Параметры'
  const lower = section.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}
