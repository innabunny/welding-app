import { cn } from '@/shared/lib/cn'
import type { ArcRun, SocketStatus } from '@/shared/types/telemetry'
import { FitChip, postState } from './Badges'
import { fmt1, formatClock, formatTime, secondsSince } from './format'
import type { Fit, Range } from './plan'
import { isFresh, type Post } from './posts'
import { SocketStatusLine } from './SocketStatusLine'

interface Props {
  post: Post
  /** горящий сейчас участок дуги — для «5:04 с 13:26:10» */
  arc: ArcRun | null
  socketStatus: SocketStatus
  now: number
}

/**
 * Шкала под цифрой: зелёный коридор допуска и метка живого значения.
 * Коридор в середине, поля по бокам — чтобы выход за него был виден.
 */
function ToleranceBar({ value, r, unit, active }: { value: number | null; r: Range; unit: string; active: boolean }) {
  const [lo, hi] = r
  const pad = (hi - lo) * 0.6
  const min = lo - pad
  const max = hi + pad
  const pos = (v: number) => ((Math.min(max, Math.max(min, v)) - min) / (max - min || 1)) * 100
  const out = value !== null && (value < lo || value > hi)
  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-3 rounded-[4px] bg-panel2 ring-1 ring-line">
        <div className="absolute inset-y-0 bg-ok/30 ring-1 ring-ok/60" style={{ left: `${pos(lo)}%`, width: `${pos(hi) - pos(lo)}%` }} />
        {active && value !== null && (
          <div
            className={cn('absolute -top-1.5 h-6 w-1.5 -translate-x-1/2 rounded-[4px]', out ? 'bg-crit' : 'bg-fg')}
            style={{ left: `${pos(value)}%` }}
            aria-hidden
          />
        )}
      </div>
      <div className="tnum relative h-4 font-mono text-xs text-fg2">
        <span className="absolute -translate-x-1/2" style={{ left: `${pos(lo)}%` }}>
          {fmt1(lo)}
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: `${pos(hi)}%` }}>
          {fmt1(hi)}
        </span>
        <span className="absolute right-0 text-muted">допуск, {unit}</span>
      </div>
    </div>
  )
}

function Measure({
  label,
  value,
  unit,
  fit,
  r,
  dim,
  big = false,
}: {
  label: string
  value: number | null
  unit: string
  fit: Fit
  r: Range | null
  dim: boolean
  big?: boolean
}) {
  const out = fit === 'out'
  return (
    <div className={cn('flex min-w-0 flex-col gap-3 px-5 py-5', out ? 'bg-crit-bg' : 'bg-panel')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn('label text-[14px]', out ? 'text-crit-ink' : 'text-muted')}>{label}</span>
        <FitChip fit={fit} />
      </div>
      <div className={cn('tnum font-mono font-semibold leading-none', out ? 'text-crit' : dim ? 'text-muted' : 'text-fg')}>
        <span className={big ? 'text-[72px] sm:text-[96px]' : 'text-[60px] sm:text-[72px]'}>{value === null ? '—' : fmt1(value)}</span>
        <span className="ml-2 text-[30px] font-medium text-fg2">{unit}</span>
      </div>
      {r && <ToleranceBar value={value} r={r} unit={unit} active={!dim} />}
    </div>
  )
}

/** Строка под плитками — только когда с показаниями что-то не так */
function Note({ post, socketStatus }: Pick<Props, 'post' | 'socketStatus'>) {
  if (socketStatus !== 'open') return <SocketStatusLine status={socketStatus} />
  if (post.corridor?.kind === 'envelope') {
    return <p className="text-[14px] text-fg2">Проход не определён — шкала по крайним границам всех проходов техкарты.</p>
  }
  return null
}

export function LivePanel({ post, arc, socketStatus, now }: Props) {
  const tick = isFresh(post.tick, now) ? post.tick : null
  const state = postState(post.status)
  const dim = state !== 'welding'
  const c = post.corridor && post.corridor.kind !== 'uncontrolled' ? post.corridor : null
  const pass = post.session?.currentPass ?? null
  const burning = arc !== null && arc.finishedAt === null
  return (
    <div className="flex flex-col gap-2">
      <section
        aria-label="Текущие показания"
        className="grid grid-cols-1 gap-px overflow-hidden rounded-[8px] bg-line ring-1 ring-line lg:grid-cols-[1.25fr_1fr_1fr]"
      >
        <Measure label="Ток" value={tick?.i ?? null} unit="А" fit={post.iFit} r={c?.current ?? null} dim={dim} big />
        <Measure label="Напряжение" value={tick?.u ?? null} unit="В" fit={post.uFit} r={c?.voltage ?? null} dim={dim} />
        <div className="flex flex-col gap-3 bg-panel px-5 py-5">
          <span className="label text-[14px] text-muted">Дуга</span>
          {state === 'welding' ? (
            <div className="flex items-center gap-3">
              <span className="arc-dot inline-block size-5 rounded-full bg-arc" aria-hidden />
              <span className="font-cond text-[36px] font-semibold text-arc">Горит</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="inline-block size-5 rounded-full border-2 border-muted" aria-hidden />
              <span className="font-cond text-[36px] font-semibold text-muted">
                {state === 'offline' || tick === null ? 'Нет данных' : 'Не горит'}
              </span>
            </div>
          )}
          {burning && (
            <div className="tnum font-mono text-[24px] text-fg">
              {formatClock(secondsSince(arc.startedAt, now))}
              <span className="ml-2 font-sans text-[16px] text-fg2">с {formatTime(arc.startedAt, true)}</span>
            </div>
          )}
          {pass ? (
            <div className="text-[18px] text-fg">
              Проход <b>{pass.no}</b>
              {pass.total !== null && <span className="text-fg2"> из {pass.total}</span>}
            </div>
          ) : burning ? (
            <div className="text-fg2">Проход не сопоставлен</div>
          ) : null}
        </div>
      </section>
      <Note post={post} socketStatus={socketStatus} />
    </div>
  )
}
