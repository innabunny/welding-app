import { LogOut } from 'lucide-react'
import { NavLink } from 'react-router'
import { roleLabels } from '@/features/auth/roles'
import { useLogout } from '@/features/auth/useLogout'
import { useExpiringAttestations, useServiceSummary } from '@/features/dashboard/queries'
import { useSession } from '@/shared/api/session'
import { cn } from '@/shared/lib/cn'
import { initials } from '@/shared/lib/format'
import { IconButton } from '@/shared/ui/Button'
import { navigation, paths, type NavCounter } from './navigation'

function useCounters(): Record<NavCounter, number> {
  const expiring = useExpiringAttestations()
  const service = useServiceSummary()
  return {
    attestation: (expiring.data?.expiredCount ?? 0) + (expiring.data?.soonCount ?? 0),
    service: service.data?.open ?? 0,
  }
}

export const SIDEBAR_ID = 'app-sidebar'

/** hidden действует только на десктопе: на телефоне меню — единственная навигация */
export function Sidebar({ hidden }: { hidden: boolean }) {
  const counters = useCounters()
  const user = useSession((s) => s.user)
  const logout = useLogout()

  return (
    <aside
      id={SIDEBAR_ID}
      className={cn(
        'flex flex-col border-b border-border bg-surface p-3 md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r md:px-3.5 md:py-[22px]',
        hidden && 'md:hidden',
      )}
    >
      <div className="hidden items-center gap-3 px-2 pb-[26px] pt-1 md:flex">
        <div className="grid size-[38px] place-items-center rounded-tile bg-primary text-lg font-bold text-white">
          СП
        </div>
        <div>
          <strong className="block text-nav leading-tight">Сварочное производство</strong>
          <span className="text-xs text-muted">Цифровой контроль</span>
        </div>
      </div>

      <nav aria-label="Разделы" className="flex gap-0.5 overflow-x-auto md:block md:overflow-y-auto">
        {navigation.map((group) => (
          <div key={group.title} className="contents md:block">
            <div className="mx-2 mb-1.5 mt-3.5 hidden text-xs font-semibold text-muted md:block">
              {group.title}
            </div>
            <ul className="contents md:grid md:gap-0.5">
              {group.items.map(({ to, label, icon: Icon, counter }) => {
                const count = counter ? counters[counter] : 0
                return (
                  <li key={to} className="contents md:block">
                    <NavLink
                      to={to}
                      end={to === paths.dashboard}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-[11px] whitespace-nowrap rounded-control px-2.5 py-[9px] text-nav md:w-full',
                          isActive
                            ? 'bg-primary-soft font-semibold text-primary'
                            : 'text-muted hover:bg-surface-2 hover:text-text',
                        )
                      }
                    >
                      <Icon className="size-[17px] shrink-0" strokeWidth={1.8} aria-hidden />
                      {label}
                      {count > 0 && (
                        <span className="ml-auto rounded-full bg-danger-soft px-[7px] py-px text-xs font-semibold text-danger">
                          {count}
                        </span>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {user && (
        <div className="mt-auto hidden border-t border-border pt-3 md:block">
          <div className="flex items-center gap-2.5 px-2 pb-0.5 pt-2.5">
            <div className="grid size-[34px] shrink-0 place-items-center rounded-full bg-primary-soft text-caption font-bold text-primary">
              {initials(user.name || user.login)}
            </div>
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-sm">{user.name || user.login}</strong>
              <span className="text-xs text-muted">{roleLabels[user.role]}</span>
            </div>
            <IconButton label="Выйти" onClick={logout} className="size-8 border-transparent">
              <LogOut />
            </IconButton>
          </div>
        </div>
      )}
    </aside>
  )
}
