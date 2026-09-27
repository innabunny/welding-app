import { AlignLeft, Plus, Search } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { useNavigate } from 'react-router'
import { canEditTechnology } from '@/features/auth/roles'
import { emptyPart } from '@/features/parts/defaults'
import { PartFormModal } from '@/features/parts/PartFormModal'
import { useParts } from '@/features/parts/queries'
import { useSession } from '@/shared/api/session'
import { plural } from '@/shared/lib/format'
import type { PartWrite } from '@/shared/types/technology'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Checkbox, Input } from '@/shared/ui/Form'
import type { Editing } from '@/shared/ui/FormModal'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'
import { Table, Td, Th, Tr } from '@/shared/ui/Table'

export function PartsPage() {
  const navigate = useNavigate()
  const canEdit = useSession((s) => canEditTechnology(s.user?.role))
  const [search, setSearch] = useState('')
  const [active, setActive] = useState(false)
  const [withoutCards, setWithoutCards] = useState(false)
  const [editing, setEditing] = useState<Editing<PartWrite>>(null)

  // поиск идёт на сервер — не дёргаем его на каждую букву
  const deferredSearch = useDeferredValue(search)
  const parts = useParts({ search: deferredSearch, active, withoutCards })
  const filtered = Boolean(search.trim() || active || withoutCards)
  const add = () => setEditing({ id: null, initial: emptyPart })

  let body
  if (parts.isPending) body = <SkeletonRows rows={6} />
  else if (parts.isError) body = <ErrorState error={parts.error} onRetry={() => parts.refetch()} />
  else if (parts.data.length === 0)
    body = filtered ? (
      <EmptyState title="Ничего не найдено" description="Измените поиск или снимите отметки фильтров." />
    ) : (
      <EmptyState
        icon={<AlignLeft />}
        title="Деталей пока нет"
        description="Деталь — чертёж, по которому варят серию. К ней заводятся швы и операции, на операции — техкарты."
        action={
          canEdit && (
            <Button icon={<Plus />} onClick={add}>
              Добавить деталь
            </Button>
          )
        }
      />
    )
  else
    body = (
      <Table>
        <thead>
          <tr>
            <Th>№ по чертежу</Th>
            <Th>Наименование</Th>
            <Th>Чертёж</Th>
            <Th className="text-right">Швов</Th>
            <Th className="text-right">Операций</Th>
            <Th>Статус</Th>
          </tr>
        </thead>
        <tbody>
          {parts.data.map((p) => (
            <Tr key={p.id} className="cursor-pointer hover:bg-surface-2/60" onClick={() => navigate(`/parts/${p.id}`)}>
              <Td>
                {/* ссылка — чтобы деталь открывалась с клавиатуры и в новой вкладке */}
                <a
                  href={`/parts/${p.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    navigate(`/parts/${p.id}`)
                  }}
                  className="font-mono font-semibold hover:text-primary"
                >
                  {p.number}
                </a>
              </Td>
              <Td>{p.name}</Td>
              <Td className="font-mono text-xs">{p.drawingNo || <span className="text-muted">—</span>}</Td>
              <Td className="text-right font-mono">{p.seamsCount}</Td>
              <Td className="text-right font-mono">{p.operationsCount}</Td>
              <Td>
                <Badge tone={p.isActive ? 'green' : 'gray'}>{p.isActive ? 'В производстве' : 'Снята'}</Badge>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    )

  return (
    <>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="mb-1 text-xl font-heading tracking-heading sm:text-2xl">Детали и операции</h1>
          <p className="text-nav text-muted">
            {parts.data
              ? `${parts.data.length} ${plural(parts.data.length, ['деталь', 'детали', 'деталей'])}${filtered ? ' по фильтру' : ''}`
              : 'Детали по чертежам, их швы и техпроцесс'}
          </p>
        </div>
        {canEdit && (
          <Button icon={<Plus />} onClick={add}>
            Добавить деталь
          </Button>
        )}
      </div>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="relative min-w-[220px] flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              type="search"
              aria-label="Поиск по номеру, наименованию или чертежу"
              placeholder="Номер, наименование или чертёж"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Checkbox label="Только в производстве" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <Checkbox
            label="Есть операции без техкарты"
            checked={withoutCards}
            onChange={(e) => setWithoutCards(e.target.checked)}
          />
        </div>
        {body}
      </Card>

      <PartFormModal editing={editing} onClose={() => setEditing(null)} onCreated={(id) => navigate(`/parts/${id}`)} />
    </>
  )
}
