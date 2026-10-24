import { ArrowLeft, Monitor, MonitorOff } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useEquipment } from '@/features/equipment/queries'
import { PostStatusBadge } from '@/features/telemetry/Badges'
import { formatStart, secondsSince } from '@/features/telemetry/format'
import { LivePanel, type LiveTolerance } from '@/features/telemetry/LivePanel'
import { range } from '@/features/telemetry/plan'
import { buildPosts, STALE_SESSION_SECONDS } from '@/features/telemetry/posts'
import { useEquipmentSessions, useNodes, useSessionArcs } from '@/features/telemetry/queries'
import { SessionView } from '@/features/telemetry/SessionView'
import { useNow } from '@/features/telemetry/useNow'
import { useStationMode } from '@/features/telemetry/useStationMode'
import { useTelemetrySocket } from '@/features/telemetry/useTelemetrySocket'
import { paths } from '@/layouts/navigation'
import { cn } from '@/shared/lib/cn'
import type { WeldingSession } from '@/shared/types/welding'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Form'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'

/** Сколько прошлых сеансов предлагать в выборе */
const SESSION_CHOICES = 30

const newestFirst = (a: WeldingSession, b: WeldingSession) => Date.parse(b.startedAt) - Date.parse(a.startedAt)

export function EquipmentTelemetryPage() {
  const params = useParams()
  const equipmentId = Number(params.id) || null
  const [search, setSearch] = useSearchParams()
  const chosen = Number(search.get('session')) || null
  const [station, toggleStation] = useStationMode()
  const now = useNow()

  const equipment = useEquipment(equipmentId)
  const nodes = useNodes()
  const sessions = useEquipmentSessions(equipmentId)
  const socket = useTelemetrySocket(equipment.data ? (equipment.data.nodeId ?? undefined) : undefined)
  // идущий сеанс (не забытый незакрытый) — для допуска под живыми цифрами
  const liveSession =
    [...(sessions.data ?? [])]
      .sort(newestFirst)
      .find((x) => x.finishedAt === null && (secondsSince(x.startedAt, now) ?? 0) <= STALE_SESSION_SECONDS) ?? null
  const liveArcs = useSessionArcs(liveSession?.id ?? null, true)

  if (equipment.isError) return <ErrorState error={equipment.error} onRetry={() => void equipment.refetch()} />
  if (!equipment.data) return <SkeletonRows rows={5} />
  const e = equipment.data

  const list = [...(sessions.data ?? [])].sort(newestFirst)
  // по умолчанию — идущий сеанс, а если его нет, последний закрытый
  const session = list.find((s) => s.id === chosen) ?? list.find((s) => s.finishedAt === null) ?? list[0] ?? null

  // допуск для живых цифр — только у идущего сеанса: проход последнего участка дуги
  const lastArc = liveArcs.data?.at(-1)
  const livePass = liveSession && lastArc ? (liveSession.passPlan.find((p) => p.id === lastArc.plannedPassId) ?? null) : null
  const tolerance: LiveTolerance | null = liveSession
    ? liveSession.passPlan.length === 0
      ? { passNo: null, current: null, voltage: null }
      : livePass
        ? { passNo: lastArc?.passNo ?? livePass.no, current: range(livePass.currentMin, livePass.currentMax), voltage: range(livePass.voltageMin, livePass.voltageMax) }
        : null
    : null

  const post = buildPosts({
    equipment: [e],
    nodes: nodes.data ?? [],
    sessions: list,
    ticks: socket.ticks,
    pending: [],
    now,
  })[0]

  return (
    // режим у станка — тёмная палитра только на этом экране, тема портала не трогается
    <div
      data-theme={station ? 'dark' : undefined}
      className={cn(station && 'rounded-card bg-bg p-4 text-text md:p-6')}
    >
      <Link to={paths.telemetry} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
        <ArrowLeft className="size-4" aria-hidden />
        Оборудование в работе
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className={cn('font-heading tracking-heading', station ? 'text-3xl' : 'text-xl sm:text-2xl')}>{e.name}</h1>
          {post && <PostStatusBadge status={post.status} />}
          {e.nodeId && <span className="font-mono text-xs text-muted">{e.nodeId}</span>}
        </div>
        <Button variant="secondary" icon={station ? <MonitorOff /> : <Monitor />} onClick={toggleStation}>
          {station ? 'Обычный вид' : 'Режим у станка'}
        </Button>
      </div>

      <div className="grid gap-5 [&>*]:min-w-0">
        {post && <LivePanel post={post} socketStatus={socket.status} now={now} large={station} tolerance={tolerance} />}

        {sessions.isError ? (
          <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />
        ) : sessions.isPending ? (
          <SkeletonRows rows={3} />
        ) : session === null ? (
          <EmptyState
            title="Сеансов на этом аппарате ещё не было"
            description="Сеанс открывается, когда сварщик авторизуется на узле. Тогда здесь появятся сварщик, режим работы и график."
          />
        ) : (
          <>
            {list.length > 1 && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted">Сеанс</span>
                <div className="w-full sm:w-[380px]">
                  <Select
                    aria-label="Сеанс"
                    value={String(session.id)}
                    onChange={(ev) => setSearch({ session: ev.target.value }, { replace: true })}
                  >
                    {list.slice(0, SESSION_CHOICES).map((s) => (
                      <option key={s.id} value={s.id}>
                        {`${formatStart(s.startedAt, now)} · ${s.welderName || 'сварщик не опознан'} · ${
                          s.finishedAt === null
                            ? (secondsSince(s.startedAt, now) ?? 0) > STALE_SESSION_SECONDS
                              ? 'не закрыт'
                              : 'идёт'
                            : s.modeDisplay || s.mode
                        }`}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            )}
            <SessionView key={session.id} session={session} now={now} large={station} />
          </>
        )}
      </div>
    </div>
  )
}
