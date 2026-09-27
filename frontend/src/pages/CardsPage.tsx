import { FileText, Plus, Search } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { useNavigate } from 'react-router'
import { useEquipmentList, useWeldingMethods } from '@/features/equipment/queries'
import { useMaterials } from '@/features/materials/queries'
import { CardTable } from '@/features/weldingCards/CardTable'
import { useParts, useWeldingCards } from '@/features/weldingCards/queries'
import { processLabels } from '@/shared/config/processes'
import { plural } from '@/shared/lib/format'
import type { WeldingCardFilters } from '@/shared/types/weldingCards'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { DecimalInput } from '@/shared/ui/DecimalInput'
import { Input, Select } from '@/shared/ui/Form'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'

const emptyFilters: WeldingCardFilters = {
  search: '',
  part: '',
  method: '',
  process: '',
  equipment: '',
  material: '',
  thicknessFrom: '',
  thicknessTo: '',
  released: '',
}

export function CardsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<WeldingCardFilters>(emptyFilters)
  // поиск идёт на сервер — не дёргаем его на каждую букву
  const deferred = useDeferredValue(filters)
  const list = useWeldingCards(deferred)

  const parts = useParts()
  const methods = useWeldingMethods()
  const equipment = useEquipmentList({})
  const materials = useMaterials()

  const set = (patch: Partial<WeldingCardFilters>) => setFilters((prev) => ({ ...prev, ...patch }))
  const filtered = Object.values(filters).some((v) => v)
  const newCard = () => navigate('/cards/new')

  let body
  if (list.isPending) body = <SkeletonRows rows={6} />
  else if (list.isError) body = <ErrorState error={list.error} onRetry={() => list.refetch()} />
  else if (list.data.length === 0)
    body = filtered ? (
      <EmptyState
        title="Ничего не найдено"
        description="Измените поиск или сбросьте фильтры."
        action={
          <Button variant="secondary" onClick={() => setFilters(emptyFilters)}>
            Сбросить фильтры
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={<FileText />}
        title="Карт пока нет"
        description="Карта описывает режим одной операции. Нужна деталь с операцией и швом."
        action={
          <Button icon={<Plus />} onClick={newCard}>
            Новая карта
          </Button>
        }
      />
    )
  else body = <CardTable items={list.data} />

  return (
    <>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="mb-1 text-xl font-heading tracking-heading sm:text-2xl">Технологические карты</h1>
          <p className="text-nav text-muted">
            {list.data
              ? `${list.data.length} ${plural(list.data.length, ['карта', 'карты', 'карт'])}${filtered ? ' по фильтру' : ''}`
              : 'Режимы сварки по операциям'}
          </p>
        </div>
        <Button icon={<Plus />} onClick={newCard}>
          Новая карта
        </Button>
      </div>

      <Card className="p-5">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              type="search"
              aria-label="Поиск"
              placeholder="№ карты, деталь или марка материала"
              value={filters.search}
              onChange={(e) => set({ search: e.target.value })}
              className="pl-9"
            />
          </div>
          <Select aria-label="Деталь" value={filters.part} onChange={(e) => set({ part: e.target.value })}>
            <option value="">Все детали</option>
            {parts.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number} — {p.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Статус"
            value={filters.released}
            onChange={(e) => set({ released: e.target.value as WeldingCardFilters['released'] })}
          >
            <option value="">Выпущенные и черновики</option>
            <option value="1">Только выпущенные</option>
            <option value="0">Только черновики</option>
          </Select>
          <Select aria-label="Процесс" value={filters.process} onChange={(e) => set({ process: e.target.value })}>
            <option value="">Все процессы</option>
            {Object.entries(processLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select aria-label="Способ сварки" value={filters.method} onChange={(e) => set({ method: e.target.value })}>
            <option value="">Все способы</option>
            {methods.data
              ?.filter((m) => !filters.process || m.process === filters.process)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.designation ? `${m.designation} — ${m.name}` : m.name}
                </option>
              ))}
          </Select>
          <Select
            aria-label="Оборудование"
            value={filters.equipment}
            onChange={(e) => set({ equipment: e.target.value })}
          >
            <option value="">Всё оборудование</option>
            {equipment.data?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Материал" value={filters.material} onChange={(e) => set({ material: e.target.value })}>
            <option value="">Все материалы</option>
            {materials.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.marka}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:col-span-2 lg:col-span-1">
            <span className="text-xs text-muted">Толщина</span>
            <DecimalInput
              aria-label="Толщина от, мм"
              placeholder="от"
              digits={7}
              places={2}
              value={filters.thicknessFrom || null}
              onChange={(v) => set({ thicknessFrom: v ?? '' })}
            />
            <span aria-hidden className="text-muted">
              –
            </span>
            <DecimalInput
              aria-label="Толщина до, мм"
              placeholder="до"
              digits={7}
              places={2}
              value={filters.thicknessTo || null}
              onChange={(v) => set({ thicknessTo: v ?? '' })}
            />
          </div>
          {filtered && (
            <Button variant="ghost" onClick={() => setFilters(emptyFilters)} className="justify-self-start">
              Сбросить фильтры
            </Button>
          )}
        </div>
        {body}
      </Card>
    </>
  )
}
