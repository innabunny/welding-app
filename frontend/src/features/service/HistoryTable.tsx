import { formatDate, formatWhen } from '@/shared/lib/format'
import type { ServiceRequest } from '@/shared/types/service'
import { Badge } from '@/shared/ui/Badge'
import { Table, Td, Th, Tr } from '@/shared/ui/Table'
import { priorityMeta, reasonMeta, statusMeta } from './labels'

/** Закрытые и отклонённые — компактно: кто закрыл и что сделал */
export function HistoryTable({ items }: { items: ServiceRequest[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Установка</Th>
          <Th>Причина</Th>
          <Th>Срочность</Th>
          <Th>Исход</Th>
          <Th className="w-[34%]">Что сделано</Th>
          <Th>Закрыл</Th>
          <Th>Подана</Th>
        </tr>
      </thead>
      <tbody>
        {items.map((r) => {
          const status = statusMeta[r.status]
          const priority = priorityMeta[r.priority]
          return (
            <Tr key={r.id} className="align-top hover:bg-surface-2/60">
              <Td className="py-2.5">
                <span className="font-semibold">{r.equipmentName}</span>
                {r.description && (
                  <span className="block max-w-[260px] truncate text-xs text-muted" title={r.description}>
                    {r.description}
                  </span>
                )}
              </Td>
              <Td className="whitespace-nowrap py-2.5">{reasonMeta[r.reason].label}</Td>
              <Td className="py-2.5">
                <Badge tone={priority.tone}>{priority.label}</Badge>
              </Td>
              <Td className="py-2.5">
                <Badge tone={status.tone}>{status.label}</Badge>
              </Td>
              <Td className="py-2.5">
                <span className="line-clamp-2 break-words text-sm" title={r.resolution || undefined}>
                  {r.resolution || <span className="text-muted">—</span>}
                </span>
              </Td>
              <Td className="whitespace-nowrap py-2.5">
                {r.closedByName || <span className="text-muted">—</span>}
                {r.closedAt && (
                  <time dateTime={r.closedAt} title={formatDate(r.closedAt)} className="block text-xs text-muted">
                    {formatWhen(r.closedAt)}
                  </time>
                )}
              </Td>
              <Td className="whitespace-nowrap py-2.5">
                {r.authorName || <span className="text-muted">—</span>}
                <time dateTime={r.createdAt} title={formatDate(r.createdAt)} className="block text-xs text-muted">
                  {formatWhen(r.createdAt)}
                </time>
              </Td>
            </Tr>
          )
        })}
      </tbody>
    </Table>
  )
}
