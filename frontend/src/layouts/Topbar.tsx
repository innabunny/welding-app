import { Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react'
import { useMatches } from 'react-router'
import { useTheme } from '@/shared/lib/theme'
import { IconButton } from '@/shared/ui/Button'
import { SIDEBAR_ID } from './Sidebar'
import { useSidebar } from './sidebarStore'

export interface RouteHandle {
  crumb: string
}

function isRouteHandle(handle: unknown): handle is RouteHandle {
  return typeof handle === 'object' && handle !== null && 'crumb' in handle
}

function useCrumb(): string {
  const matches = useMatches()
  const last = [...matches].reverse().find((m) => isRouteHandle(m.handle))
  return last && isRouteHandle(last.handle) ? last.handle.crumb : ''
}

export function Topbar() {
  const crumb = useCrumb()
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  const { hidden: sidebarHidden, toggle: toggleSidebar } = useSidebar()

  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-10 flex h-topbar items-center justify-between gap-4 border-b border-border bg-surface px-4 md:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <IconButton
          label={sidebarHidden ? 'Показать меню' : 'Скрыть меню'}
          aria-expanded={!sidebarHidden}
          aria-controls={SIDEBAR_ID}
          onClick={toggleSidebar}
          className="hidden md:grid"
        >
          {sidebarHidden ? <PanelLeftOpen strokeWidth={1.8} /> : <PanelLeftClose strokeWidth={1.8} />}
        </IconButton>
        <nav aria-label="Хлебные крошки" className="truncate text-sm text-muted">
          Портал / <strong className="font-semibold text-text">{crumb}</strong>
        </nav>
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-label={dark ? 'Включить светлую тему' : 'Включить тёмную тему'}
        className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface py-[5px] pl-2 pr-3 text-caption text-text hover:border-primary"
      >
        {dark ? <Moon className="size-4" strokeWidth={1.8} /> : <Sun className="size-4" strokeWidth={1.8} />}
        {dark ? 'Тёмная' : 'Светлая'}
      </button>
    </header>
  )
}
