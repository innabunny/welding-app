import { Plus, Search, Zap } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { EquipmentFormModal } from '@/features/equipment/EquipmentForm'
import { EquipmentTable } from '@/features/equipment/EquipmentTable'
import { useEquipmentList, useSpeedUnits, useWeldingMethods } from '@/features/equipment/queries'
import { useEquipmentUi } from '@/features/equipment/store'
import { plural } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Checkbox, Input, Select } from '@/shared/ui/Form'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'

export function EquipmentPage() {
  const { search, method, onlyActive, newDraft, setSearch, setMethod, setOnlyActive } =
    useEquipmentUi()
  // undefined — форма закрыта, null — новая установка
  const [editingId, setEditingId] = useState<number | null | undefined>(undefined)

  const list = useEquipmentList({ method: method || undefined, active: onlyActive })
  const methods = useWeldingMethods()
  const speedUnits = useSpeedUnits()

  // поиска на бэке нет — фильтруем загруженный список
  const query = useDeferredValue(search.trim().toLowerCase())
  const items = (list.data ?? []).filter((e) => !query || e.name.toLowerCase().includes(query))
  const filtered = Boolean(query || method || onlyActive)

  let body
  if (list.isPending) body = <SkeletonRows rows={6} />
  else if (list.isError) body = <ErrorState error={list.error} onRetry={() => list.refetch()} />
  else if (items.length === 0)
    body = filtered ? (
      <EmptyState title="Ничего не найдено" description="Измените поиск или сбросьте фильтры." />
    ) : (
      <EmptyState
        icon={<Zap />}
        title="Установок пока нет"
        description="Заведите первую установку — к ней будут привязаны техкарты и телеметрия."
        action={
          <Button icon={<Plus />} onClick={() => setEditingId(null)}>
            Добавить установку
          </Button>
        }
      />
    )
  else body = <EquipmentTable items={items} speedUnits={speedUnits.data ?? []} onEdit={setEditingId} />

  return (
    <>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="mb-1 text-xl font-heading tracking-heading sm:text-2xl">Оборудование</h1>
          <p className="text-nav text-muted">
            {list.data
              ? `${list.data.length} ${plural(list.data.length, ['установка', 'установки', 'установок'])} в реестре`
              : 'Реестр сварочных установок'}
          </p>
        </div>
        <Button icon={<Plus />} onClick={() => setEditingId(null)}>
          {newDraft ? 'Продолжить черновик' : 'Добавить установку'}
        </Button>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              type="search"
              aria-label="Поиск по названию"
              placeholder="Поиск по названию"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="w-full md:w-[260px]">
            <Select
              aria-label="Способ сварки"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="">Все способы сварки</option>
              {methods.data?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.designation ? `${m.designation} — ${m.name}` : m.name}
                </option>
              ))}
            </Select>
          </div>
          <Checkbox
            label="Только в работе"
            checked={onlyActive}
            onChange={(e) => setOnlyActive(e.target.checked)}
          />
        </div>
        {body}
      </Card>

      <EquipmentFormModal editingId={editingId} onClose={() => setEditingId(undefined)} />
    </>
  )
}
