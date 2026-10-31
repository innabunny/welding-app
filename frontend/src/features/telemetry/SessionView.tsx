import { useRef } from 'react'
import type { SocketStatus } from '@/shared/types/telemetry'
import type { WeldingSession } from '@/shared/types/welding'
import { ErrorState, SkeletonRows } from '@/shared/ui/States'
import { ArcsTable } from './ArcsTable'
import { SessionChartPanel } from './ChartPanels'
import { DeviationBanner, DeviationList } from './DeviationList'
import { LivePanel } from './LivePanel'
import { indexPlan } from './plan'
import type { Post } from './posts'
import { useSessionArcs, useSessionDecisions, useSessionDeviations } from './queries'
import { SessionCard } from './SessionCard'

interface Props {
  session: WeldingSession
  post: Post
  socketStatus: SocketStatus
  now: number
}

/** Экран поста с сеансом: показания, сеанс, график, участки дуги, отклонения */
export function SessionView({ session, post, socketStatus, now }: Props) {
  const open = session.finishedAt === null
  const arcs = useSessionArcs(session.id, open)
  const deviations = useSessionDeviations(session.id, open)
  const decisions = useSessionDecisions(session.id)
  const deviationsRef = useRef<HTMLElement>(null)

  const arcList = arcs.data ?? []
  const devList = deviations.data ?? []
  const plan = indexPlan(session.passPlan, arcList)
  const burning = open ? (arcList.find((a) => a.finishedAt === null) ?? null) : null

  return (
    <>
      <DeviationBanner
        deviations={devList}
        onShow={() => deviationsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      />
      <LivePanel post={post} arc={burning} socketStatus={socketStatus} now={now} />
      <SessionCard session={session} now={now} />
      <SessionChartPanel session={session} arcs={arcList} plan={plan} deviations={devList} />
      <section aria-label="Участки дуги" className="flex flex-col gap-3">
        <h2 className="label text-[16px] text-fg">
          Участки дуги <span className="text-muted">· {arcList.length}</span>
        </h2>
        {arcs.isPending ? (
          <SkeletonRows rows={3} />
        ) : arcs.isError ? (
          <ErrorState error={arcs.error} onRetry={() => void arcs.refetch()} />
        ) : arcList.length === 0 ? (
          <p className="rounded-[8px] bg-panel px-4 py-3 text-fg2 ring-1 ring-line">
            {open ? 'Сварщик авторизован, но дуги ещё не было.' : 'В этом сеансе дуга не зажигалась.'}
          </p>
        ) : (
          <ArcsTable arcs={arcList} plan={plan} deviations={devList} now={now} />
        )}
      </section>
      <section ref={deviationsRef} aria-label="Отклонения" className="scroll-mt-20">
        {deviations.isPending ? (
          <SkeletonRows rows={2} />
        ) : deviations.isError ? (
          <ErrorState error={deviations.error} onRetry={() => void deviations.refetch()} />
        ) : (
          <DeviationList deviations={devList} decisions={decisions.data ?? []} session={session} now={now} />
        )}
      </section>
    </>
  )
}
