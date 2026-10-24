import { Radio } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { useEquipmentList } from '@/features/equipment/queries'
import { buildPosts, type Post } from '@/features/telemetry/posts'
import { PostsTable } from '@/features/telemetry/PostsTable'
import {
  useActiveSessions,
  useCurrentShift,
  useNodes,
  useNodeSummary,
  usePendingDeviations,
} from '@/features/telemetry/queries'
import { shiftText } from '@/features/telemetry/shift'
import { SocketStatusLine } from '@/features/telemetry/SocketStatusLine'
import { useNow } from '@/features/telemetry/useNow'
import { useTelemetrySocket } from '@/features/telemetry/useTelemetrySocket'
import { useSession } from '@/shared/api/session'
import { cn } from '@/shared/lib/cn'
import { Card } from '@/shared/ui/Card'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'

type View = 'all' | 'working' | 'deviations' | 'offline'

const VIEWS: { id: View; label: string; empty: string; emptyHint: string }[] = [
  { id: 'all', label: 'Все', empty: '', emptyHint: '' },
  {
    id: 'working',
    label: 'В работе',
    empty: 'Сейчас никто не работает',
    emptyHint: 'Ни на одном аппарате нет открытого сеанса сварки.',
  },
  {
    id: 'deviations',
    label: 'С отклонениями',
    empty: 'Нерассмотренных отклонений нет',
    emptyHint: 'По идущим сеансам все отклонения разобраны или их не было.',
  },
  {
    id: 'offline',
    label: 'Нет связи',
    empty: 'Все узлы на связи',
    emptyHint: 'Аппараты без узла телеметрии сюда не входят.',
  },
]

const MATCH: Record<View, (p: Post) => boolean> = {
  all: () => true,
  working: (p) => p.session !== null || p.status === 'arc',
  deviations: (p) => p.regimePending + p.orderPending > 0,
  offline: (p) => p.status === 'offline',
}

const isView = (v: string | null): v is View => VIEWS.some((x) => x.id === v)

export function TelemetryPage() {
  const [params, setParams] = useSearchParams()
  const view: View = isView(params.get('view')) ? (params.get('view') as View) : 'all'
  const now = useNow()
  const workshopId = useSession((s) => s.user?.workshopId ?? null)

  const socket = useTelemetrySocket(null)
  const equipment = useEquipmentList({ active: true })
  const nodes = useNodes()
  const summary = useNodeSummary()
  const sessions = useActiveSessions()
  const pending = usePendingDeviations()
  const shift = useCurrentShift(workshopId)

  const queries = [equipment, nodes, sessions, pending]
  const failed = queries.find((q) => q.isError)
  const loading = queries.some((q) => q.isPending)

  const posts = loading
    ? []
    : buildPosts({
        equipment: equipment.data ?? [],
        nodes: nodes.data ?? [],
        sessions: sessions.data ?? [],
        ticks: socket.ticks,
        pending: pending.data ?? [],
        now,
      })
  const visible = posts.filter(MATCH[view])
  const current = VIEWS.find((v) => v.id === view) ?? VIEWS[0]

  let body
  if (failed) body = <ErrorState error={failed.error} onRetry={() => queries.forEach((q) => void q.refetch())} />
  else if (loading) body = <SkeletonRows rows={6} />
  else if (posts.length === 0)
    body = (
      <EmptyState
        icon={<Radio />}
        title="Оборудование не заведено"
        description="Заведите установки в разделе «Оборудование» и укажите узел телеметрии."
      />
    )
  else if (visible.length === 0) body = <EmptyState title={current?.empty ?? ''} description={current?.emptyHint} />
  else body = <PostsTable posts={visible} now={now} />

  const s = summary.data
  const working = posts.filter(MATCH.working).length

  return (
    <>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="mb-1 text-xl font-heading tracking-heading sm:text-2xl">Оборудование в работе</h1>
          <p className="text-nav text-muted">{shiftText(shift.data) ?? 'Смена: загрузка…'}</p>
        </div>
        {s && (
          <dl className="flex gap-6 text-sm">
            <div>
              <dt className="text-xs text-muted">В работе</dt>
              <dd className="font-mono text-xl font-semibold">
                {working} <span className="text-sm font-normal text-muted">из {posts.length}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Узлов на связи</dt>
              <dd className="font-mono text-xl font-semibold">
                {s.online} <span className="text-sm font-normal text-muted">из {s.total}</span>
              </dd>
            </div>
            {s.catchingUp > 0 && (
              <div>
                <dt className="text-xs text-muted">Досылают данные</dt>
                <dd className="font-mono text-xl font-semibold">{s.catchingUp}</dd>
              </div>
            )}
          </dl>
        )}
      </div>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Отбор постов" className="inline-flex rounded-control border border-border p-0.5">
            {VIEWS.map((v) => {
              const count = posts.filter(MATCH[v.id]).length
              const selected = v.id === view
              return (
                <button
                  key={v.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setParams(v.id === 'all' ? {} : { view: v.id }, { replace: true })}
                  className={cn(
                    'rounded-sm px-3 py-1.5 text-sm font-semibold transition-colors',
                    selected ? 'bg-primary-soft text-primary' : 'text-muted hover:text-text',
                  )}
                >
                  {v.label}{' '}
                  <span className={cn('font-mono', v.id === 'deviations' && count > 0 && 'text-danger')}>
                    {loading ? '' : count}
                  </span>
                </button>
              )
            })}
          </div>
          <SocketStatusLine status={socket.status} />
        </div>
        {body}
      </Card>
    </>
  )
}
