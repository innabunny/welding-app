// Временная служебная страница: проверить, что данные телеметрии
// доходят до браузера. Без оформления. Убрать, когда будут готовы
// список постов и экран аппарата.

import { useSearchParams } from 'react-router'
import {
  useActiveSessions,
  useCurrentShift,
  useNodes,
  useNodeSummary,
  useSessionArcs,
  useSessionDeviations,
  useSessionSamples,
  useWeldingSession,
} from '@/features/telemetry/queries'
import { useTelemetrySocket } from '@/features/telemetry/useTelemetrySocket'
import { Panel } from '@/shared/ui/Card'

function Dump({ title, value }: { title: string; value: unknown }) {
  return (
    <Panel title={title}>
      <pre className="max-h-80 overflow-auto text-caption">{JSON.stringify(value, null, 2)}</pre>
    </Panel>
  )
}

function queryState(q: { status: string; data?: unknown; error: unknown }) {
  return q.status === 'error' ? { status: q.status, error: String(q.error) } : { status: q.status, data: q.data }
}

export function TelemetryDebugPage() {
  const [params] = useSearchParams()
  // ?node=node-01 — сокет одного аппарата, без параметра — все сразу
  const node = params.get('node')
  // ?session=12 — дополнительно запросы экрана аппарата
  const sessionParam = params.get('session')
  const session = sessionParam ? Number(sessionParam) : null

  const socket = useTelemetrySocket(node)
  const nodes = useNodes()
  const summary = useNodeSummary()
  const active = useActiveSessions()
  const shift = useCurrentShift(null)
  const detail = useWeldingSession(session)
  const arcs = useSessionArcs(session)
  const samples = useSessionSamples(session)
  const deviations = useSessionDeviations(session)

  return (
    <div className="grid gap-4">
      <Dump title={`WebSocket ${node ?? 'все аппараты'}`} value={socket} />
      <Dump title="Сводка узлов" value={queryState(summary)} />
      <Dump title="Узлы" value={queryState(nodes)} />
      <Dump title="Идущие сеансы" value={queryState(active)} />
      <Dump title="Текущая смена" value={queryState(shift)} />
      {session !== null && (
        <>
          <Dump title={`Сеанс ${session}`} value={queryState(detail)} />
          <Dump title="Участки дуги" value={queryState(arcs)} />
          <Dump
            title="График сеанса"
            value={
              samples.data
                ? { ...samples.data, points: samples.data.points.slice(0, 5), shown: samples.data.points.length }
                : queryState(samples)
            }
          />
          <Dump title="Отклонения" value={queryState(deviations)} />
        </>
      )}
    </div>
  )
}
