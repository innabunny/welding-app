import { Link } from 'react-router'
import { EmptyState } from '@/shared/ui/States'

export function NotFoundPage() {
  return (
    <EmptyState
      title="Страница не найдена"
      description="Возможно, ссылка устарела."
      action={
        <Link to="/" className="text-sm text-primary hover:underline">
          На рабочий стол
        </Link>
      }
    />
  )
}
