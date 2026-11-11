import { ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router'
import { cn } from '@/shared/lib/cn'
import { ModeChip, StateCell, ToleranceCell, TypeLine } from './Badges'
import { fmt1, fmtTol, formatClock, secondsSince, shortName } from './format'
import { fit, range, type Range } from './plan'
import { isFresh, type Post } from './posts'
import { equipmentPath } from './routes'

const TH = 'label whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted'

/** Допуск прохода из карты; без известного прохода — коридор живой подсветки */
function passRange(post: Post, which: 'current' | 'voltage'): Range | null {
  const s = post.session
  const plan = s?.passPlan.find((p) => p.no === s.currentPass?.no)
  if (plan) return which === 'current' ? range(plan.currentMin, plan.currentMax) : range(plan.voltageMin, plan.voltageMax)
  const c = post.corridor
  return c && c.kind !== 'uncontrolled' ? c[which] : null
}

/** Параметр режима: среднее за проход крупно, допуск, ниже живое значение */
function Param({ label, avg, r, live, liveOut }: { label: string; avg: number | null; r: Range | null; live: number | null; liveOut: boolean }) {
  // сравнение с границами из passPlan — только подсветка, отклонений не создаёт
  const avgOut = fit(avg, r) === 'out'
  return (
    <div className="flex min-w-[92px] flex-col">
      <span className="text-xs text-muted">{label}</span>
      <span className={cn('font-mono text-[20px] font-semibold leading-tight', avgOut ? 'text-crit' : 'text-fg')}>{fmt1(avg)}</span>
      <span className="font-mono text-xs text-muted">{r ? fmtTol(r[0], r[1], '') : '—'}</span>
      {live !== null && (
        <span className={cn('font-mono text-xs', liveOut ? 'font-semibold text-crit' : 'text-fg2')}>сейчас {fmt1(live)}</span>
      )}
    </div>
  )
}

/** Живое значение без сеанса: сравнивать не с чем, только «сейчас» */
function LiveParam({ label, live }: { label: string; live: number | null }) {
  return (
    <div className="flex min-w-[92px] flex-col">
      <span className="text-xs text-muted">{label}</span>
      <span className={cn('font-mono text-[20px] font-semibold leading-tight', live === null ? 'text-muted' : 'text-fg')}>
        {live === null ? '—' : fmt1(live)}
      </span>
      <span className="font-mono text-xs text-muted">{live === null ? 'нет данных' : 'сейчас'}</span>
    </div>
  )
}

/** Этап: проход по карте и время горения дуги за сеанс */
function Stage({ post, now }: { post: Post; now: number }) {
  const s = post.session
  if (!s) return null
  const active = isFresh(post.tick, now) && post.tick.arc
  const pass = s.currentPass
  return (
    <div className="flex flex-col gap-0.5">
      {pass === null ? (
        <span className="text-fg">Дуга</span>
      ) : (
        <span className="text-fg">
          Проход <b>{pass.no}</b>
          {pass.total !== null && <span className="text-fg2">/{pass.total}</span>}
        </span>
      )}
      <span className="flex items-center gap-1.5 text-[14px] text-fg2">
        {active && <span className="arc-dot inline-block size-2 rounded-full bg-arc" aria-hidden />}
        {pass !== null && 'дуга '}
        <span className="font-mono text-fg">{formatClock(s.arcSeconds)}</span>
      </span>
      {s.mode === 'прихватка' && (
        <span className="text-[14px] text-fg2">
          <b className="font-mono text-fg">{s.arcsCount}</b> прихваток
        </span>
      )}
    </div>
  )
}

interface Props {
  posts: Post[]
  /** сколько варит всего, без учёта вкладки */
  inWork: number
  total: number
  idle: number
  offline: number
  emptyText?: string
  now: number
}

export function ActiveTable({ posts, inWork, total, idle, offline, emptyText, now }: Props) {
  const navigate = useNavigate()
  return (
    <section aria-label="Оборудование в работе" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="label text-[16px] text-fg">
          Оборудование в работе{' '}
          <span className="tnum font-mono text-fg2">
            · {inWork} из {total}
          </span>
        </h2>
        <span className="tnum text-[14px] text-muted">
          простаивает {idle}
          {offline > 0 && ` · нет связи ${offline}`}
        </span>
      </div>
      {posts.length === 0 ? (
        <p className="rounded-[8px] bg-panel px-4 py-4 text-fg2 ring-1 ring-line">
          {emptyText ?? 'По выбранному фильтру сейчас никто не варит.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[8px] ring-1 ring-line">
          <table className="tnum w-full min-w-[1180px] border-collapse bg-panel text-[15px]">
            <thead className="bg-panel2">
              <tr>
                <th className={TH}>Оборудование</th>
                <th className={TH}>Состояние</th>
                <th className={TH}>Сварщик</th>
                <th className={TH}>Деталь · зав. №</th>
                <th className={TH}>Шов · опер.</th>
                <th className={TH}>Этап</th>
                <th className={TH}>Режим: среднее за проход · сейчас</th>
                <th className={TH}>Допуск</th>
                <th className={TH}>Сеанс</th>
                <th className="w-8" aria-label="Открыть" />
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const { equipment: e, session: s } = post
                const tick = isFresh(post.tick, now) ? post.tick : null
                const bar = post.tolerance === 'out-now' || post.tolerance === 'was'
                const open = () => navigate(equipmentPath(e.id))
                const none = <span className="text-muted">—</span>
                return (
                  <tr
                    key={e.id}
                    onClick={open}
                    className={cn(
                      'cursor-pointer border-t border-line align-top hover:bg-panel2',
                      post.tolerance === 'out-now' && 'bg-crit-bg hover:bg-crit-bg/80',
                    )}
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2">
                        {bar && <span className="mt-0.5 inline-block h-10 w-1 shrink-0 rounded-[4px] bg-crit" aria-hidden />}
                        <div className="flex min-w-0 flex-col">
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation()
                              open()
                            }}
                            className="whitespace-nowrap text-left font-cond text-[16px] font-semibold text-fg hover:underline"
                          >
                            {e.name}
                          </button>
                          <TypeLine method={e.methodDesignation || e.methodName} workshop={e.workshopName} />
                          {s && (
                            <span className="mt-1">
                              <ModeChip mode={s.mode} />
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <StateCell status={post.status} />
                      <div className="mt-1 font-mono text-xs text-muted">{e.nodeId}</div>
                    </td>
                    <td className="px-3 py-3">
                      {s ? (
                        <>
                          <div className="text-fg" title={s.welderName}>
                            {s.welderName ? shortName(s.welderName) : '—'}
                          </div>
                          {s.welderRank && <div className="text-xs text-muted">{s.welderRank} разряд</div>}
                        </>
                      ) : (
                        none
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono">
                      {s ? (
                        <>
                          <div className="text-fg">{s.partNumber || 'без привязки'}</div>
                          <div className="text-xs text-fg2">№ {s.serialNo || '—'}</div>
                        </>
                      ) : (
                        none
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-fg">
                      {s ? `${s.seamNumber || '—'} · ${s.operationNumber || '—'}` : none}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{s ? <Stage post={post} now={now} /> : none}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-x-5 gap-y-2">
                        {s ? (
                          <>
                            <Param
                              label="I, А"
                              avg={s.currentPass?.currentAvg ?? null}
                              r={passRange(post, 'current')}
                              live={tick?.i ?? null}
                              liveOut={post.iFit === 'out'}
                            />
                            <Param
                              label="U, В"
                              avg={s.currentPass?.voltageAvg ?? null}
                              r={passRange(post, 'voltage')}
                              live={tick?.u ?? null}
                              liveOut={post.uFit === 'out'}
                            />
                          </>
                        ) : (
                          <>
                            <LiveParam label="I, А" live={tick?.i ?? null} />
                            <LiveParam label="U, В" live={tick?.u ?? null} />
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">{post.tolerance ? <ToleranceCell tolerance={post.tolerance} /> : none}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {s ? (
                        <>
                          <div className="font-mono text-fg">{formatClock(secondsSince(s.startedAt, now))}</div>
                          <div className="font-mono text-xs text-muted">{String(s.id).padStart(4, '0').slice(-4)}</div>
                        </>
                      ) : (
                        none
                      )}
                    </td>
                    <td className="px-2 py-3 text-muted">
                      <ChevronRight className="size-5" aria-hidden />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
