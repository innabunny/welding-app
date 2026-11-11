// Блоки сводки «Сварочное производство» — разметка из референса заказчика
// (docs/telemetry-demo.html), цвета портала. Все цифры приходят готовыми
// из /api/telemetry-summary/: здесь только отображение.

import { ChevronRight, CircleAlert, CircleCheck, FlaskConical, Gauge, Layers } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import type {
  EquipmentType,
  MaterialLine,
  QualityGroup,
  SummaryDeviations,
  SummaryLoad,
  TypeSlice,
  TypeWorks,
} from '@/shared/types/summary'
import type { DeviationParameter } from '@/shared/types/deviations'
import { fmt1, fmtDayShort, fmtHM, fmtHours, fmtInt, fmtPct, fmtTime, fmtTol, formatTime } from './format'
import { DEVIATION_UNIT } from './units'

export const TYPE_META: Record<EquipmentType, { short: string; process: string; coverage: string; dot: string; bar: string }> = {
  arc: { short: 'Дуговая', process: 'Горение дуги', coverage: 'времени горения дуги', dot: 'bg-t-arc', bar: 'bg-t-arc' },
  contact: { short: 'Контактная', process: 'Сварочные импульсы', coverage: 'времени сварочных импульсов', dot: 'bg-t-contact', bar: 'bg-t-contact' },
  ebw: { short: 'Электронно-лучевая', process: 'Работа луча', coverage: 'времени работы луча', dot: 'bg-t-ebw', bar: 'bg-t-ebw' },
  diff: { short: 'Диффузионная', process: 'Нагрев и выдержка', coverage: 'времени нагрева и выдержки', dot: 'bg-t-diff', bar: 'bg-t-diff' },
}
export const TYPES: EquipmentType[] = ['arc', 'contact', 'ebw', 'diff']

// ───────────── зелёный блок «В работе · Нет связи · Вне допуска» ─────────────

function StatusPart({ caption, captionCls, children }: { caption: string; captionCls: string; children: ReactNode }) {
  return (
    <span className="pointer-events-none flex flex-col leading-tight">
      <span className={cn('label whitespace-nowrap text-[11px]', captionCls)}>{caption}</span>
      <span className="tnum flex items-baseline gap-1.5 whitespace-nowrap">{children}</span>
    </span>
  )
}

const StatusSep = () => <span className="pointer-events-none w-px self-stretch bg-ok/25" aria-hidden />

