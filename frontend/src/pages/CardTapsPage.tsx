import { ArrowLeft, ChevronLeft, ChevronRight, CircleX, IdCard, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { useWelders } from '@/features/attestation/queries'
import { useEquipmentList } from '@/features/equipment/queries'
import { formatDay, formatTime } from '@/features/telemetry/format'
import { useCardTaps } from '@/features/telemetry/queries'
import { paths } from '@/layouts/navigation'
import { cn } from '@/shared/lib/cn'
import { formatNumber, plural } from '@/shared/lib/format'
import type { CardTap, CardTapFilters } from '@/shared/types/telemetry'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'

/** Фильтры живут в адресе: ссылку на отбор можно переслать или сохранить */
const FILTERS = ['equipment', 'welder', 'from', 'to', 'result'] as const
type Filter = (typeof FILTERS)[number]

const RESULTS: { id: '' | 'refused' | 'accepted'; label: string }[] = [
  { id: '', label: 'Все' },
  { id: 'refused', label: 'Отказы' },
  { id: 'accepted', label: 'Принятые' },
]

const PAGE_SIZE = 50

function Row({ tap }: { tap: CardTap }) {
  const refused = !tap.accepted
  return (
    <tr
      className={cn(
        'border-t border-line align-top',
        // отказ — не мелкая пометка: строка выделена целиком
        refused && 'bg-crit-bg shadow-[inset_4px_0_0_rgb(var(--c-danger))]',
      )}
    >
      <td className="tnum whitespace-nowrap px-3 py-2.5 font-mono text-fg">
        {formatDay(tap.tappedAt, false)} <span className="font-semibold">{formatTime(tap.tappedAt, true)}</span>
      </td>
      <td className="px-3 py-2.5">
        <div className="text-fg">{tap.equipmentName || 'не привязан к оборудованию'}</div>
        <div className="font-mono text-xs text-muted">{tap.nodeId}</div>
      </td>
      <td className="tnum whitespace-nowrap px-3 py-2.5 font-mono text-fg">{tap.cardUid}</td>
      <td className={cn('px-3 py-2.5', tap.welderName ? 'text-fg' : 'text-fg2')}>{tap.welderName || 'карта ни за кем не записана'}</td>
      <td className="whitespace-nowrap px-3 py-2.5">
        {refused ? (
          <span className="label inline-flex items-center gap-1.5 rounded-[4px] bg-crit-strong px-2 py-0.5 text-[14px] text-surface">
            <CircleX className="size-4" aria-hidden />
            Отказ
          </span>
        ) : (
          <span className="text-[14px] text-fg2">принята</span>
        )}
      </td>
      <td className={cn('min-w-[16rem] px-3 py-2.5', refused ? 'font-semibold text-crit-ink' : 'text-warn')}>{tap.reason}</td>
      <td className="tnum whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs text-muted">№ {tap.nodeSeq}</td>
    </tr>
  )
}

/** Журнал прикладываний карт: кого узел пустил к сварке, кого нет и почему */
export function CardTapsPage() {
  const [params, setParams] = useSearchParams()
  const filter = (f: Filter) => params.get(f) ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const set = (changes: Partial<Record<Filter | 'page', string>>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        // сменили отбор — с первой страницы
        if (!('page' in changes)) next.delete('page')
        return next
      },
      { replace: true },
    )

  const base: CardTapFilters = {
    equipment: filter('equipment'),
    welder: filter('welder'),
    from: filter('from'),
    to: filter('to'),
  }
  const result = filter('result') as CardTapFilters['result']
  const taps = useCardTaps({ ...base, result, page })
  // сколько отказов при этих фильтрах — число от сервера, не счёт по странице
  const refusals = useCardTaps({ ...base, result: 'refused', page: 1 })
  const equipment = useEquipmentList({})
  const welders = useWelders({})

  const anyFilter = FILTERS.some((f) => filter(f))
  const pages = taps.data ? Math.max(1, Math.ceil(taps.data.count / PAGE_SIZE)) : 1
  const refusedCount = refusals.data?.count

  const select = (on: boolean) =>
    cn(
      'h-9 w-full min-w-0 rounded-[6px] bg-panel2 px-2 text-[14px] text-fg ring-1 hover:ring-fg2/50 focus-visible:ring-arc sm:w-auto lg:max-w-[16rem] lg:flex-1',
      on ? 'ring-fg/70' : 'ring-line',
    )
  const tab = (on: boolean) =>
    cn('whitespace-nowrap rounded-[6px] px-3 py-1.5 text-[14px]', on ? 'bg-panel2 text-fg ring-1 ring-line' : 'text-fg2 hover:text-fg')

  let body
  if (taps.isError) body = <ErrorState error={taps.error} onRetry={() => void taps.refetch()} />
  else if (taps.isPending) body = <SkeletonRows rows={8} />
  else if (taps.data.count === 0)
    body = (
      <EmptyState
        icon={<IdCard />}
        title={anyFilter ? 'По этому отбору прикладываний нет' : 'Карты ещё не прикладывали'}
        description={
          anyFilter
            ? 'Измените фильтры или сбросьте их.'
            : 'Записи появляются, когда сварщик прикладывает карту к узлу телеметрии.'
        }
      />
    )
  else
    body = (
      <>
        <div className={cn('overflow-x-auto rounded-[8px] bg-panel ring-1 ring-line', taps.isPlaceholderData && 'opacity-60')}>
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th scope="col" className="label px-3 py-2.5 font-normal">Время</th>
                <th scope="col" className="label px-3 py-2.5 font-normal">Оборудование</th>
                <th scope="col" className="label px-3 py-2.5 font-normal">Карта</th>
                <th scope="col" className="label px-3 py-2.5 font-normal">Сварщик</th>
                <th scope="col" className="label px-3 py-2.5 font-normal">Результат</th>
                <th scope="col" className="label px-3 py-2.5 font-normal">Причина отказа</th>
                <th scope="col" className="label px-3 py-2.5 text-right font-normal">Событие узла</th>
              </tr>
            </thead>
            <tbody>
              {taps.data.results.map((t) => (
                <Row key={t.id} tap={t} />
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <nav aria-label="Страницы" className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => set({ page: String(page - 1) })}
              className="inline-flex items-center gap-1 rounded-[6px] px-3 py-1.5 text-[14px] text-fg2 ring-1 ring-line hover:bg-panel2 hover:text-fg disabled:opacity-40"
            >
              <ChevronLeft className="size-4" aria-hidden />
              Новее
            </button>
            <span className="tnum font-mono text-[14px] text-fg2">
              {page} / {pages}
            </span>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => set({ page: String(page + 1) })}
              className="inline-flex items-center gap-1 rounded-[6px] px-3 py-1.5 text-[14px] text-fg2 ring-1 ring-line hover:bg-panel2 hover:text-fg disabled:opacity-40"
            >
              Старее
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </nav>
        )}
      </>
    )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          to={paths.telemetry}
          className="inline-flex w-fit items-center gap-2 rounded-[6px] px-2 py-1.5 text-fg2 ring-1 ring-line hover:bg-panel2 hover:text-fg"
        >
          <ArrowLeft className="size-5" aria-hidden />
          Сводка
        </Link>
        <h1 className="font-cond text-[30px] font-semibold leading-tight text-fg sm:text-[36px]">Журнал прикладываний карт</h1>
        <p className="max-w-[60rem] text-fg2">
          Кого узел телеметрии пустил к сварке и кого нет. Решает узел по списку карт от портала; причину отказа портал
          определяет по базе в момент события. Записи создаёт приёмник — исправить или удалить их нельзя.
        </p>
      </div>

      <section
        aria-label="Фильтры"
        className="flex flex-wrap items-center gap-2 rounded-[8px] bg-panel px-3 py-2 ring-1 ring-line lg:flex-nowrap"
      >
        <select aria-label="Оборудование" className={select(!!filter('equipment'))} value={filter('equipment')} onChange={(e) => set({ equipment: e.target.value })}>
          <option value="">Всё оборудование</option>
          {(equipment.data ?? [])
            .filter((e) => e.nodeId)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </select>
        <select aria-label="Сварщик" className={select(!!filter('welder'))} value={filter('welder')} onChange={(e) => set({ welder: e.target.value })}>
          <option value="">Все сварщики</option>
          {(welders.data ?? []).map((w) => (
            <option key={w.id} value={w.id}>
              {w.fio}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-[14px] text-fg2">
          с
          <input
            type="date"
            aria-label="Период с"
            value={filter('from')}
            max={filter('to') || undefined}
            onChange={(e) => set({ from: e.target.value })}
            className={cn(select(!!filter('from')), 'tnum font-mono lg:flex-none')}
          />
        </label>
        <label className="flex items-center gap-2 text-[14px] text-fg2">
          по
          <input
            type="date"
            aria-label="Период по"
            value={filter('to')}
            min={filter('from') || undefined}
            onChange={(e) => set({ to: e.target.value })}
            className={cn(select(!!filter('to')), 'tnum font-mono lg:flex-none')}
          />
        </label>
        {anyFilter && (
          <button
            type="button"
            onClick={() => set({ equipment: '', welder: '', from: '', to: '', result: '' })}
            aria-label="Сбросить фильтры"
            title="Сбросить все фильтры"
            className="ml-auto inline-flex size-9 shrink-0 items-center justify-center rounded-[6px] text-fg2 ring-1 ring-line hover:bg-panel2 hover:text-fg"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Результат" className="flex w-fit gap-1 rounded-[8px] bg-panel p-1 ring-1 ring-line">
          {RESULTS.map((r) => (
            <button key={r.id} type="button" aria-pressed={r.id === (result ?? '')} className={tab(r.id === (result ?? ''))} onClick={() => set({ result: r.id })}>
              {r.label}
              {r.id === 'refused' && refusedCount !== undefined && (
                <span className={cn('tnum ml-1.5 font-mono', refusedCount > 0 ? 'font-semibold text-crit' : 'text-fg2')}>{refusedCount}</span>
              )}
            </button>
          ))}
        </div>
        {taps.data && taps.data.count > 0 && (
          <span className="tnum text-[14px] text-fg2">
            {formatNumber(taps.data.count, 0)} {plural(taps.data.count, ['событие', 'события', 'событий'])}
          </span>
        )}
      </div>

      {body}
    </div>
  )
}
