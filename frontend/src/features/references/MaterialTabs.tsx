import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { formatNumber } from '@/shared/lib/format'
import type {
  FillerKind,
  FillerMaterialWrite,
  GasFluxKind,
  GasFluxWrite,
  MaterialGroupWrite,
  MaterialWrite,
} from '@/shared/types/materials'
import { Badge } from '@/shared/ui/Badge'
import { Button, IconButton } from '@/shared/ui/Button'
import { Field, Input, Select } from '@/shared/ui/Form'
import { Table, Td, Th, Tr } from '@/shared/ui/Table'
import {
  useFillerMaterials,
  useGasFlux,
  useMaterialGroups,
  useMaterials,
  useSaveFillerMaterial,
  useSaveGasFlux,
  useSaveMaterial,
  useSaveMaterialGroup,
} from './queries'
import { isBadDecimal, toDecimal } from './decimal'
import { ReferenceFormModal, type Editing, type Errors } from './ReferenceFormModal'
import { ReferenceList, Toolbar, type TabProps } from './ReferenceList'

const fillerKindLabels: Record<FillerKind, string> = {
  'присадочная проволока': 'Присадочная проволока',
  электрод: 'Покрытый электрод',
  вольфрам: 'Вольфрамовый электрод',
}

const gasFluxKindLabels: Record<GasFluxKind, string> = {
  gas: 'Защитный / плазмообразующий газ',
  flux: 'Флюс',
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button icon={<Plus />} onClick={onClick}>
      {label}
    </Button>
  )
}

function EditCell({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Td className="w-12">
      <IconButton label={label} onClick={onClick}>
        <Pencil />
      </IconButton>
    </Td>
  )
}

function ActionsTh() {
  return (
    <Th className="w-12">
      <span className="sr-only">Действия</span>
    </Th>
  )
}

/* ---------- Основные материалы ---------- */

const emptyMaterial: MaterialWrite = { marka: '', groupId: null, tensileStrength: null }

