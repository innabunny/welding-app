import { Link, useNavigate } from 'react-router'
import { cn } from '@/shared/lib/cn'
import { Table, Td, Th, Tr } from '@/shared/ui/Table'
import { ModeBadge, PendingDeviations, PostStatusBadge } from './Badges'
import { formatClock, formatDuration, formatLive, formatStart, secondsSince, shortName } from './format'
import { isFresh, STALE_SESSION_SECONDS, type Post } from './posts'
import { equipmentPath } from './routes'

function LiveValue({ post, value, now }: { post: Post; value: 'i' | 'u'; now: number }) {
  if (!post.equipment.nodeId) return <span className="text-muted">—</span>
  const text = isFresh(post.tick, now) ? formatLive(post.tick[value]) : null
  if (text === null) return <span className="whitespace-nowrap text-xs text-muted">нет данных</span>
  return <span className="font-mono text-lg font-semibold tracking-number">{text}</span>
}

function Place({ post }: { post: Post }) {
  const e = post.equipment
  const first = [e.methodDesignation || e.methodName, e.workstationNumber && `пост ${e.workstationNumber}`]
  return (
    <>
      <span className="block text-xs text-muted">{first.filter(Boolean).join(' · ')}</span>
      {e.workshopName && <span className="block text-xs text-muted">{e.workshopName}</span>}
    </>
  )
}

function SessionCell({ post, now }: { post: Post; now: number }) {
  const { session } = post
  if (!session) return <span className="text-muted">—</span>
  const elapsed = secondsSince(session.startedAt, now)
  const stale = elapsed !== null && elapsed > STALE_SESSION_SECONDS
  return (
    <>
      {stale ? (
        <span className="text-warning">не закрыт</span>
      ) : (
        <span className="font-mono">{formatClock(elapsed)}</span>
      )}
      <span className="block whitespace-nowrap text-xs text-muted">с {formatStart(session.startedAt, now)}</span>
      {post.staleSessions > 0 && (
        <span className="block text-xs text-warning">незакрытых ещё {post.staleSessions}</span>
      )}
    </>
  )
}

function NodeNote({ post }: { post: Post }) {
  const { node, status } = post
  if (status === 'offline') {
    return (
      <span className="mt-1 block text-xs text-muted">
        {node?.silentSeconds != null ? `молчит ${formatDuration(node.silentSeconds)}` : 'сообщений ещё не было'}
      </span>
    )
  }
  if (node && node.queued > 0) {
    return <span className="mt-1 block text-xs text-warning">досылает накопленные данные</span>
  }
  return null
}

export function PostsTable({ posts, now }: { posts: Post[]; now: number }) {
  const navigate = useNavigate()
  return (
    <Table>
      <thead>
        <tr>
          <Th>Оборудование</Th>
          <Th>Состояние</Th>
          <Th>Сварщик, режим работы</Th>
          <Th className="text-right">Ток, А</Th>
          <Th className="text-right">Напряжение, В</Th>
          <Th>Отклонения</Th>
          <Th>Сеанс</Th>
        </tr>
      </thead>
      <tbody>
        {posts.map((post) => {
          const { equipment: e, session } = post
          const alarm = post.regimePending > 0 || post.orderPending > 0
          return (
            <Tr
              key={e.id}
              // вся строка ведёт на экран аппарата; с клавиатуры — ссылка в названии
              onClick={() => navigate(equipmentPath(e.id))}
              className={cn(
                'cursor-pointer hover:bg-surface-2/60',
                alarm && 'bg-danger-soft/60 [&>td:first-child]:shadow-[inset_4px_0_0_rgb(var(--c-danger))]',
              )}
            >
              <Td className="min-w-[210px] !pl-3">
                <Link to={equipmentPath(e.id)} className="whitespace-nowrap font-semibold hover:text-primary">
                  {e.name}
                </Link>
                <Place post={post} />
              </Td>
              <Td>
                <PostStatusBadge status={post.status} />
                <NodeNote post={post} />
              </Td>
              <Td>
                {session ? (
                  <div className="flex flex-col items-start gap-1">
                    {session.welderName ? (
                      <span title={session.welderName} className="whitespace-nowrap">
                        {shortName(session.welderName)}
                      </span>
                    ) : (
                      <span className="text-muted">сварщик не опознан</span>
                    )}
                    <ModeBadge mode={session.mode} label={session.modeDisplay} />
                  </div>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </Td>
              <Td className="text-right">
                <LiveValue post={post} value="i" now={now} />
              </Td>
              <Td className="text-right">
                <LiveValue post={post} value="u" now={now} />
              </Td>
              <Td>{session ? <PendingDeviations regime={post.regimePending} order={post.orderPending} /> : <span className="text-muted">—</span>}</Td>
              <Td className="min-w-[104px]">
                <SessionCell post={post} now={now} />
              </Td>
            </Tr>
          )
        })}
      </tbody>
    </Table>
  )
}
