import { Activity, Search } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { useNavigate } from 'react-router'
import { useParts } from '@/features/parts/queries'
import { weldStatusMeta } from '@/features/welds/labels'
import { useWeldList } from '@/features/welds/queries'
import { formatNumber, formatWhen, plural } from '@/shared/lib/format'
import type { WeldFilters, WeldStatus } from '@/shared/types/welding'
import { Badge } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import { Input, Select } from '@/shared/ui/Form'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'
import { Table, Td, Th, Tr } from '@/shared/ui/Table'

function thickness(t1: string | null, t2: string | null): string {
  if (t2 === null || t2 === t1) return formatNumber(t1, 2)
  return `${formatNumber(t1, 2)} / ${formatNumber(t2, 2)}`
}

export function WeldsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<WeldFilters>({ search: '', part: '', status: '' })
  // поиск идёт на сервер — не дёргаем его на каждую букву
  const deferred = useDeferredValue(filters)
  const welds = useWeldList(deferred)
  const parts = useParts({})
  const set = (patch: Partial<WeldFilters>) => setFilters((f) => ({ ...f, ...patch }))
  const filtered = Object.values(filters).some(Boolean)

  let body
  if (welds.isPending) body = <SkeletonRows rows={6} />
  else if (welds.isError) body = <ErrorState error={welds.error} onRetry={() => welds.refetch()} />
  else if (welds.data.length === 0)
    body = filtered ? (
      <EmptyState title="Ничего не найдено" description="Измените поиск или сбросьте фильтры." />
    ) : (
      <EmptyState
        icon={<Activity />}
        title="Сваренных швов пока нет"
        description="Шов появляется здесь с первой выполненной операцией на изделии — его заводит портал по данным с установки."
      />
    )
  else
    body = (
      <Table>
        <thead>
          <tr>
            <Th>Изделие</Th>
            <Th>Шов</Th>
            <Th className="text-right">Толщина, мм</Th>
            <Th>Статус</Th>
            <Th className="text-right">Операций</Th>
            <Th>Заведён</Th>
          </tr>
        </thead>
        <tbody>
          {welds.data.map((w) => (
            <Tr key={w.id} className="cursor-pointer hover:bg-surface-2/60" onClick={() => navigate(`/welds/${w.id}`)}>
              <Td>
                {/* ссылка — чтобы паспорт открывался с клавиатуры и в новой вкладке */}
                <a
                  href={`/welds/${w.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    navigate(`/welds/${w.id}`)
                  }}
                  className="font-mono font-semibold hover:text-primary"
                >
                  {w.partNumber} № {w.serialNo}
                </a>
              </Td>
              <Td className="font-mono">{w.seamNumber}</Td>
              <Td className="text-right font-mono">{thickness(w.seamThickness1, w.seamThickness2)}</Td>
              <Td>
                <Badge tone={weldStatusMeta[w.status].tone}>{weldStatusMeta[w.status].label}</Badge>
              </Td>
              <Td className="text-right font-mono">{w.runsCount}</Td>
              <Td className="whitespace-nowrap">{formatWhen(w.createdAt)}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    )

  return (
    <>
      <div className="mb-[22px]">
        <h1 className="mb-1 text-xl font-heading tracking-heading sm:text-2xl">Сварные швы</h1>
        <p className="text-nav text-muted">
          {welds.data
            ? `${welds.data.length} ${plural(welds.data.length, ['шов', 'шва', 'швов'])}${filtered ? ' по фильтру' : ''}`
            : 'Паспорта швов: кто, чем и по какой карте варил, что показал контроль'}
        </p>
      </div>
      <Card className="p-5">
        <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              type="search"
              aria-label="Поиск"
              placeholder="Заводской номер, деталь или № шва"
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
          <Select aria-label="Статус" value={filters.status} onChange={(e) => set({ status: e.target.value as WeldStatus | '' })}>
            <option value="">Все статусы</option>
            {(Object.keys(weldStatusMeta) as WeldStatus[]).map((s) => (
              <option key={s} value={s}>
                {weldStatusMeta[s].label}
              </option>
            ))}
          </Select>
        </div>
        {body}
      </Card>
    </>
  )
}
