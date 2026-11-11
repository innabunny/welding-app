import { ArrowLeft, IdCard, WifiOff } from 'lucide-react'
import { useRef } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useEquipment } from '@/features/equipment/queries'
import { PostStateChip } from '@/features/telemetry/Badges'
import { LivePanel } from '@/features/telemetry/LivePanel'
import { buildPosts } from '@/features/telemetry/posts'
import { useEquipmentSessions, useNodes } from '@/features/telemetry/queries'
import { SessionView } from '@/features/telemetry/SessionView'
import { formatTime, shortName } from '@/features/telemetry/format'
import { cardTapsPath, activePath } from '@/features/telemetry/routes'
import { SessionList } from '@/features/telemetry/SessionList'
import { useNow } from '@/features/telemetry/useNow'
import { useTelemetrySocket } from '@/features/telemetry/useTelemetrySocket'
import type { WeldingSession } from '@/shared/types/welding'
import { ErrorState, SkeletonRows } from '@/shared/ui/States'

const newestFirst = (a: WeldingSession, b: WeldingSession) => Date.parse(b.startedAt) - Date.parse(a.startedAt)

/** Экран одного аппарата — по референсу заказчика (docs/telemetry-demo.html) */
export function EquipmentTelemetryPage() {
  const params = useParams()
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams()
  const sessionTop = useRef<HTMLDivElement>(null)
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
  const current = list.find((s) => s.finishedAt === null) ?? null
  // Сеанс открывается прикладыванием карты, и чаще всего дуги в нём нет.
  // По умолчанию — идущий сеанс, если в нём уже варят, иначе последний
  // сеанс со сваркой: приложенная карта не должна убирать график с экрана
  const fallback = current && current.arcsCount > 0 ? current : (list.find((s) => s.arcsCount > 0) ?? current ?? list[0] ?? null)
  // выбранный сеанс — в адресе: ссылку на график можно переслать
  const requested = Number(search.get('session')) || null
  const session = list.find((s) => s.id === requested) ?? fallback
  // идущий сеанс, который сейчас не на экране — строкой над графиком
  const elsewhere = current !== null && session !== null && current.id !== session.id ? current : null

  const select = (id: number) => {
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('session', String(id))
        return next
      },
      { replace: true },
    )
    sessionTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

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
          {e.nodeId && (
            <Link
              to={cardTapsPath({ equipment: e.id })}
              className="ml-auto inline-flex items-center gap-2 rounded-[6px] px-3 py-1.5 text-[14px] text-fg2 ring-1 ring-line hover:bg-panel2 hover:text-fg"
            >
              <IdCard className="size-4" aria-hidden />
              Журнал карт
            </Link>
          )}
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
        <>
          <div ref={sessionTop} className="flex scroll-mt-20 flex-col gap-6">
            {elsewhere && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[8px] bg-panel px-5 py-3 ring-1 ring-line">
                <span className="arc-dot inline-block size-2.5 rounded-full bg-arc" aria-hidden />
                <span className="text-fg">
                  Сейчас: {elsewhere.welderName ? shortName(elsewhere.welderName) : 'сварщик не опознан'}, карта с{' '}
                  {formatTime(elsewhere.startedAt)}
                  {elsewhere.arcsCount === 0 ? ', дуги ещё не было' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => select(elsewhere.id)}
                  className="rounded-[6px] px-3 py-1 text-[14px] text-fg2 ring-1 ring-line hover:bg-panel2 hover:text-fg"
                >
                  Открыть текущий сеанс
                </button>
              </div>
            )}
            <SessionView key={session.id} session={session} post={post} socketStatus={socket.status} now={now} />
          </div>
          <SessionList sessions={list} selectedId={session.id} onSelect={select} />
        </>
      )}
    </div>
  )
}
