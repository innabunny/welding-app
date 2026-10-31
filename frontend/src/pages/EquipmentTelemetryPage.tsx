import { ArrowLeft, WifiOff } from 'lucide-react'
import { useNavigate, useParams } from 'react-router'
import { useEquipment } from '@/features/equipment/queries'
import { PostStateChip } from '@/features/telemetry/Badges'
import { LivePanel } from '@/features/telemetry/LivePanel'
import { buildPosts } from '@/features/telemetry/posts'
import { useEquipmentSessions, useNodes } from '@/features/telemetry/queries'
import { SessionView } from '@/features/telemetry/SessionView'
import { activePath } from '@/features/telemetry/routes'
import { useNow } from '@/features/telemetry/useNow'
import { useTelemetrySocket } from '@/features/telemetry/useTelemetrySocket'
import type { WeldingSession } from '@/shared/types/welding'
import { ErrorState, SkeletonRows } from '@/shared/ui/States'

const newestFirst = (a: WeldingSession, b: WeldingSession) => Date.parse(b.startedAt) - Date.parse(a.startedAt)

/** Экран одного аппарата — по референсу заказчика (docs/telemetry-demo.html) */
export function EquipmentTelemetryPage() {
  const params = useParams()
  const navigate = useNavigate()
  const equipmentId = Number(params.id) || null
  const now = useNow()

  const equipment = useEquipment(equipmentId)
  const nodes = useNodes()
  const sessions = useEquipmentSessions(equipmentId)
  const socket = useTelemetrySocket(equipment.data ? (equipment.data.nodeId ?? undefined) : undefined)
  if (equipment.isError) return <ErrorState error={equipment.error} onRetry={() => void equipment.refetch()} />
  if (!equipment.data) return <SkeletonRows rows={5} />
  const e = equipment.data

  const list = [...(sessions.data ?? [])].sort(newestFirst)
  // идущий сеанс, а если его нет — последний
  const session = list.find((s) => s.finishedAt === null) ?? list[0] ?? null

  const post = buildPosts({
    equipment: [e],
    nodes: nodes.data ?? [],
    sessions: list,
    ticks: socket.ticks,
    pending: [],
    now,
  })[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <button
          type="button"
          // назад — туда, откуда пришли: со сводки или из списка
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(activePath()))}
          className="inline-flex w-fit items-center gap-2 rounded-[6px] px-2 py-1.5 text-fg2 ring-1 ring-line hover:bg-panel2 hover:text-fg"
        >
          <ArrowLeft className="size-5" aria-hidden />
          Назад
        </button>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="font-cond text-[30px] font-semibold leading-tight text-fg sm:text-[36px]">{e.name}</h1>
          {post && <PostStateChip status={post.status} size="lg" />}
          {e.nodeId && <span className="font-mono text-[14px] text-muted">{e.nodeId}</span>}
        </div>
      </div>

      {!e.nodeId ? (
        <div className="flex items-start gap-4 rounded-[8px] bg-panel px-5 py-6 ring-1 ring-line">
          <WifiOff className="size-8 shrink-0 text-muted" aria-hidden />
          <div className="flex flex-col gap-1">
            <span className="text-[18px] text-fg">Узел телеметрии не подключён</span>
            <span className="text-fg2">Номер узла задаётся в разделе «Оборудование».</span>
          </div>
        </div>
      ) : sessions.isError ? (
        <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />
      ) : sessions.isPending || !post ? (
        <SkeletonRows rows={3} />
      ) : session === null ? (
        post.status === 'offline' ? (
          <div className="flex items-start gap-4 rounded-[8px] bg-panel px-5 py-6 ring-1 ring-line">
            <WifiOff className="size-8 shrink-0 text-muted" aria-hidden />
            <div className="flex flex-col gap-1">
              <span className="text-[18px] text-fg">Узел не передаёт данные</span>
              <span className="text-fg2">
                Сеансов сварки на этом посту не зафиксировано. Проверьте питание и сеть телеметрического узла.
              </span>
            </div>
          </div>
        ) : (
          <LivePanel post={post} arc={null} socketStatus={socket.status} now={now} />
        )
      ) : (
        <SessionView key={session.id} session={session} post={post} socketStatus={socket.status} now={now} />
      )}
    </div>
  )
}
