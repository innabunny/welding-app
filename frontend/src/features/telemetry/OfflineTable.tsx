import { ChevronRight, WifiOff } from 'lucide-react'
import { useNavigate } from 'react-router'
import { cn } from '@/shared/lib/cn'
import { TypeLine } from './Badges'
import { formatDay, formatDuration, formatTime, shortName } from './format'
import type { Post } from './posts'
import { equipmentPath } from './routes'

const TH = 'label whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted'

/** Молчит меньше 8 часов — обрыв в эту смену, его стоит выяснить сейчас */
const RECENT_SECONDS = 8 * 3600

export function OfflineTable({ posts }: { posts: Post[] }) {
  const navigate = useNavigate()
  if (posts.length === 0) {
    return <p className="rounded-[8px] bg-panel px-4 py-4 text-fg2 ring-1 ring-line">Все узлы телеметрии на связи.</p>
  }
  // дольше всех молчащие — внизу
  const sorted = [...posts].sort((a, b) => (a.node?.silentSeconds ?? Infinity) - (b.node?.silentSeconds ?? Infinity))
  return (
    <section aria-label="Нет связи" className="flex flex-col gap-3">
      <h2 className="label text-[16px] text-fg">
        Нет связи <span className="tnum font-mono text-fg2">· {posts.length}</span>
      </h2>
      <div className="overflow-x-auto rounded-[8px] ring-1 ring-line">
        <table className="tnum w-full min-w-[820px] border-collapse bg-panel text-[15px]">
          <thead className="bg-panel2">
            <tr>
              <th className={TH}>Оборудование</th>
              <th className={TH}>Узел</th>
              <th className={TH}>Последний сигнал</th>
              <th className={TH}>Без связи</th>
              <th className={TH}>Последний сварщик</th>
              <th className="w-8" aria-label="Открыть" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ equipment: e, node }) => {
              const silent = node?.silentSeconds ?? null
              const last = node?.lastSession ?? null
              return (
                <tr
                  key={e.id}
                  onClick={() => navigate(equipmentPath(e.id))}
                  className="cursor-pointer border-t border-line align-top hover:bg-panel2"
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 font-medium text-fg">
                      <WifiOff className="size-4 shrink-0 text-muted" aria-hidden />
                      {e.name}
                    </div>
                    <div className="mt-0.5">
                      <TypeLine method={e.methodDesignation || e.methodName} workshop={e.workshopName} />
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-fg2">{e.nodeId}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-fg">
                    {node?.lastSeenAt ? (
                      <>
                        {formatDay(node.lastSeenAt, false)} <span className="font-mono">{formatTime(node.lastSeenAt)}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td
                    className={cn(
                      'whitespace-nowrap px-3 py-3 font-mono',
                      silent !== null && silent < RECENT_SECONDS ? 'text-warn' : 'text-fg2',
                    )}
                  >
                    {silent === null ? '—' : silent < 86_400 ? formatDuration(silent) : `${Math.floor(silent / 86_400)} сут`}
                  </td>
                  <td className="px-3 py-3 text-fg">
                    {last ? (
                      <>
                        {last.welderName ? shortName(last.welderName) : '—'}
                        <div className="text-xs text-fg2">{formatDay(last.startedAt, false)}</div>
                      </>
                    ) : (
                      '—'
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
      <p className="text-[14px] text-muted">
        Время последнего сигнала — последнее сообщение узла. Узел пропадает при отключении питания источника или обрыве
        сети.
      </p>
    </section>
  )
}
