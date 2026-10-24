// Строка списка постов: аппарат + узел + идущий сеанс + живые показания.
// Здесь только сопоставление готовых данных из API и WebSocket,
// никаких расчётов Кз, времени и отклонений.

import type { Deviation } from '@/shared/types/deviations'
import type { Equipment } from '@/shared/types/equipment'
import type { NodeState } from '@/shared/types/nodes'
import type { WeldingSession } from '@/shared/types/welding'
import { fit, liveCorridor, type Fit, type LiveCorridor } from './plan'
import type { ReceivedTick } from './useTelemetrySocket'

/**
 * Показания старше этого считаются устаревшими: узел шлёт их раз
 * в секунду, три пропуска подряд — уже не «сейчас».
 */
export const LIVE_FRESH_MS = 3_000

/**
 * Дольше смены сеанс идти не может: если он открыт дольше,
 * его не закрыли (узел не прислал конец сеанса)
 */
export const STALE_SESSION_SECONDS = 16 * 3600

export type PostStatus =
  /** дуга горит по живым показаниям */
  | 'arc'
  /** сеанс открыт, показания идут, дуги нет */
  | 'standby'
  /** сеанс открыт, но живых показаний нет — горит ли дуга, неизвестно */
  | 'session'
  /** узел на связи, сеанса нет */
  | 'free'
  /** узел не на связи */
  | 'offline'
  /** у аппарата нет узла телеметрии */
  | 'no-node'

export interface Post {
  equipment: Equipment
  node: NodeState | null
  /** самый свежий незакрытый сеанс аппарата */
  session: WeldingSession | null
  /** ещё незакрытые сеансы, кроме самого свежего — признак, что сеанс не закрылся */
  staleSessions: number
  tick: ReceivedTick | null
  status: PostStatus
  /** нерассмотренные отклонения режима по идущему сеансу */
  regimePending: number
  /** нерассмотренные нарушения порядка по идущему сеансу */
  orderPending: number
  /** коридор допуска для живых значений; null — сеанса нет */
  corridor: LiveCorridor | null
  /** попадание живых значений в коридор — только пока горит дуга */
  iFit: Fit
  uFit: Fit
  /** ток или напряжение прямо сейчас вне коридора */
  outNow: boolean
}

/** Порядок в списке: сначала то, что требует внимания или идёт сейчас */
const ORDER: Record<PostStatus, number> = {
  arc: 0,
  standby: 1,
  session: 2,
  offline: 3,
  free: 4,
  'no-node': 5,
}

export function isFresh(tick: ReceivedTick | null | undefined, now: number): tick is ReceivedTick {
  return Boolean(tick && now - tick.receivedAt <= LIVE_FRESH_MS)
}

function statusOf(
  equipment: Equipment,
  node: NodeState | null,
  session: WeldingSession | null,
  tick: ReceivedTick | null,
  now: number,
): PostStatus {
  if (!equipment.nodeId) return 'no-node'
  const fresh = isFresh(tick, now)
  if (fresh && tick.arc) return 'arc'
  // свежие показания — узел точно на связи, даже если список узлов ещё не обновился
  if (!fresh && !node?.isOnline) return 'offline'
  if (session) return fresh ? 'standby' : 'session'
  return 'free'
}

interface Sources {
  equipment: Equipment[]
  nodes: NodeState[]
  sessions: WeldingSession[]
  ticks: Record<string, ReceivedTick>
  pending: Deviation[]
  now: number
}

export function buildPosts({ equipment, nodes, sessions, ticks, pending, now }: Sources): Post[] {
  const nodeByEquipment = new Map<number, NodeState>()
  for (const n of nodes) if (n.equipment !== null) nodeByEquipment.set(n.equipment, n)

  const openByEquipment = new Map<number, WeldingSession[]>()
  for (const s of sessions) {
    if (s.finishedAt !== null) continue
    const list = openByEquipment.get(s.equipmentId) ?? []
    list.push(s)
    openByEquipment.set(s.equipmentId, list)
  }

  const pendingBySession = new Map<number, { regime: number; order: number }>()
  for (const d of pending) {
    if (d.reviewed) continue
    const c = pendingBySession.get(d.session) ?? { regime: 0, order: 0 }
    if (d.isOrganizational) c.order += 1
    else c.regime += 1
    pendingBySession.set(d.session, c)
  }

  const posts = equipment.map((e): Post => {
    const node = nodeByEquipment.get(e.id) ?? null
    const open = (openByEquipment.get(e.id) ?? [])
      // даты приходят с разными поясами (+03:00 и Z) — сравниваем моменты, а не строки
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    const session = open[0] ?? null
    const tick = e.nodeId ? (ticks[e.nodeId] ?? null) : null
    const counts = session ? pendingBySession.get(session.id) : undefined
    const corridor = session ? liveCorridor(session) : null
    // без дуги ток около нуля — сравнивать с коридором бессмысленно
    const live = isFresh(tick, now) && tick.arc && corridor !== null && corridor.kind !== 'uncontrolled' ? corridor : null
    const iFit = live ? fit(tick?.i, live.current) : 'none'
    const uFit = live ? fit(tick?.u, live.voltage) : 'none'
    return {
      equipment: e,
      node,
      session,
      staleSessions: Math.max(0, open.length - 1),
      tick,
      status: statusOf(e, node, session, tick, now),
      regimePending: counts?.regime ?? 0,
      orderPending: counts?.order ?? 0,
      corridor,
      iFit,
      uFit,
      outNow: iFit === 'out' || uFit === 'out',
    }
  })

  return posts.sort(
    (a, b) =>
      Number(b.outNow) - Number(a.outNow) ||
      ORDER[a.status] - ORDER[b.status] ||
      b.regimePending + b.orderPending - (a.regimePending + a.orderPending) ||
      a.equipment.name.localeCompare(b.equipment.name, 'ru'),
  )
}
