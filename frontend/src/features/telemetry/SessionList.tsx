import { CircleAlert } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/shared/lib/cn'
import type { WeldingSession } from '@/shared/types/welding'
import { modeLabel } from './Badges'
import { fmtSpan, formatDay, formatTime, shortName } from './format'

/** Сколько строк показывать сразу; остальные — по кнопке */
const PAGE = 15

interface Props {
  /** сеансы поста, новые первыми */
  sessions: WeldingSession[]
  selectedId: number | null
  onSelect: (id: number) => void
}

/** Что варили: «А-1432.07.110 · Ш-3 · 025», у отработки и прихватки — режим */
function what(s: WeldingSession): string {
  if (!s.partNumber) return modeLabel(s.mode)
  return [s.partNumber, s.seamNumber, s.operationNumber].filter(Boolean).join(' · ')
}

/**
 * Сеансы поста — чтобы открыть график любого из них, а не только
 * последнего. Сеанс открывается прикладыванием карты, и большинство
 * из них — карту приложили и убрали, дуги не было. Такие по умолчанию
 * скрыты: иначе за ними не найти сварку.
 */
export function SessionList({ sessions, selectedId, onSelect }: Props) {
  const [withEmpty, setWithEmpty] = useState(false)
  const [limit, setLimit] = useState(PAGE)

  const empty = sessions.filter((s) => s.arcsCount === 0).length
  const shown = withEmpty ? sessions : sessions.filter((s) => s.arcsCount > 0 || s.id === selectedId)
  const visible = shown.slice(0, limit)

  return (
    <section aria-label="Сеансы поста" className="flex flex-col gap-3 rounded-[8px] bg-panel px-4 py-4 ring-1 ring-line sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="label text-[16px] text-fg">
          Сеансы <span className="text-muted">· {shown.length}</span>
        </h2>
        {empty > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-[14px] text-fg2">
            <input type="checkbox" className="size-4 accent-[rgb(var(--c-primary))]" checked={withEmpty} onChange={(e) => setWithEmpty(e.target.checked)} />
            Показать сеансы без дуги ({empty})
          </label>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="text-fg2">Сварки на этом посту ещё не было: карту прикладывали, дуга не зажигалась.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th scope="col" className="label px-2 py-2 font-normal">Начало</th>
                <th scope="col" className="label px-2 py-2 font-normal">Сварщик</th>
                <th scope="col" className="label px-2 py-2 font-normal">Что варили</th>
                <th scope="col" className="label px-2 py-2 text-right font-normal">Длительность</th>
                <th scope="col" className="label px-2 py-2 text-right font-normal">Время горения дуги</th>
                <th scope="col" className="label px-2 py-2 text-right font-normal">Отклонения</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => {
                const on = s.id === selectedId
                const open = s.finishedAt === null
                const length = open ? null : (Date.parse(s.finishedAt ?? '') - Date.parse(s.startedAt)) / 1000
                return (
                  <tr
                    key={s.id}
                    onClick={() => onSelect(s.id)}
                    aria-selected={on}
                    className={cn(
                      'cursor-pointer border-t border-line hover:bg-panel2',
                      on && 'bg-panel2 shadow-[inset_3px_0_0_rgb(var(--c-primary))]',
                    )}
                  >
                    <td className="tnum whitespace-nowrap px-2 py-2 font-mono text-fg">
                      {/* кнопка внутри строки — чтобы выбрать сеанс с клавиатуры */}
                      <button type="button" className="text-left hover:underline" onClick={(e) => (e.stopPropagation(), onSelect(s.id))}>
                        {formatDay(s.startedAt, false)} {formatTime(s.startedAt)}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-fg">{s.welderName ? shortName(s.welderName) : 'не опознан'}</td>
                    <td className="max-w-[18rem] truncate px-2 py-2 text-fg2">{what(s)}</td>
                    <td className="tnum whitespace-nowrap px-2 py-2 text-right font-mono text-fg2">{open ? 'идёт' : fmtSpan(length)}</td>
                    <td className="tnum whitespace-nowrap px-2 py-2 text-right font-mono text-fg">{s.arcsCount > 0 ? fmtSpan(s.arcSeconds) : 'дуги не было'}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      {s.deviationsCount > 0 ? (
                        <span className="tnum inline-flex items-center gap-1 font-mono font-semibold text-crit">
                          <CircleAlert className="size-4" aria-hidden />
                          {s.deviationsCount}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {shown.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + PAGE)}
          className="w-fit rounded-[6px] px-3 py-1.5 text-[14px] text-fg2 ring-1 ring-line hover:bg-panel2 hover:text-fg"
        >
          Показать ещё · осталось {shown.length - limit}
        </button>
      )}
    </section>
  )
}
