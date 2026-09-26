import type { UseQueryResult } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useDeferredValue, type ReactNode } from 'react'
import { Input } from '@/shared/ui/Form'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'

/** Общее для вкладки: поиск и права на правку */
export interface TabProps {
  search: string
  onSearch: (search: string) => void
  canEdit: boolean
}

interface ToolbarProps {
  search: string
  onSearch: (search: string) => void
  placeholder: string
  action?: ReactNode
}

export function Toolbar({ search, onSearch, placeholder, action }: ToolbarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="relative min-w-[200px] flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <Input
          type="search"
          aria-label={placeholder}
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      {action}
    </div>
  )
}

interface Props<T> {
  query: UseQueryResult<T[]>
  search: string
  /** Текст записи, по которому ищем */
  text: (item: T) => string
  emptyTitle: string
  emptyDescription?: string
  emptyAction?: ReactNode
  children: (items: T[]) => ReactNode
}

/** Загрузка, ошибка, пусто и поиск — одинаковые для всех вкладок */
export function ReferenceList<T>({
  query,
  search,
  text,
  emptyTitle,
  emptyDescription,
  emptyAction,
  children,
}: Props<T>) {
  // поиска на бэке нет — фильтруем загруженный список
  const needle = useDeferredValue(search.trim().toLowerCase())

  if (query.isPending) return <SkeletonRows rows={6} />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (query.data.length === 0)
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />

  const items = needle
    ? query.data.filter((item) => text(item).toLowerCase().includes(needle))
    : query.data
  if (items.length === 0)
    return <EmptyState title="Ничего не найдено" description="Измените строку поиска." />

  return children(items)
}