export function StatusBlock({
  active,
  total,
  offline,
  outNow,
  onOpen,
  onOpenOffline,
  onOpenOut,
}: {
  active: number
  total: number
  offline: number
  outNow: number
  onOpen: () => void
  onOpenOffline: () => void
  onOpenOut: () => void
}) {
  return (
    <div className="group relative flex w-full items-center gap-3 rounded-[8px] bg-ok-bg py-2 pl-3.5 pr-2.5 ring-1 ring-ok/40 transition-colors hover:ring-ok/70 sm:w-auto">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Оборудование: в работе ${active} из ${total}, нет связи ${offline}, вне допуска ${outNow}`}
        className="absolute inset-0 rounded-[8px]"
      />
      <span
        className={cn('arc-dot pointer-events-none mb-[8px] inline-block size-2.5 shrink-0 self-end rounded-full', active > 0 ? 'bg-ok' : 'bg-muted')}
        aria-hidden
      />
      <StatusPart caption="В работе" captionCls="text-ok/80">
        <b className="font-mono text-[22px] font-semibold text-fg">{active}</b>
        <span className="font-mono text-[14px] text-fg2">из {total}</span>
      </StatusPart>
      {/* три счётчика всегда, как в референсе: ноль — тоже ответ */}
      <StatusSep />
      <button
        type="button"
        onClick={onOpenOffline}
        title="Показать, кто не на связи"
        className="relative z-10 -mx-1.5 -my-1 rounded-[6px] px-1.5 py-1 text-left hover:bg-fg/10"
      >
        <StatusPart caption="Нет связи" captionCls="text-muted">
          <b className="font-mono text-[22px] font-semibold text-fg2">{offline}</b>
        </StatusPart>
      </button>
      <StatusSep />
      <button
        type="button"
        onClick={onOpenOut}
        title="Открыть текущие отклонения"
        className="relative z-10 -mx-1.5 -my-1 rounded-[6px] px-1.5 py-1 text-left hover:bg-crit/10"
      >
        <StatusPart caption="Вне допуска" captionCls={outNow > 0 ? 'text-crit/80' : 'text-muted'}>
          <b className={cn('font-mono text-[22px] font-semibold', outNow > 0 ? 'text-crit' : 'text-fg2')}>{outNow}</b>
        </StatusPart>
      </button>
      <ChevronRight className="pointer-events-none ml-auto size-5 shrink-0 text-ok/70 group-hover:text-fg sm:ml-0" aria-hidden />
    </div>
  )
}

// ───────────── общая рамка карточки ─────────────

function Card({ title, icon, tone, children }: { title: string; icon: ReactNode; tone?: 'crit'; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className={cn(
        'flex min-w-0 flex-col gap-4 rounded-[8px] bg-panel px-5 py-4',
        tone === 'crit' ? 'ring-2 ring-crit/80' : 'ring-1 ring-line',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-fg2 [&_svg]:size-5">{icon}</span>
        <span className="label text-[14px] text-fg">{title}</span>
      </div>
      {children}
    </section>
  )
}

/** Сегментная полоса: доли от total, промежуток 2 px */
function Bar({ parts, total, h = 'h-3' }: { parts: { key: string; n: number; cls: string; style?: CSSProperties }[]; total: number; h?: string }) {
  return (
    <div className={cn('flex w-full gap-[2px] overflow-hidden rounded-[4px]', h)} aria-hidden>
      {parts
        .filter((p) => p.n > 0)
        .map((p) => (
          <div key={p.key} className={cn('h-full', p.cls)} style={{ ...p.style, flexGrow: total > 0 ? p.n / total : 0, flexBasis: 0, minWidth: 3 }} />
        ))}
    </div>
  )
}

/** Столбики по дням: высота — доля от максимума */
function DailyBars({ items, label, value, title }: { items: { date: string }[]; label: string; value: (i: number) => number; title: (i: number) => string }) {
  const max = Math.max(...items.map((_, i) => value(i)), 0)
  return (
    <div className="flex flex-col gap-1 border-t border-line pt-3">
      <span className="text-xs text-muted">{label}</span>
      <div className="flex h-14 items-end gap-[2px]" role="img" aria-label={label}>
        {items.map((d, i) => (
          <div key={d.date} title={title(i)} className="flex h-full min-w-0 flex-1 items-end hover:brightness-110">
            <div className="w-full rounded-t-[3px] bg-fg2/70" style={{ height: `${Math.max(2, max > 0 ? (value(i) / max) * 100 : 0)}%` }} />
          </div>
        ))}
      </div>
      <div className="tnum flex justify-between font-mono text-[11px] text-muted">
        <span>{items[0] ? fmtDayShort(items[0].date) : ''}</span>
        <span>{items.at(-1) ? fmtDayShort(items.at(-1)!.date) : ''}</span>
      </div>
    </div>
  )
}

// ───────────── загрузка оборудования ─────────────

export function LoadCard({ load, period }: { load: SummaryLoad; period: 'shift' | 'range' }) {
  const fund = load.fundSeconds
  const elapsed = load.elapsedSeconds
  const remaining = load.remainingSeconds
  const ofFund = (s: number) => (fund > 0 ? s / fund : 0)
  const ofElapsed = (s: number) => (elapsed > 0 ? s / elapsed : 0)
  const rows = [
    { key: 'arc', label: 'Время горения дуги', s: load.arcSeconds, cls: 'bg-fg' },
    { key: 'wait', label: 'Режим ожидания', s: load.standbySeconds, cls: 'bg-fg2/45' },
    { key: 'idle', label: 'Простой', s: load.idleSeconds, cls: 'bg-panel2 ring-1 ring-inset ring-line' },
    ...(load.noDataSeconds > 0 ? [{ key: 'nodata', label: 'Нет данных', s: load.noDataSeconds, cls: 'bg-warn/40' }] : []),
  ]

  if (fund === 0) {
    return (
      <Card title="Загрузка оборудования" icon={<Gauge />}>
        <p className="text-[16px] text-fg2">
          {period === 'shift'
            ? 'Смена сегодня не идёт: по графику выходной. Кз не считается.'
            : 'За период рабочих смен по графику нет. Кз не считается.'}
        </p>
      </Card>
    )
  }

  return (
    <Card title="Загрузка оборудования" icon={<Gauge />}>
      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-3">
          <span className="tnum font-mono text-[60px] font-semibold leading-none text-fg">
            {fmtInt(load.kz * 100)}
            <span className="ml-1 text-[30px] text-fg2">%</span>
          </span>
          <span className="pb-1 text-[14px] leading-tight text-fg2">
            коэффициент
            <br />
            загрузки, Кз{remaining > 0 ? ' на сейчас' : ''}
          </span>
        </div>
        <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-[4px]" aria-hidden>
          {rows.map((r) => (
            <div key={r.key} className={cn('h-full', r.cls)} style={{ width: `${ofFund(r.s) * 100}%` }} />
          ))}
          {remaining > 0 && <div className="hatch h-full" style={{ width: `${ofFund(remaining) * 100}%` }} />}
        </div>
        {period === 'shift' && load.shift && (
          <span className="tnum text-[14px] text-fg2">
            Смена {load.shift.startsAt}–{load.shift.endsAt} · прошло <b className="font-mono text-fg">{fmtHM(load.shift.elapsedSeconds)}</b> из{' '}
            {fmtHM(load.shift.fundSeconds)}
            {load.shift.onBreak && ' · обед'}
          </span>
        )}
      </div>
      <table className="tnum w-full text-[15px]">
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line first:border-t-0">
              <td className="py-1 pr-2">
                <span className="flex items-center gap-2 text-fg2">
                  <i className={cn('inline-block size-2.5 shrink-0 rounded-[2px]', r.cls)} aria-hidden />
                  {r.label}
                </span>
              </td>
              <td className="py-1 text-right font-mono font-semibold text-fg">{fmtTime(r.s)}</td>
              <td className="w-14 py-1 text-right font-mono text-fg2">{fmtPct(ofElapsed(r.s))}</td>
            </tr>
          ))}
          {remaining > 0 && (
            <tr className="border-t border-line">
              <td className="py-1 pr-2">
                <span className="flex items-center gap-2 text-muted">
                  <i className="hatch inline-block size-2.5 shrink-0 rounded-[2px] ring-1 ring-line" aria-hidden />
                  {period === 'shift' ? 'Остаток смены' : 'Остаток текущих смен'}
                </span>
              </td>
              <td className="py-1 text-right font-mono text-muted">{fmtTime(remaining)}</td>
              <td className="w-14 py-1" />
            </tr>
          )}
          <tr className="border-t-2 border-line">
            <td className="py-1 pl-[18px] pr-2 text-fg">Фонд времени</td>
            <td className="py-1 text-right font-mono font-semibold text-fg">{fmtTime(fund)}</td>
            <td className="w-14 py-1" />
          </tr>
        </tbody>
      </table>
      <p className="tnum text-xs leading-snug text-muted">
        {period === 'shift' && load.shift
          ? `Фонд времени: ${load.equipmentCount} ед. × ${fmtHM(load.shift.fundSeconds)} = ${fmtTime(fund)}, обед не входит. Учтено всё оборудование в фильтре: работающее, простаивающее и без связи.`
          : `Фонд времени: ${load.equipmentCount} ед. × рабочие дни по графику смены = ${fmtTime(fund)}, обед не входит. Учтено всё оборудование в фильтре.`}
        {elapsed < fund && ` % и простой — от прошедшей части: ${fmtTime(elapsed)}.`}
      </p>
      {period === 'range' && load.daily.length > 1 && (
        <DailyBars
          items={load.daily}
          label="Кз по дням"
          value={(i) => load.daily[i]?.kz ?? 0}
          title={(i) => {
            const d = load.daily[i]!
            return `${fmtDayShort(d.date)}: Кз ${fmtPct(d.kz)} · ${fmtHours(d.arcSeconds)} из ${fmtHours(d.fundSeconds)}`
          }}
        />
      )}
    </Card>
  )
}

// ───────────── отклонения от режима ─────────────

export function DeviationsCard({ s }: { s: SummaryDeviations }) {
  const at = (iso: string) => `${new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} ${formatTime(iso)}`
  return (
    <Card title="Отклонения от режима" icon={<CircleAlert />} tone={s.pending > 0 ? 'crit' : undefined}>
      {s.total === 0 ? (
        <div className="flex items-center gap-3 text-ok">
          <CircleCheck className="size-7" aria-hidden />
          <span className="text-[16px]">За период отклонений нет</span>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <div className="tnum flex items-end gap-4">
              <div className="flex flex-col">
                <span className="text-xs text-muted">Всего за период</span>
                <span className="font-mono text-[48px] font-semibold leading-none text-fg">{s.total}</span>
              </div>
              <div className="flex flex-col gap-0.5 pb-0.5 text-[14px]">
                <span className="text-fg2">
                  проанализировано <b className="font-mono text-fg">{s.analyzed}</b>
                </span>
                <span className={s.pending > 0 ? 'text-crit-ink' : 'text-fg2'}>
                  ожидают анализа <b className={cn('font-mono', s.pending > 0 ? 'text-crit' : 'text-fg')}>{s.pending}</b>
                </span>
              </div>
            </div>
            <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-[4px]" aria-hidden>
              <div className="h-full bg-fg2/70" style={{ flexGrow: s.analyzed, flexBasis: 0 }} />
              {s.pending > 0 && <div className="h-full min-w-[3px] bg-crit" style={{ flexGrow: s.pending, flexBasis: 0 }} />}
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-line pt-2.5">
            <span className="text-xs text-muted">По способу сварки</span>
            <ul className="tnum flex flex-wrap gap-1.5">
              {s.byMethod.map((m) => (
                <li key={m.method} className="inline-flex items-center gap-1.5 rounded-full bg-panel2 px-2 py-0.5 text-xs ring-1 ring-line">
                  <i className={cn('inline-block size-1.5 rounded-full', TYPE_META[m.type].dot)} aria-hidden />
                  <span className="text-fg2">{m.method}</span>
                  <b className="font-mono font-semibold text-fg">{m.count}</b>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-1.5 border-t border-line pt-2.5">
            <span className="text-xs text-muted">Последние {s.latest.length}</span>
            <ul className="flex flex-col gap-0.5 text-xs">
              {s.latest.map((d) => {
                const unit = DEVIATION_UNIT[d.parameter as DeviationParameter] ?? ''
                const text = `${d.equipmentName} · ${d.parameterName.toLowerCase()} ${fmt1(d.actualValue)} ${unit} при ${fmtTol(d.plannedMin, d.plannedMax, unit)}`
                return (
                  <li key={d.id} className="tnum flex min-w-0 items-center gap-2" title={`${text}${d.reviewed ? '' : ' · ожидает анализа'}`}>
                    <span
                      className={cn('size-1.5 shrink-0 rounded-full', d.reviewed ? 'bg-fg2/40' : 'bg-crit')}
                      aria-label={d.reviewed ? 'проанализировано' : 'ожидает анализа'}
                    />
                    <span className="shrink-0 whitespace-nowrap font-mono text-muted">{at(d.startedAt)}</span>
                    <span className="min-w-0 truncate text-fg2">
                      {d.equipmentName} · {d.parameterName.toLowerCase()}{' '}
                      <b className="font-mono text-crit">
                        {fmt1(d.actualValue)} {unit}
                      </b>{' '}
                      при {fmtTol(d.plannedMin, d.plannedMax, unit)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </Card>
  )
}

// ───────────── сварочные материалы ─────────────

export function MaterialsCard({ lines }: { lines: MaterialLine[] }) {
  return (
    <Card title="Сварочные материалы" icon={<FlaskConical />}>
      <span className="label -mt-2 w-fit rounded-[4px] bg-panel2 px-2 py-0.5 text-[11px] text-muted ring-1 ring-line">Расчёт по нормам</span>
      {lines.length === 0 ? (
        <p className="text-fg2">За период расхода нет.</p>
      ) : (
        <table className="tnum w-full text-[15px]">
          <tbody>
            {lines.map((l) => (
              <tr key={`${l.name}-${l.unit}`} className="border-t border-line first:border-t-0">
                <td className="py-1.5 pr-3 text-fg2">{l.name}</td>
                <td className="py-1.5 text-right font-mono text-[20px] font-semibold text-fg">{l.amount >= 100 ? fmtInt(l.amount) : fmt1(l.amount)}</td>
                <td className="w-10 py-1.5 pl-1.5 text-fg2">{l.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-xs leading-snug text-muted">
        Расход = норма из техкарты × время горения дуги. Это оценка, а не измерение: расходомера в узле нет. Газ — в
        горелку, на поддув и плазмообразующий, по швам, где он указан в техкарте. Проволока — только при механизированной
        подаче (MIG/MAG, плазменная), в метрах; при ручной TIG присадку кладут прутком.
      </p>
    </Card>
  )
}

// ───────────── выполненные сварочные работы ─────────────

const QUALITY: { key: QualityGroup; cls: string; style?: CSSProperties }[] = [
  { key: 'без отклонений', cls: 'bg-ok' },
  { key: 'допущено', cls: 'bg-fg2/60' },
  { key: 'на контроль', cls: 'bg-warn' },
  {
    key: 'не рассмотрено',
    cls: 'bg-crit/30 ring-1 ring-inset ring-crit',
    style: { backgroundImage: 'repeating-linear-gradient(135deg, rgb(var(--c-danger)) 0 2px, transparent 2px 5px)' },
  },
  { key: 'на переварку', cls: 'bg-crit' },
]

const OFF_CARD = [
  { key: 'trialSeconds', label: 'отработка', cls: 'bg-fg2/55' },
  { key: 'tackSeconds', label: 'прихватка', cls: 'bg-fg2/30' },
  { key: 'noCardSeconds', label: 'техкарта не найдена', cls: 'bg-panel2 ring-1 ring-inset ring-fg2/50' },
] as const

function BigStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs leading-tight text-muted">{label}</span>
      <span className="tnum whitespace-nowrap font-mono text-[30px] font-semibold leading-none text-fg sm:text-[36px]">
        {value}
        {unit && <span className="ml-1 text-[18px] text-fg2 sm:text-[20px]">{unit}</span>}
      </span>
    </div>
  )
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <>
      <dt className="text-fg2">{label}</dt>
      <dd className="text-right font-mono text-fg">{children}</dd>
    </>
  )
}

export function WorksSection({
  works,
  locked,
}: {
  works: Record<EquipmentType, TypeWorks>
  /** тип выбран в фильтре — вкладки других типов недоступны */
  locked: EquipmentType | null
}) {
  const [chosen, setChosen] = useState<EquipmentType>('arc')
  const type = locked ?? chosen
  const w = works[type]
  const length = w.lengthM >= 1000 ? { v: fmt1(w.lengthM / 1000), u: 'км' } : { v: fmt1(w.lengthM), u: 'м' }
  const clean = w.quality['без отклонений']
  const share = w.joints > 0 ? clean / w.joints : 1
  const c = w.coverage
  const techShare = c.totalSeconds > 0 ? c.techSeconds / c.totalSeconds : 0

  return (
    <section aria-label="Выполненные сварочные работы" className="flex min-w-0 flex-col gap-5 rounded-[8px] bg-panel px-5 py-4 ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Layers className="size-5 text-fg2" aria-hidden />
        <h2 className="label text-[14px] text-fg">Выполненные сварочные работы</h2>
        <span className="label rounded-[4px] bg-panel2 px-2 py-0.5 text-[11px] text-muted ring-1 ring-line">по техкартам</span>
        <div role="tablist" aria-label="Тип оборудования" className="flex flex-wrap overflow-hidden rounded-[6px] ring-1 ring-line lg:ml-4">
          {TYPES.map((t) => {
            const on = t === type
            const empty = works[t].seams === 0 && works[t].coverage.totalSeconds === 0
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={on}
                disabled={(!!locked && !on) || (empty && !on)}
                onClick={() => setChosen(t)}
                className={cn(
                  'flex items-center gap-2 border-l border-line px-3 py-1.5 text-[14px] first:border-l-0 disabled:opacity-40',
                  on ? 'bg-fg font-semibold text-bg' : 'bg-panel2 text-fg2 hover:text-fg',
                )}
              >
                <i className={cn('inline-block size-2 rounded-full', TYPE_META[t].dot)} aria-hidden />
                {TYPE_META[t].short}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-[1.35fr_1fr_1fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-3 gap-4">
            <BigStat label="Швов сварено" value={fmtInt(w.seams)} />
            <BigStat label="Суммарная длина швов" value={length.v} unit={length.u} />
            <BigStat label="Сборочных единиц" value={fmtInt(w.parts)} />
          </div>
          <dl className="tnum grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-line pt-3 text-[14px]">
            {w.byProcess.map((p) => (
              <Row key={p.process} label={p.label}>
                {fmtInt(p.seams)} <span className="text-muted">швов · {fmt1(p.lengthM)} м</span>
              </Row>
            ))}
            <Row label="Сборочных единиц с законченной операцией">{fmtInt(w.partsFinished)}</Row>
            <Row
              label={
                <span className="flex items-center gap-1.5">
                  {w.inProgress > 0 && <span className="arc-dot inline-block size-2 rounded-full bg-arc" aria-hidden />}
                  Сейчас в сварке
                </span>
              }
            >
              {fmtInt(w.inProgress)}
            </Row>
          </dl>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <span className="text-xs text-muted">Сваренные соединения по результату телеметрии</span>
          <div className="flex items-baseline gap-2">
            <span className="tnum font-mono text-[36px] font-semibold leading-none text-fg">{fmt1(share * 100)}</span>
            <span className="text-[18px] text-fg2">%</span>
            <span className="text-[14px] text-fg2">без отклонений</span>
          </div>
          <Bar parts={QUALITY.map((q) => ({ key: q.key, n: w.quality[q.key], cls: q.cls, style: q.style }))} total={w.joints} />
          <ul className="tnum flex flex-col gap-1 text-[14px]">
            {QUALITY.map((q) => {
              if (q.key !== 'без отклонений' && w.quality[q.key] === 0) return null
              const bad = q.key === 'на переварку' || q.key === 'не рассмотрено'
              return (
                <li key={q.key} className="flex items-center gap-2">
                  <i className={cn('inline-block size-2.5 shrink-0 rounded-[2px]', q.cls)} style={q.style} aria-hidden />
                  <span className={bad ? 'text-crit-ink' : 'text-fg2'}>{q.key}</span>
                  <span className={cn('ml-auto font-mono', bad ? 'font-semibold text-crit' : 'text-fg')}>{fmtInt(w.quality[q.key])}</span>
                </li>
              )
            })}
            {w.joints - clean === 0 && <li className="text-xs text-muted">Отклонений по сваренным соединениям нет</li>}
          </ul>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <span className="text-xs text-muted">Сварка по техкартам</span>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="tnum font-mono text-[36px] font-semibold leading-none text-fg">{fmtInt(techShare * 100)}</span>
            <span className="text-[18px] text-fg2">%</span>
            <span className="text-[14px] text-fg2">{TYPE_META[type].coverage}</span>
          </div>
          <Bar
            parts={[{ key: 'tech', n: c.techSeconds, cls: 'bg-fg' }, ...OFF_CARD.map((o) => ({ key: o.key, n: c[o.key], cls: o.cls }))]}
            total={c.totalSeconds}
          />
          <ul className="tnum flex flex-col gap-1 text-[14px]">
            <li className="flex items-center gap-2">
              <i className="inline-block size-2.5 shrink-0 rounded-[2px] bg-fg" aria-hidden />
              <span className="text-fg2">по техкартам — в статистике</span>
              <span className="ml-auto font-mono text-fg">{fmtTime(c.techSeconds)}</span>
            </li>
            {OFF_CARD.filter((o) => c[o.key] > 0).map((o) => (
              <li key={o.key} className="flex items-center gap-2">
                <i className={cn('inline-block size-2.5 shrink-0 rounded-[2px]', o.cls)} aria-hidden />
                <span className="text-fg2">{o.label}</span>
                <span className="ml-auto font-mono text-fg2">
                  {fmtTime(c[o.key])} <span className="text-muted">· {fmtPct(c.totalSeconds ? c[o.key] / c.totalSeconds : 0)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-snug text-muted">
            Цифры слева — только по сварке, для которой узел нашёл техкарту по детали и операции. Отработка, прихватка и
            сварка без техкарты сюда не входят.
          </p>
        </div>
      </div>

      {w.daily.length > 1 && (
        <DailyBars
          items={w.daily}
          label="Суммарная длина швов по дням, м"
          value={(i) => w.daily[i]?.lengthM ?? 0}
          title={(i) => {
            const d = w.daily[i]!
            return `${fmtDayShort(d.date)}: ${fmt1(d.lengthM)} м · ${fmtInt(d.seams)} швов`
          }}
        />
      )}
    </section>
  )
}

// ───────────── по типам оборудования ─────────────

export function TypesSection({ slices, onOpen }: { slices: TypeSlice[]; onOpen: (t: EquipmentType) => void }) {
  return (
    <section aria-label="По типам оборудования" className="flex flex-col gap-3">
      <h2 className="label text-[16px] text-fg">По типам оборудования</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {slices.map((s) => {
          const m = TYPE_META[s.type]
          const empty = s.units === 0
          return (
            <button
              key={s.type}
              type="button"
              disabled={empty}
              onClick={() => onOpen(s.type)}
              className={cn(
                'group flex min-w-0 flex-col gap-3 rounded-[8px] bg-panel px-4 py-4 text-left ring-1 ring-line',
                empty ? 'opacity-45' : 'hover:ring-fg2/60',
              )}
            >
              <div className="flex items-center gap-2">
                <i className={cn('inline-block size-3 rounded-full', m.dot)} aria-hidden />
                <span className="font-cond text-[18px] font-semibold text-fg">{m.short}</span>
                {!empty && <ChevronRight className="ml-auto size-5 text-muted group-hover:text-fg" aria-hidden />}
              </div>
              {empty ? (
                <span className="text-[14px] text-muted">Вне фильтра</span>
              ) : (
                <>
                  <div className="tnum flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="self-center text-xs text-muted">Кз</span>
                    <span className="font-mono text-[36px] font-semibold leading-none text-fg">
                      {s.elapsedSeconds > 0 ? fmtInt(s.kz * 100) : '—'}
                    </span>
                    <span className="text-[18px] text-fg2">%</span>
                    <span className="basis-full text-[14px] text-fg2">
                      {s.units} ед. · в работе <b className="font-mono text-fg">{s.activeNow}</b>
                      {s.offline > 0 && <span className="text-muted"> · без связи {s.offline}</span>}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-[4px] bg-panel2" aria-hidden>
                    <div className={cn('h-full', m.bar)} style={{ width: `${Math.min(100, s.kz * 100)}%` }} />
                  </div>
                  <dl className="tnum grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[14px]">
                    <dt className="text-fg2">{m.process}</dt>
                    <dd className="text-right font-mono text-fg">{fmtHours(s.arcSeconds)}</dd>
                    <dt className="text-fg2">Режим ожидания</dt>
                    <dd className="text-right font-mono text-fg">{fmtHours(s.standbySeconds)}</dd>
                    <dt className="text-fg2">Простой</dt>
                    <dd className="text-right font-mono text-fg2">{fmtHours(s.idleSeconds)}</dd>
                    <dt className="text-fg2">Фонд времени</dt>
                    <dd className="text-right font-mono text-fg2">{fmtHours(s.fundSeconds)}</dd>
                    <dt className="text-fg2">Отклонения</dt>
                    <dd className="text-right font-mono">
                      <span className="text-fg">{s.deviations}</span>
                      {s.unreviewed > 0 && <span className="ml-1.5 font-semibold text-crit">({s.unreviewed} не рассм.)</span>}
                    </dd>
                  </dl>
                </>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