export function MaterialsTab({ search, onSearch, canEdit }: TabProps) {
  const materials = useMaterials()
  const groups = useMaterialGroups()
  const save = useSaveMaterial()
  const [editing, setEditing] = useState<Editing<MaterialWrite>>(null)
  const add = () => setEditing({ id: null, initial: emptyMaterial })

  return (
    <>
      <Toolbar
        search={search}
        onSearch={onSearch}
        placeholder="Поиск по марке или группе"
        action={canEdit && <AddButton label="Добавить материал" onClick={add} />}
      />
      <ReferenceList
        query={materials}
        search={search}
        text={(m) => `${m.marka} ${m.groupCode ?? ''}`}
        emptyTitle="Материалов пока нет"
        emptyDescription="Основные материалы нужны для сочетаний и техкарт."
      >
        {(items) => (
          <Table>
            <thead>
              <tr>
                <Th>Марка</Th>
                <Th>Группа</Th>
                <Th className="text-right">Предел прочности, кгс/мм²</Th>
                {canEdit && <ActionsTh />}
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <Tr key={m.id} className="hover:bg-surface-2/60">
                  <Td className="font-semibold">{m.marka}</Td>
                  <Td>
                    {m.groupCode ? (
                      <span className="font-mono text-xs font-semibold text-primary">{m.groupCode}</span>
                    ) : (
                      <Badge tone="yellow">без группы</Badge>
                    )}
                  </Td>
                  <Td className="text-right font-mono">{formatNumber(m.tensileStrength)}</Td>
                  {canEdit && (
                    <EditCell
                      label={`Изменить «${m.marka}»`}
                      onClick={() =>
                        setEditing({
                          id: m.id,
                          initial: { marka: m.marka, groupId: m.groupId, tensileStrength: m.tensileStrength },
                        })
                      }
                    />
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </ReferenceList>

      <ReferenceFormModal
        editing={editing}
        onClose={() => setEditing(null)}
        newTitle="Новый материал"
        editTitle="Основной материал"
        save={save}
        validate={(d) => ({
          ...(d.marka.trim() ? {} : { marka: 'Укажите марку' }),
          ...(isBadDecimal(d.tensileStrength) ? { tensileStrength: 'Положительное число, например 45,5' } : {}),
        })}
        prepare={(d) => ({ ...d, marka: d.marka.trim(), tensileStrength: toDecimal(d.tensileStrength) })}
      >
        {({ draft, update, errors }) => (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Марка" required error={errors.marka} className="md:col-span-2">
              {(id, described) => (
                <Input
                  id={id}
                  aria-describedby={described}
                  invalid={Boolean(errors.marka)}
                  value={draft.marka}
                  placeholder="Например, 12Х18Н10Т"
                  onChange={(e) => update({ marka: e.target.value })}
                />
              )}
            </Field>
            <Field label="Группа" error={errors.groupId}>
              {(id, described) => (
                <Select
                  id={id}
                  aria-describedby={described}
                  invalid={Boolean(errors.groupId)}
                  value={draft.groupId ?? ''}
                  disabled={groups.isPending}
                  onChange={(e) =>
                    update({ groupId: e.target.value === '' ? null : Number(e.target.value) })
                  }
                >
                  <option value="">{groups.isPending ? 'Загрузка…' : 'Без группы'}</option>
                  {groups.data?.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.code}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Предел прочности, кгс/мм²" error={errors.tensileStrength}>
              {(id, described) => (
                <Input
                  id={id}
                  aria-describedby={described}
                  invalid={Boolean(errors.tensileStrength)}
                  value={draft.tensileStrength ?? ''}
                  inputMode="decimal"
                  className="font-mono"
                  onChange={(e) => update({ tensileStrength: e.target.value })}
                />
              )}
            </Field>
          </div>
        )}
      </ReferenceFormModal>
    </>
  )
}

/* ---------- Группы материалов ---------- */

export function MaterialGroupsTab({ search, onSearch, canEdit }: TabProps) {
  const groups = useMaterialGroups()
  const materials = useMaterials()
  const save = useSaveMaterialGroup()
  const [editing, setEditing] = useState<Editing<MaterialGroupWrite>>(null)

  const counts = new Map<number, number>()
  for (const m of materials.data ?? [])
    if (m.groupId !== null) counts.set(m.groupId, (counts.get(m.groupId) ?? 0) + 1)

  return (
    <>
      <Toolbar
        search={search}
        onSearch={onSearch}
        placeholder="Поиск по группе"
        action={
          canEdit && (
            <AddButton label="Добавить группу" onClick={() => setEditing({ id: null, initial: { code: '' } })} />
          )
        }
      />
      <ReferenceList
        query={groups}
        search={search}
        text={(g) => g.code}
        emptyTitle="Групп пока нет"
        emptyDescription="Группа объединяет марки со схожей свариваемостью."
      >
        {(items) => (
          <Table>
            <thead>
              <tr>
                <Th>Группа</Th>
                <Th className="text-right">Материалов</Th>
                {canEdit && <ActionsTh />}
              </tr>
            </thead>
            <tbody>
              {items.map((g) => (
                <Tr key={g.id} className="hover:bg-surface-2/60">
                  <Td className="font-mono font-semibold">{g.code}</Td>
                  <Td className="text-right font-mono">{materials.data ? (counts.get(g.id) ?? 0) : '—'}</Td>
                  {canEdit && (
                    <EditCell
                      label={`Изменить «${g.code}»`}
                      onClick={() => setEditing({ id: g.id, initial: { code: g.code } })}
                    />
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </ReferenceList>

      <ReferenceFormModal
        editing={editing}
        onClose={() => setEditing(null)}
        newTitle="Новая группа"
        editTitle="Группа материалов"
        save={save}
        validate={(d): Errors => (d.code.trim() ? {} : { code: 'Укажите группу' })}
        prepare={(d) => ({ code: d.code.trim() })}
      >
        {({ draft, update, errors }) => (
          <Field label="Группа" required error={errors.code}>
            {(id, described) => (
              <Input
                id={id}
                aria-describedby={described}
                invalid={Boolean(errors.code)}
                value={draft.code}
                className="font-mono"
                onChange={(e) => update({ code: e.target.value })}
              />
            )}
          </Field>
        )}
      </ReferenceFormModal>
    </>
  )
}

/* ---------- Сварочные материалы ---------- */

const emptyFiller: FillerMaterialWrite = { marka: '', kind: 'присадочная проволока', diameter: null }

export function FillerMaterialsTab({ search, onSearch, canEdit }: TabProps) {
  const fillers = useFillerMaterials()
  const save = useSaveFillerMaterial()
  const [editing, setEditing] = useState<Editing<FillerMaterialWrite>>(null)

  return (
    <>
      <Toolbar
        search={search}
        onSearch={onSearch}
        placeholder="Поиск по марке"
        action={
          canEdit && (
            <AddButton label="Добавить материал" onClick={() => setEditing({ id: null, initial: emptyFiller })} />
          )
        }
      />
      <ReferenceList
        query={fillers}
        search={search}
        text={(f) => `${f.label} ${fillerKindLabels[f.kind] ?? f.kind}`}
        emptyTitle="Сварочных материалов пока нет"
        emptyDescription="Проволоки и электроды подставляются в техкарты по сочетанию материалов."
      >
        {(items) => (
          <Table>
            <thead>
              <tr>
                <Th>Марка</Th>
                <Th>Тип</Th>
                <Th className="text-right">Диаметр, мм</Th>
                {canEdit && <ActionsTh />}
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <Tr key={f.id} className="hover:bg-surface-2/60">
                  <Td className="font-semibold">{f.marka}</Td>
                  <Td>{fillerKindLabels[f.kind] ?? f.kind}</Td>
                  <Td className="text-right font-mono">{formatNumber(f.diameter)}</Td>
                  {canEdit && (
                    <EditCell
                      label={`Изменить «${f.label}»`}
                      onClick={() =>
                        setEditing({ id: f.id, initial: { marka: f.marka, kind: f.kind, diameter: f.diameter } })
                      }
                    />
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </ReferenceList>

      <ReferenceFormModal
        editing={editing}
        onClose={() => setEditing(null)}
        newTitle="Новый сварочный материал"
        editTitle="Сварочный материал"
        save={save}
        validate={(d) => ({
          ...(d.marka.trim() ? {} : { marka: 'Укажите марку' }),
          ...(isBadDecimal(d.diameter) ? { diameter: 'Положительное число, например 1,2' } : {}),
        })}
        prepare={(d) => ({ ...d, marka: d.marka.trim(), diameter: toDecimal(d.diameter) })}
      >
        {({ draft, update, errors }) => (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Марка" required error={errors.marka} className="md:col-span-2">
              {(id, described) => (
                <Input
                  id={id}
                  aria-describedby={described}
                  invalid={Boolean(errors.marka)}
                  value={draft.marka}
                  placeholder="Например, Св-04Х19Н11М3"
                  onChange={(e) => update({ marka: e.target.value })}
                />
              )}
            </Field>
            <Field label="Тип" required error={errors.kind}>
              {(id, described) => (
                <Select
                  id={id}
                  aria-describedby={described}
                  invalid={Boolean(errors.kind)}
                  value={draft.kind}
                  onChange={(e) => update({ kind: e.target.value as FillerKind })}
                >
                  {Object.entries(fillerKindLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Диаметр, мм" error={errors.diameter}>
              {(id, described) => (
                <Input
                  id={id}
                  aria-describedby={described}
                  invalid={Boolean(errors.diameter)}
                  value={draft.diameter ?? ''}
                  inputMode="decimal"
                  className="font-mono"
                  onChange={(e) => update({ diameter: e.target.value })}
                />
              )}
            </Field>
          </div>
        )}
      </ReferenceFormModal>
    </>
  )
}

/* ---------- Газы и флюсы ---------- */

export function GasFluxTab({ search, onSearch, canEdit }: TabProps) {
  const gasFlux = useGasFlux()
  const save = useSaveGasFlux()
  const [editing, setEditing] = useState<Editing<GasFluxWrite>>(null)

  return (
    <>
      <Toolbar
        search={search}
        onSearch={onSearch}
        placeholder="Поиск по марке"
        action={
          canEdit && (
            <AddButton
              label="Добавить"
              onClick={() => setEditing({ id: null, initial: { kind: 'gas', value: '' } })}
            />
          )
        }
      />
      <ReferenceList
        query={gasFlux}
        search={search}
        text={(g) => g.value}
        emptyTitle="Газов и флюсов пока нет"
      >
        {(items) => (
          <Table>
            <thead>
              <tr>
                <Th>Марка</Th>
                <Th>Тип</Th>
                {canEdit && <ActionsTh />}
              </tr>
            </thead>
            <tbody>
              {items.map((g) => (
                <Tr key={g.id} className="hover:bg-surface-2/60">
                  <Td className="font-semibold">{g.value}</Td>
                  <Td>
                    <Badge tone={g.kind === 'gas' ? 'blue' : 'gray'}>
                      {g.kind === 'gas' ? 'Газ' : 'Флюс'}
                    </Badge>
                  </Td>
                  {canEdit && (
                    <EditCell
                      label={`Изменить «${g.value}»`}
                      onClick={() => setEditing({ id: g.id, initial: { kind: g.kind, value: g.value } })}
                    />
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </ReferenceList>

      <ReferenceFormModal
        editing={editing}
        onClose={() => setEditing(null)}
        newTitle="Новый газ или флюс"
        editTitle="Газ / флюс"
        save={save}
        validate={(d): Errors => (d.value.trim() ? {} : { value: 'Укажите марку' })}
        prepare={(d) => ({ ...d, value: d.value.trim() })}
      >
        {({ draft, update, errors }) => (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Тип" required error={errors.kind}>
              {(id, described) => (
                <Select
                  id={id}
                  aria-describedby={described}
                  invalid={Boolean(errors.kind)}
                  value={draft.kind}
                  onChange={(e) => update({ kind: e.target.value as GasFluxKind })}
                >
                  {Object.entries(gasFluxKindLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Марка" required error={errors.value}>
              {(id, described) => (
                <Input
                  id={id}
                  aria-describedby={described}
                  invalid={Boolean(errors.value)}
                  value={draft.value}
                  placeholder="Например, Аргон высший сорт"
                  onChange={(e) => update({ value: e.target.value })}
                />
              )}
            </Field>
          </div>
        )}
      </ReferenceFormModal>
    </>
  )
}
