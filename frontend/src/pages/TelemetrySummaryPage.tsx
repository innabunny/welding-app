import { X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { useWelders, useWorkshops } from '@/features/attestation/queries'
import { useEquipmentList } from '@/features/equipment/queries'
import { fmtDate } from '@/features/telemetry/format'
import { buildPosts } from '@/features/telemetry/posts'
import { useActiveSessions, useNodes, useTelemetrySummary } from '@/features/telemetry/queries'
import { activePath } from '@/features/telemetry/routes'
import {
  DeviationsCard,
  LoadCard,
  MaterialsCard,
  StatusBlock,
  TYPE_META,
  TYPES,
  TypesSection,
  WorksSection,
} from '@/features/telemetry/SummaryBlocks'
import { useNow } from '@/features/telemetry/useNow'
import { useTelemetrySocket } from '@/features/telemetry/useTelemetrySocket'
import { cn } from '@/shared/lib/cn'
import type { EquipmentType, SummaryFilters } from '@/shared/types/summary'
import { ErrorState, SkeletonRows } from '@/shared/ui/States'

type Period = 'shift' | '7' | '30' | 'custom'

const PERIODS: { key: Exclude<Period, 'custom'>; label: string }[] = [
  { key: 'shift', label: 'Смена' },
  { key: '7', label: '7 дней' },
  { key: '30', label: '30 дней' },
]

/** Дата в местном поясе: «2026-10-31» */
function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function range(period: Period, from: string | null, to: string | null, now: number): [string, string] {
  const today = isoDay(new Date(now))
  if (period === 'custom' && from && to) return [from, to]
  if (period === '7' || period === '30') {
    const start = new Date(now)
    start.setDate(start.getDate() - Number(period) + 1)
    return [isoDay(start), today]
  }
  return [today, today]
}

const isType = (v: string | null): v is EquipmentType => TYPES.includes(v as EquipmentType)

/** Главная страница телеметрии — «Сварочное производство», по референсу заказчика */
export function TelemetrySummaryPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const now = useNow()
  const set = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v)
          else next.delete(k)
        }
        return next
      },
      { replace: true },
    )

  const raw = params.get('period')
  const period: Period = raw === '7' || raw === '30' || raw === 'custom' ? raw : 'shift'
  const [from, to] = range(period, params.get('from'), params.get('to'), now)
  const workshop = Number(params.get('workshop')) || undefined
  const type = isType(params.get('type')) ? (params.get('type') as EquipmentType) : undefined
  const equipmentId = Number(params.get('equipment')) || undefined
  const welder = Number(params.get('welder')) || undefined
  const filters: SummaryFilters = { from, to, workshop, type, equipment: equipmentId, welder }

  const summary = useTelemetrySummary(filters)
  const workshops = useWorkshops()
  const welders = useWelders({ active: true })
  const equipment = useEquipmentList({ active: true })
  const nodes = useNodes()
  const sessions = useActiveSessions()
  const socket = useTelemetrySocket(null)

  // зелёный блок — то же, что на странице «Оборудование в работе»
  const posts = buildPosts({
    equipment: equipment.data ?? [],
    nodes: nodes.data ?? [],
    sessions: sessions.data ?? [],
    ticks: socket.ticks,
    pending: [],
    now,
  })
  const workshopName = workshops.data?.find((w) => w.id === workshop)?.name
  const equipmentName = equipment.data?.find((e) => e.id === equipmentId)?.name
  const welderName = welders.data?.find((w) => w.id === welder)?.fio
  const anyFilter = Boolean(workshop || type || equipmentId || welder)

  const subtitle = [
    period === 'shift' ? `Текущая смена, ${fmtDate(now, true)}` : `${fmtDate(from)} — ${fmtDate(to)}`,
    [workshopName ?? 'все цеха', type && TYPE_META[type].short.toLowerCase(), equipmentName, welderName].filter(Boolean).join(' · '),
  ].join(' · ')

  const select = (on: boolean) =>
    cn(
      'h-9 w-full min-w-0 rounded-[6px] bg-panel2 px-2 text-[14px] text-fg ring-1 hover:ring-fg2/50 sm:w-auto lg:max-w-[14rem] lg:flex-1',
      on ? 'ring-fg/70' : 'ring-line',
    )
  const dateInput = 'tnum h-8 w-[7.6rem] bg-transparent px-1 font-mono text-[14px] text-fg'
  const setDate = (which: 'from' | 'to', value: string) => {
    if (!value) return
    set({ period: 'custom', from: which === 'from' ? value : from, to: which === 'to' ? value : to })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-cond text-[30px] font-semibold leading-tight text-fg sm:text-[36px]">Сварочное производство</h1>
          <p className="tnum text-fg2">{subtitle}</p>
        </div>
        <StatusBlock
          active={posts.filter((p) => p.session !== null).length}
          total={posts.length}
          offline={posts.filter((p) => p.status === 'offline').length}
          outNow={posts.filter((p) => p.outNow).length}
          onOpen={() => navigate(activePath())}
          onOpenOffline={() => navigate(activePath('offline'))}
          onOpenOut={() => navigate(activePath('out'))}
        />
      </div>

      <section aria-label="Фильтры" className="flex flex-wrap items-center gap-2 rounded-[8px] bg-panel px-3 py-2 ring-1 ring-line lg:flex-nowrap">
        <div role="radiogroup" aria-label="Период" className="flex h-9 overflow-hidden rounded-[6px] ring-1 ring-line">
          {PERIODS.map((p) => {
            const on = period === p.key
            return (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ period: p.key === 'shift' ? null : p.key, from: null, to: null })}
                className={cn(
                  'border-l border-line px-3 text-[14px] first:border-l-0',
                  on ? 'bg-fg font-semibold text-bg' : 'bg-panel2 text-fg2 hover:text-fg',
                )}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <div className={cn('flex h-9 items-center gap-1 rounded-[6px] bg-panel2 pl-2 pr-1 ring-1', period === 'custom' ? 'ring-fg/70' : 'ring-line')}>
          <span className="text-xs text-muted">с</span>
          <input type="date" aria-label="Начало периода" max={to} value={from} onChange={(e) => setDate('from', e.target.value)} className={dateInput} />
          <span className="ml-1 text-xs text-muted">по</span>
          <input type="date" aria-label="Конец периода" min={from} max={isoDay(new Date(now))} value={to} onChange={(e) => setDate('to', e.target.value)} className={dateInput} />
        </div>
        <span className="mx-1 hidden h-6 w-px bg-line lg:block" aria-hidden />
        <select aria-label="Цех" className={select(!!workshop)} value={workshop ?? ''} onChange={(e) => set({ workshop: e.target.value, equipment: null })}>
          <option value="">Все цеха</option>
          {(workshops.data ?? []).map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <select aria-label="Тип оборудования" className={select(!!type)} value={type ?? ''} onChange={(e) => set({ type: e.target.value, equipment: null })}>
          <option value="">Все типы</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_META[t].short}
            </option>
          ))}
        </select>
        <select aria-label="Оборудование" className={select(!!equipmentId)} value={equipmentId ?? ''} onChange={(e) => set({ equipment: e.target.value })}>
          <option value="">Всё оборудование</option>
          {(equipment.data ?? [])
            .filter((e) => !workshopName || e.workshopName === workshopName)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </select>
        <select aria-label="Сварщик" className={select(!!welder)} value={welder ?? ''} onChange={(e) => set({ welder: e.target.value })}>
          <option value="">Все сварщики</option>
          {(welders.data ?? []).map((w) => (
            <option key={w.id} value={w.id}>
              {w.fio}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => set({ workshop: null, type: null, equipment: null, welder: null })}
          disabled={!anyFilter}
          aria-label="Сбросить фильтры"
          title="Сбросить цех, тип, оборудование и сварщика"
          className={cn(
            'ml-auto size-9 shrink-0 items-center justify-center rounded-[6px] text-fg2 ring-1 ring-line hover:bg-panel2 hover:text-fg',
            anyFilter ? 'inline-flex' : 'hidden lg:invisible lg:inline-flex',
          )}
        >
          <X className="size-4" aria-hidden />
        </button>
      </section>

      {summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : !summary.data ? (
        <SkeletonRows rows={8} />
      ) : (
        <div className={cn('flex flex-col gap-6 transition-opacity', summary.isPlaceholderData && 'opacity-60')}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <LoadCard load={summary.data.load} period={period === 'shift' ? 'shift' : 'range'} />
            <DeviationsCard s={summary.data.deviations} />
            <MaterialsCard lines={summary.data.materials} />
          </div>
          <WorksSection works={summary.data.works} locked={type ?? null} />
          <TypesSection slices={summary.data.types} onOpen={(t) => set({ type: t })} />
        </div>
      )}
    </div>
  )
}
