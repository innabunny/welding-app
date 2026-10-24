import { useRef } from 'react'
import { useSearchParams } from 'react-router'
import type { WeldingSession } from '@/shared/types/welding'
import { Panel } from '@/shared/ui/Card'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'
import { ArcsTable } from './ArcsTable'
import { ArcChartPanel, SessionChartPanel } from './ChartPanels'
import { DeviationBanner, DeviationList } from './DeviationList'
import { indexPlan } from './plan'
import { useSessionArcs, useSessionDeviations } from './queries'
import { SessionCard } from './SessionCard'

interface Props {
  session: WeldingSession
  now: number
  large: boolean
}

/** Всё о сеансе: что варили, график, участки дуги, отклонения */
export function SessionView({ session, now, large }: Props) {
  const open = session.finishedAt === null
  const arcs = useSessionArcs(session.id, open)
  const deviations = useSessionDeviations(session.id, open)
  const [search, setSearch] = useSearchParams()
  const deviationsRef = useRef<HTMLDivElement>(null)

  const arcList = arcs.data ?? []
  const devList = deviations.data ?? []
  const plan = indexPlan(session.passPlan, arcList)
  const selectedId = Number(search.get('arc')) || null
  const selectedIndex = arcList.findIndex((a) => a.id === selectedId)
  const selected = arcList[selectedIndex]

  const selectArc = (id: number | null) =>
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (id === null) next.delete('arc')
        else next.set('arc', String(id))
        return next
      },
      { replace: true },
    )

  let arcsBody
  if (arcs.isPending) arcsBody = <SkeletonRows rows={3} />
  else if (arcs.isError) arcsBody = <ErrorState error={arcs.error} onRetry={() => void arcs.refetch()} />
  else if (arcList.length === 0)
    arcsBody = (
      <EmptyState
        title="Дуга не зажигалась"
        description={open ? 'Сеанс открыт, сварщик авторизован, но дуги ещё не было.' : 'В этом сеансе не было ни одного участка горения дуги.'}
      />
    )
  else
    arcsBody = (
      <>
        <ArcsTable arcs={arcList} plan={plan} deviations={devList} selectedId={selectedId} onSelect={selectArc} now={now} />
        <p className="mt-3 text-caption text-muted">
          Границы проходов система определяет сама. «По датчику вращения» и «указано человеком» — надёжно,
          «подтверждено скачком тока» или «остановкой» — косвенно, «только по накопленному времени дуги» —
          расчёт, которому можно верить меньше всего. Нажмите на строку, чтобы открыть график участка.
        </p>
      </>
    )

  return (
    <>
      <DeviationBanner
        deviations={devList}
        onShow={() => deviationsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      />
      <SessionCard session={session} now={now} large={large} />
      <SessionChartPanel session={session} plan={plan} deviations={devList} large={large} />
      {selected && (
        <ArcChartPanel
          arc={selected}
          index={selectedIndex}
          session={session}
          plan={plan}
          deviations={devList}
          large={large}
          onClose={() => selectArc(null)}
        />
      )}
      <Panel title={`Участки дуги · ${arcList.length}`}>{arcsBody}</Panel>
      <div ref={deviationsRef} className="scroll-mt-4">
        <Panel title={`Отклонения · ${devList.length}`}>
          {deviations.isPending ? (
            <SkeletonRows rows={2} />
          ) : deviations.isError ? (
            <ErrorState error={deviations.error} onRetry={() => void deviations.refetch()} />
          ) : (
            <DeviationList deviations={devList} session={session} />
          )}
        </Panel>
      </div>
    </>
  )
}
