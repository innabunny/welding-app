import { Activity, FilePlus, Layers, Search, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { roleLabels } from '@/features/auth/roles'
import { paths } from '@/layouts/navigation'
import { useSession } from '@/shared/api/session'
import { Panel } from '@/shared/ui/Card'

interface QuickLink {
  to: string
  icon: LucideIcon
  title: string
  note: string
}

const links: QuickLink[] = [
  { to: paths.cards, icon: FilePlus, title: 'Новая техкарта', note: 'на операцию детали' },
  { to: paths.cards, icon: Search, title: 'Подбор режима', note: 'по марке и толщине' },
  { to: paths.welds, icon: Activity, title: 'Паспорт шва', note: 'план, факт, контроль' },
  { to: paths.references, icon: Layers, title: 'Справочники', note: 'марки, присадка, газы' },
]

export function QuickAccess() {
  const role = useSession((s) => s.user?.role)

  return (
    <Panel
      title="Быстрый доступ"
      subtitle={role ? `Для роли «${roleLabels[role].toLowerCase()}»` : undefined}
    >
      <div className="grid grid-cols-2 gap-2.5">
        {links.map(({ to, icon: Icon, title, note }) => (
          <Link
            key={title}
            to={to}
            className="rounded-box border border-border bg-surface p-3.5 transition-colors hover:border-primary"
          >
            <Icon className="mb-[9px] size-[19px] text-primary" strokeWidth={1.8} aria-hidden />
            <strong className="block text-sm font-semibold">{title}</strong>
            <span className="text-xs text-muted">{note}</span>
          </Link>
        ))}
      </div>
    </Panel>
  )
}
