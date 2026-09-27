import { History, Inbox, Plus, Search } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { useEquipmentList } from '@/features/equipment/queries'
import { CloseRequestModal, type Outcome } from '@/features/service/CloseRequestModal'
import { CreateRequestModal } from '@/features/service/CreateRequestModal'
import { HistoryTable } from '@/features/service/HistoryTable'
import { priorities } from '@/features/service/labels'
import { usePatchServiceRequest, useServiceRequests } from '@/features/service/queries'
import { RequestCard } from '@/features/service/RequestCard'
import { errorMessage } from '@/shared/api/errors'
import { useSession } from '@/shared/api/session'
import { cn } from '@/shared/lib/cn'
import { plural } from '@/shared/lib/format'
import { toast } from '@/shared/lib/toast'
import type { ServicePriority, ServiceRequest, ServiceStatus } from '@/shared/types/service'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input, Select } from '@/shared/ui/Form'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'

const PRIORITY_ORDER: Record<ServicePriority, number> = { высокая: 0, средняя: 1, низкая: 2 }

/** Сначала срочные, внутри — старые: дольше ждут */
function byUrgency(a: ServiceRequest, b: ServiceRequest): number {
  return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.createdAt.localeCompare(b.createdAt)
}

export function ServicePage() {
  const role = useSession((s) => s.user?.role)
  // механик и администратор ведут заявки; мастер по умолчанию смотрит свои
  const canHandle = role === 'mechanic' || role === 'admin'
  const [mine, setMine] = useState(role === 'master')
  const [creating, setCreating] = useState(false)
  const [closing, setClosing] = useState<{ request: ServiceRequest; outcome: Outcome } | null>(null)

  const [search, setSearch] = useState('')
  const [equipment, setEquipment] = useState('')
  const [priority, setPriority] = useState<ServicePriority | ''>('')
  const [status, setStatus] = useState<Extract<ServiceStatus, 'done' | 'rejected'> | ''>('')
  const deferredSearch = useDeferredValue(search)

  const open = useServiceRequests({ open: true, mine })
  const history = useServiceRequests({ status, equipment, priority, mine, search: deferredSearch })
  const equipmentList = useEquipmentList({})
  const take = usePatchServiceRequest()

  // без фильтра по статусу сервер отдаёт и открытые — в истории их не показываем
  const closed = (history.data ?? []).filter((r) => !r.isOpen)
  const openItems = [...(open.data ?? [])].sort(byUrgency)
  const historyFiltered = Boolean(search || equipment || priority || status)

  const takeInWork = (r: ServiceRequest) =>
    take.mutate(
      { id: r.id, body: { status: 'in_work' } },
      {
        onSuccess: () => toast(`«${r.equipmentName}» — в работе`),
        onError: (error) => toast(errorMessage(error), 'error'),
      },
    )

  let openBody
  if (open.isPending) openBody = <SkeletonRows rows={2} className="md:grid-cols-2" />
  else if (open.isError) openBody = <ErrorState error={open.error} onRetry={() => open.refetch()} />
  else if (openItems.length === 0)
    openBody = (
      <EmptyState
        icon={<Inbox />}
        title="Открытых заявок нет"
        description={mine ? 'Все ваши заявки закрыты.' : 'Всё оборудование в порядке — или о поломке ещё не сообщили.'}
        action={
          <Button icon={<Plus />} onClick={() => setCreating(true)}>
            Подать заявку
          </Button>
        }
      />
    )
  else
    openBody = (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {openItems.map((r) => (
          <RequestCard
            key={r.id}
            request={r}
            canHandle={canHandle}
            busy={take.isPending && take.variables?.id === r.id}
            onTake={() => takeInWork(r)}
            onClose={(outcome) => setClosing({ request: r, outcome })}
          />
        ))}
      </div>
    )

  let historyBody
  if (history.isPending) historyBody = <SkeletonRows rows={4} />
  else if (history.isError) historyBody = <ErrorState error={history.error} onRetry={() => history.refetch()} />
  else if (closed.length === 0)
    historyBody = (
      <EmptyState
        icon={<History />}
        title={historyFiltered ? 'Ничего не найдено' : 'Закрытых заявок пока нет'}
        description={historyFiltered ? 'Измените поиск или сбросьте фильтры.' : 'Сюда попадут выполненные и отклонённые заявки.'}
      />
    )
  else historyBody = <HistoryTable items={closed} />

  return (
    <>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-xl font-heading tracking-heading sm:text-2xl">Заявки на обслуживание</h1>
          <p className="text-nav text-muted">
            {open.data
              ? openItems.length > 0
                ? `${openItems.length} ${plural(openItems.length, ['открытая заявка', 'открытые заявки', 'открытых заявок'])}`
                : 'Открытых заявок нет'
              : 'Неисправности и обслуживание установок'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Чьи заявки" className="flex rounded-control border border-border bg-surface p-0.5">
            {[
              { value: false, label: 'Все' },
              { value: true, label: 'Мои заявки' },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                aria-pressed={mine === opt.value}
                onClick={() => setMine(opt.value)}
                className={cn(
                  'h-8 rounded-[8px] px-3 text-sm font-semibold transition-colors',
                  mine === opt.value ? 'bg-primary-soft text-primary' : 'text-muted hover:text-text',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button icon={<Plus />} onClick={() => setCreating(true)}>
            Новая заявка
          </Button>
        </div>
      </div>

      <section aria-labelledby="open-heading" className="mb-8">
        <h2 id="open-heading" className="mb-3 text-lg font-heading">
          Открытые
        </h2>
        {openBody}
      </section>

      <section aria-labelledby="history-heading">
        <Card className="p-5">
          <h2 id="history-heading" className="mb-4 text-lg font-heading">
            История
          </h2>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <Input
                type="search"
                aria-label="Поиск по установке и описанию"
                placeholder="Установка или описание"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select aria-label="Установка" value={equipment} onChange={(e) => setEquipment(e.target.value)}>
              <option value="">Все установки</option>
              {equipmentList.data?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Срочность"
              value={priority}
              onChange={(e) => setPriority(e.target.value as ServicePriority | '')}
            >
              <option value="">Любая срочность</option>
              {priorities.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Исход"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'done' | 'rejected' | '')}
            >
              <option value="">Выполненные и отклонённые</option>
              <option value="done">Только выполненные</option>
              <option value="rejected">Только отклонённые</option>
            </Select>
          </div>
          {historyBody}
        </Card>
      </section>

      <CreateRequestModal open={creating} onClose={() => setCreating(false)} />
      <CloseRequestModal
        request={closing?.request ?? null}
        initialOutcome={closing?.outcome ?? 'done'}
        onClose={() => setClosing(null)}
      />
    </>
  )
}
