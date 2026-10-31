import { ArrowLeft, Radio, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { useWelders } from '@/features/attestation/queries'
import { useEquipmentList } from '@/features/equipment/queries'
import { ActiveTable } from '@/features/telemetry/ActiveTable'
import { OfflineTable } from '@/features/telemetry/OfflineTable'
import { buildPosts, type Post } from '@/features/telemetry/posts'
import { useActiveSessions, useNodes, usePendingDeviations } from '@/features/telemetry/queries'
import { useNow } from '@/features/telemetry/useNow'
import { useTelemetrySocket } from '@/features/telemetry/useTelemetrySocket'
import { paths } from '@/layouts/navigation'
import { cn } from '@/shared/lib/cn'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'

type View = 'working' | 'out' | 'offline'

const VIEWS: { id: View; label: string }[] = [
  { id: 'working', label: 'Все в работе' },
  { id: 'out', label: 'Вне допуска сейчас' },
  { id: 'offline', label: 'Нет связи' },
]

const MATCH: Record<View, (p: Post) => boolean> = {
  working: (p) => p.session !== null,
  out: (p) => p.outNow,
  offline: (p) => p.status === 'offline',
}

const isView = (v: string | null): v is View => VIEWS.some((x) => x.id === v)

/** Фильтры живут в адресе: ссылку на отбор можно переслать */
const FILTERS = ['workshop', 'method', 'equipment', 'welder'] as const
type Filter = (typeof FILTERS)[number]

const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'))

export function TelemetryPage() {
  const [params, setParams] = useSearchParams()
  const view: View = isView(params.get('view')) ? (params.get('view') as View) : 'working'
  const filter = (f: Filter) => params.get(f) ?? ''
  const setParam = (key: Filter | 'view', value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  const setFilter = (f: Filter, value: string) => setParam(f, value)
  const setView = (v: View) => setParam('view', v === 'working' ? '' : v)
  const now = useNow()

  const socket = useTelemetrySocket(null)
  const equipment = useEquipmentList({ active: true })
  const nodes = useNodes()
  const sessions = useActiveSessions()
  const pending = usePendingDeviations()
  const welders = useWelders({ active: true })

  const queries = [equipment, nodes, sessions, pending]
  const failed = queries.find((q) => q.isError)
  const loading = queries.some((q) => q.isPending)

  const all = loading
    ? []
    : buildPosts({
        equipment: equipment.data ?? [],
        nodes: nodes.data ?? [],
        sessions: sessions.data ?? [],
        ticks: socket.ticks,
        pending: pending.data ?? [],
        now,
      })

  const methodOf = (p: Post) => p.equipment.methodDesignation || p.equipment.methodName
  const posts = all.filter(
    (p) =>
      (!filter('workshop') || p.equipment.workshopName === filter('workshop')) &&
      (!filter('method') || methodOf(p) === filter('method')) &&
      (!filter('equipment') || String(p.equipment.id) === filter('equipment')) &&
      // отбор по сварщику — только среди тех, кто сейчас в сеансе
      (!filter('welder') || String(p.session?.welderId ?? '') === filter('welder')),
  )
  const visible = posts.filter(MATCH[view])
  const count = (v: View) => posts.filter(MATCH[v]).length
  const working = count('working')
  const offline = count('offline')
  const anyFilter = FILTERS.some((f) => filter(f))

  let body
  if (failed) body = <ErrorState error={failed.error} onRetry={() => queries.forEach((q) => void q.refetch())} />
  else if (loading) body = <SkeletonRows rows={6} />
  else if (all.length === 0)
    body = (
      <EmptyState
        icon={<Radio />}
        title="Оборудование не заведено"
        description="Заведите установки в разделе «Оборудование» и укажите узел телеметрии."
      />
    )
  else if (view === 'offline') body = <OfflineTable posts={visible} />
  else
    body = (
      <ActiveTable
        posts={visible}
        inWork={working}
        total={posts.length}
        idle={Math.max(0, posts.length - working - offline)}
        offline={offline}
        emptyText={view === 'out' ? 'Сейчас всё в допуске.' : undefined}
        now={now}
      />
    )

  // фильтр подсвечен рамкой, когда выбран — как в референсе
  const select = (on: boolean) =>
    cn(
      'h-9 w-full min-w-0 rounded-[6px] bg-panel2 px-2 text-[14px] text-fg ring-1 hover:ring-fg2/50 focus-visible:ring-arc sm:w-auto lg:max-w-[14rem] lg:flex-1',
      on ? 'ring-fg/70' : 'ring-line',
    )
  const tab = (on: boolean) =>
    cn(
      'whitespace-nowrap rounded-[6px] px-3 py-1.5 text-[14px]',
      on ? 'bg-panel2 text-fg ring-1 ring-line' : 'text-fg2 hover:text-fg',
    )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          to={paths.telemetry}
          className="inline-flex w-fit items-center gap-2 rounded-[6px] px-2 py-1.5 text-fg2 ring-1 ring-line hover:bg-panel2 hover:text-fg"
        >
          <ArrowLeft className="size-5" aria-hidden />
          Сводка
        </Link>
        <h1 className="font-cond text-[30px] font-semibold leading-tight text-fg sm:text-[36px]">Оборудование в работе</h1>
      </div>

      <section
        aria-label="Фильтры"
        className="flex flex-wrap items-center gap-2 rounded-[8px] bg-panel px-3 py-2 ring-1 ring-line lg:flex-nowrap"
      >
        <select aria-label="Цех" className={select(!!filter('workshop'))} value={filter('workshop')} onChange={(e) => setFilter('workshop', e.target.value)}>
          <option value="">Все цеха</option>
          {unique(all.map((p) => p.equipment.workshopName)).map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
        <select aria-label="Тип оборудования" className={select(!!filter('method'))} value={filter('method')} onChange={(e) => setFilter('method', e.target.value)}>
          <option value="">Все типы</option>
          {unique(all.map(methodOf)).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select aria-label="Оборудование" className={select(!!filter('equipment'))} value={filter('equipment')} onChange={(e) => setFilter('equipment', e.target.value)}>
          <option value="">Всё оборудование</option>
          {all.map((p) => (
            <option key={p.equipment.id} value={p.equipment.id}>
              {p.equipment.name}
            </option>
          ))}
        </select>
        <select aria-label="Сварщик" className={select(!!filter('welder'))} value={filter('welder')} onChange={(e) => setFilter('welder', e.target.value)}>
          <option value="">Все сварщики</option>
          {(welders.data ?? []).map((w) => (
            <option key={w.id} value={w.id}>
              {w.fio}
            </option>
          ))}
        </select>
        {anyFilter && (
          <button
            type="button"
            onClick={() => FILTERS.forEach((f) => setFilter(f, ''))}
            aria-label="Сбросить фильтры"
            title="Сбросить цех, тип, оборудование и сварщика"
            className="ml-auto inline-flex size-9 shrink-0 items-center justify-center rounded-[6px] text-fg2 ring-1 ring-line hover:bg-panel2 hover:text-fg"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </section>

      <div role="group" aria-label="Отбор" className="flex w-fit gap-1 rounded-[8px] bg-panel p-1 ring-1 ring-line">
        {VIEWS.map((v) => {
          const n = count(v.id)
          return (
            <button key={v.id} type="button" aria-pressed={v.id === view} className={tab(v.id === view)} onClick={() => setView(v.id)}>
              {v.label}{' '}
              <span className={cn('tnum font-mono', v.id === 'out' && n > 0 ? 'text-crit/80' : 'text-fg2')}>
                {loading ? '' : n}
              </span>
            </button>
          )
        })}
      </div>

      {body}
    </div>
  )
}
