import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useSession } from '@/shared/api/session'
import type { LiveTick, SocketStatus, TelemetryEvent } from '@/shared/types/telemetry'
import { sessionEventKeys } from './queries'

/** Код закрытия, которым сервер отвечает пользователю, который не вошёл */
const CLOSE_UNAUTHORIZED = 4001
const RETRY_FIRST_MS = 1_000
const RETRY_MAX_MS = 30_000

/** Показания вместе с моментом, когда их получил браузер */
export interface ReceivedTick extends LiveTick {
  receivedAt: number
}

export interface TelemetrySocket {
  status: SocketStatus
  /** последние показания по каждому узлу: node → показания */
  ticks: Record<string, ReceivedTick>
  lastEvent: TelemetryEvent | null
}

const EMPTY: TelemetrySocket = { status: 'connecting', ticks: {}, lastEvent: null }

type Incoming = { kind: 'tick'; tick: LiveTick } | { kind: 'event'; event: TelemetryEvent }

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const numOrNull = (v: unknown): number | null => (typeof v === 'number' ? v : null)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Разбор сообщения. Чужие и битые сообщения отбрасываются, а не роняют панель */
function parseMessage(raw: unknown): Incoming | null {
  if (typeof raw !== 'string') return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(data) || typeof data.node !== 'string') return null

  if (data.event === 'session_start') {
    return {
      kind: 'event',
      event: {
        event: 'session_start',
        node: data.node,
        sid: str(data.sid),
        welder: str(data.welder),
        mode: str(data.mode),
      },
    }
  }
  if (data.event === 'session_stop') {
    return { kind: 'event', event: { event: 'session_stop', node: data.node, sid: str(data.sid) } }
  }
  if ('event' in data) return null

  return {
    kind: 'tick',
    tick: {
      node: data.node,
      sid: str(data.sid),
      ts: numOrNull(data.ts),
      i: numOrNull(data.i),
      u: numOrNull(data.u),
      arc: data.arc === true,
    },
  }
}

function socketUrl(node: string | null, token: string): string {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const path = node ? `/ws/telemetry/${encodeURIComponent(node)}/` : '/ws/telemetry/'
  // заголовок Authorization браузер для WebSocket не передаёт — токен в адресе
  return `${scheme}://${window.location.host}${path}?token=${encodeURIComponent(token)}`
}

/**
 * Живые показания через WebSocket портала.
 *
 * node = строка — один аппарат, null — все аппараты сразу, undefined —
 * не подключаться (например, у оборудования нет узла).
 * По событиям начала и конца сеанса обновляет списки узлов, сеансов
 * и отклонений, чтобы панель перерисовалась без перезагрузки.
 */
export function useTelemetrySocket(node: string | null | undefined): TelemetrySocket {
  const token = useSession((s) => s.token)
  const queryClient = useQueryClient()
  // состояние помечено адресом соединения: при смене аппарата
  // показания прежнего не показываются ни на один кадр
  const target = node === undefined ? null : `${node ?? '*'}|${token ?? ''}`
  const [state, setState] = useState<{ target: string | null; data: TelemetrySocket }>({
    target: null,
    data: EMPTY,
  })

  useEffect(() => {
    if (node === undefined || !token || target === null) return

    let socket: WebSocket | null = null
    let retryTimer: number | undefined
    let delay = RETRY_FIRST_MS
    let stopped = false

    const update = (fn: (prev: TelemetrySocket) => TelemetrySocket) =>
      setState((prev) => ({ target, data: fn(prev.target === target ? prev.data : EMPTY) }))

    const refreshLists = () => {
      for (const key of sessionEventKeys) void queryClient.invalidateQueries({ queryKey: key })
    }

    const connect = () => {
      socket = new WebSocket(socketUrl(node, token))

      socket.onopen = () => {
        delay = RETRY_FIRST_MS
        update((prev) => ({ ...prev, status: 'open' }))
        // пока соединения не было, события могли пройти мимо
        refreshLists()
      }

      socket.onmessage = (e: MessageEvent) => {
        const msg = parseMessage(e.data)
        if (!msg) return
        if (msg.kind === 'tick') {
          const received: ReceivedTick = { ...msg.tick, receivedAt: Date.now() }
          update((prev) => ({ ...prev, ticks: { ...prev.ticks, [received.node]: received } }))
          return
        }
        update((prev) => ({ ...prev, lastEvent: msg.event }))
        refreshLists()
      }

      socket.onclose = (e: CloseEvent) => {
        socket = null
        if (stopped) return
        // не вошёл — это не обрыв сети, переподключение не поможет
        if (e.code === CLOSE_UNAUTHORIZED) {
          update((prev) => ({ ...prev, status: 'unauthorized' }))
          return
        }
        update((prev) => ({ ...prev, status: 'reconnecting' }))
        retryTimer = window.setTimeout(connect, delay)
        delay = Math.min(delay * 2, RETRY_MAX_MS)
      }
    }

    connect()

    return () => {
      stopped = true
      window.clearTimeout(retryTimer)
      socket?.close()
    }
  }, [node, token, target, queryClient])

  if (node !== undefined && !token) return { ...EMPTY, status: 'unauthorized' }
  return state.target === target ? state.data : EMPTY
}
